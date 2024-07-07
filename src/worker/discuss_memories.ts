import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
import { generateSecretKey } from "../utils/generateSecretKey";
import { newUserInfo } from "../utils/newUserInfo";
// @ts-ignore
import { getPublicKey, finalizeEvent, verifyEvent } from "nostr-tools/pure";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";

/**
 * discuss memories
 * only listen kind = 1
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      if (_event.kind !== 1) {
        return;
      }

      const pubkey = _event.pubkey;

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
            content: _event.content,
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
        ["e", _event.id],
        ["p", _event.pubkey],
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

      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
          Message: JSON.stringify(comment_event),
          MessageAttributes: {
            kind: {
              DataType: "Number",
              StringValue: comment_event.kind.toString(),
            },
            premium: {
              DataType: "Number",
              StringValue: "0", // bot is not premium user
            },
          },
        }),
      );
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
