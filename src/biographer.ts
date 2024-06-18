import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";
import { generateSecretKey } from "./utils/generateSecretKey";
import { convertTagsToDict } from "./utils/convertTagsToDict";
import { ddbDocClient } from "./utils/ddbDocClient";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { newUserInfo } from "./utils/newUserInfo";

/**
 * biographer
 * only listen kind = 1, and category = memories
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

      const category =
        event.tags.find((tag: any[]) => tag?.[0] === "category")?.[1] ||
        undefined;
      if (category !== "memories") {
        return;
      }

      const pubkey = event.pubkey;

      const prompt = `Please write a memoir in the style of Zweig, based on the memories I provide. Use your pen to narrate the ups and downs of my life, as if writing a biography in the spirit of Zweig. Let the words be like delicate brushstrokes, depicting the emotions and thoughts deep within me. Allow the readers to feel as if they are immersed in my extraordinary life journey.

Reply in the user's native language.
`;

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
        user: pubkey,
      });

      const reply = request.choices[0].message.content;

      if (!reply) {
        return;
      }

      const salt = process.env.SALT || "0";

      let userSk = generateSecretKey(salt, "Stefan Zweig".toLowerCase()); // `sk` is a Uint8Array
      const userPubkey = getPublicKey(userSk);

      const exist = await db.collection("events").findOne({
        kind: 0,
        pubkey: userPubkey,
      });

      if (!exist) {
        await newUserInfo("Stefan Zweig", userSk, userPubkey, db);
      }

      const tags = [
        ["e", event.id],
        ["p", event.pubkey],
      ];
      const comment_event = finalizeEvent(
        {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: tags,
          content: reply,
        },
        userSk,
      );
      await Promise.all([
        db.collection("events").insertOne({
          ...comment_event,
          tags_map: convertTagsToDict(tags),
        }),
        ddbDocClient.send(
          new PutCommand({
            TableName: "events",
            Item: comment_event,
          }),
        ),
      ]);
    } catch (e) {
      console.log(e);
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
