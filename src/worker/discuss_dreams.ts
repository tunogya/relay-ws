import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
import { generateSecretKey } from "../utils/generateSecretKey";
import { newUserInfo } from "../utils/newUserInfo";
// @ts-ignore
import { verifyEvent, getPublicKey, finalizeEvent } from "nostr-tools/pure";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";

/**
 * discuss dreams
 * talk with your dreams
 * only listen kind = 1
 * @deprecated
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

      const result = await snsClient.send(
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

      if (!result.MessageId) {
        console.log("Error: SNS");
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
