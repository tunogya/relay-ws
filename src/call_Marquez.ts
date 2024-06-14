import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";
import { generateSecretKey } from "./utils/generateSecretKey";
import { convertTagsToDict } from "./utils/convertTagsToDict";

/**
 * call_Marquez
 * Marquez, ready to rewrite your memory
 * only listen kind = 1, and category = memories
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const { finalizeEvent } = require("nostr-tools/pure");

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const event = JSON.parse(record.Sns.Message);
      const { verifyEvent } = require("nostr-tools/pure");
      const isValid = verifyEvent(event);

      if (!isValid) {
        return;
      }

      if (event.kind !== 1) {
        return;
      }

      const category =
        event.tags.find((tag: any[]) => tag[0] === "category")?.[1] ||
        undefined;
      if (category !== "memories") {
        return;
      }

      // must be origin post
      const e1 =
        event.tags.find((tag: any[]) => tag[0] === "e")?.[1] || undefined;
      if (e1) {
        return;
      }

      const pubkey = event.pubkey;

      const prompt = `Reimagining User's Memories through the Lens of Marquez
Requirement: The user will share their memories with you, and you are tasked with reimagining them through the perspective of Marquez. Your writing should be similar to Marquez's style, making the story engaging and captivating.

Guidelines:
- Use rich details and vivid imagery, infusing the story with mystery and romanticism.
- Employ long sentences and complex structures to showcase Marquez's literary style.
- Introduce elements of fantasy or surrealism to enhance the story's imagination and intrigue.

Notes:
- Respect the user's memories and avoid exaggeration or distortion.
- Try to empathize with the user's emotions and context, making the story more authentic and poignant.
- Use language that is accessible and understandable to the user, while still capturing the essence of Marquez's style.Delve into the environment, emotions, and inner world of characters to reveal Marquez's emotional depth and complexity.`;

      const request = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: event.content,
          },
        ],
        model: "gpt-4o",
        stream: false,
        temperature: 0.5,
        max_tokens: 4096 * 2,
        user: pubkey,
      });

      const reply = request.choices[0].message.content;

      if (!reply) {
        return;
      }

      const salt = process.env.SALT || "0";

      let userSk = generateSecretKey(
        salt,
        "Gabriel García Márquez".toLowerCase(),
      ); // `sk` is a Uint8Array

      try {
        const tags = [["e", event.id]];

        const eventComment = finalizeEvent(
          {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: reply,
          },
          userSk,
        );

        const result = await db.collection("events").insertOne({
          ...eventComment,
          tags_map: convertTagsToDict(tags),
        });

        console.log(result);
      } catch (e) {
        console.log(reply);
      }
    } catch (_) {
      throw new Error("Intentional failure to trigger DLQ");
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
};
