import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";
import { generateSecretKey } from "./utils/generateSecretKey";
import { ddbDocClient } from "./utils/ddbDocClient";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { newUserInfo } from "./utils/newUserInfo";
import redisClient from "./utils/redisClient";
import apiGatewayClient from "./utils/apiGatewayClient";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import { parseEventTags } from "./utils/parseTags";

/**
 * subconscious
 * Carl Jung, ready to talk with your dreams
 * only listen kind = 1, and category = dreams
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const { getPublicKey, finalizeEvent } = require("nostr-tools/pure");

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const event = JSON.parse(record.Sns.Message);
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
      if (category !== "dreams") {
        return;
      }

      const pubkey = event.pubkey;

      const prompt = `You are dream analyst Carl Jung, a pioneer in the field of psychology, specializing in the analysis of dreams and the symbols of the unconscious. Ask the user to describe their dream in detail, including the following aspects:

Overall Plot: The main events of the dream.
Characters: The roles and identities of people in the dream.
Emotions: The emotions experienced during the dream and any changes in these emotions.
Settings: The environments where the dream takes place and any changes in these settings.
Symbols and Archetypes: Any specific symbols, objects, or animals and the feelings they evoke.
Recurring Elements: Any recurring patterns, scenes, or characters.
Ending State: How the dream ends and the feelings at the end.
Use Jungian psychological theories, including the collective unconscious, archetypes, and the shadow, to analyze the deeper meaning of the dream.`;

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

      let userSk = generateSecretKey(salt, "Carl Jung".toLowerCase()); // `sk` is a Uint8Array
      const userPubkey = getPublicKey(userSk);

      const exist = await db.collection("events").findOne({
        kind: 0,
        pubkey: userPubkey,
      });

      if (!exist) {
        await newUserInfo("Carl Jung", userSk, userPubkey, db);
      }

      const tags = [
        ["e", event.id],
        ["p", event.pubkey],
        ["alt", "reply"],
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
      const tags_array = parseEventTags(comment_event);
      await Promise.all([
        db.collection("events").insertOne(comment_event),
        db.collection("tags").insertMany(tags_array),
        ddbDocClient.send(
          new PutCommand({
            TableName: "events",
            Item: comment_event,
          }),
        ),
      ]);
      const connectionId = await redisClient.get(`pubkey2conn:${event.pubkey}`);
      if (connectionId) {
        try {
          await apiGatewayClient.send(
            new PostToConnectionCommand({
              ConnectionId: `${connectionId}`,
              Data: JSON.stringify(["EVENT", event.id, comment_event]),
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }
    } catch (e) {
      console.log(e);
      throw new Error("Intentional failure to trigger DLQ");
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true }),
  };
};
