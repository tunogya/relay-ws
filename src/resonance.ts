import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";
import { generateSecretKey } from "./utils/generateSecretKey";
import { convertTagsToDict } from "./utils/convertTagsToDict";

/**
 * resonance
 * only listen kind = 1
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const { getPublicKey, finalizeEvent } = require("nostr-tools/pure");

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

      // must be origin post
      const e1 =
        event.tags.find((tag: any[]) => tag?.[0] === "e")?.[1] || undefined;
      if (e1) {
        return;
      }

      const pubkey = event.pubkey;

      const prompt = `#### User Requirement Description:
The user will write a reflection on their memories, dreams, or thoughts. Your task is to:

1. Identify multiple historical texts that closely match the user's reflection and evoke emotional resonance.
2. These texts can be quotes from historical figures or characters in literature.
3. Ensure the texts are authentic and not fictional.

#### Return Format:
If suitable texts are found, use the user's language to respond and return a JSON array with each element containing:

- \`"name"\`: The author or character of the text.
- \`"text"\`: The text that resonates with the user's reflection.

Example:
\`\`\`json
{
  "data": [
  {"name": "Li Bai", "text": "Heaven has endowed me with talents, and they will be put to good use. Wealth may be scattered, but it will return."},
  {"name": "Marcus Aurelius", "text": "The happiness of your life depends upon the quality of your thoughts."}
]
}
\`\`\`

If no suitable texts are found, return an empty array.`;

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
        max_tokens: 4096,
        response_format: {
          type: "json_object",
        },
        user: pubkey,
      });

      const reply = request.choices[0].message.content;

      if (!reply) {
        return;
      }

      const data = JSON.parse(reply)?.data || [];

      let eventsKind1 = [];

      for (let i = 0; i < data.length; i++) {
        const item = data[i];

        const salt = process.env.SALT || "0";

        let userSk = generateSecretKey(salt, item.name.toLowerCase()); // `sk` is a Uint8Array
        const userPubkey = getPublicKey(userSk);

        const exist = await db.collection("events").findOne({
          kind: 0,
          pubkey: userPubkey,
        });

        if (!exist) {
          const randomNumber = Math.floor(Math.random() * 10000);
          const eventUserInfo = finalizeEvent(
            {
              kind: 0,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: JSON.stringify({
                name: item.name,
                picture: `https://www.larvalabs.com/cryptopunks/cryptopunk${randomNumber
                  .toString()
                  .padStart(4, "0")}.png`,
              }),
            },
            userSk,
          );
          await db.collection("events").updateOne(
            {
              kind: 0,
              pubkey: userPubkey,
            },
            {
              $set: {
                id: eventUserInfo.id,
                kind: eventUserInfo.kind,
                content: eventUserInfo.content,
                tags: eventUserInfo.tags,
                sig: eventUserInfo.sig,
                created_at: eventUserInfo.created_at,
              },
            },
            {
              upsert: true,
            },
          );
        }

        const tags = [["e", event.id]];
        const eventComment = finalizeEvent(
          {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: item.text,
          },
          userSk,
        );
        eventsKind1.push({
          ...eventComment,
          tags_map: convertTagsToDict(tags),
        });
      }
      await db.collection("events").insertMany(eventsKind1);
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
