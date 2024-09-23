import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import openai from "../utils/openai";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase } from "../utils/astradb";
import { embedding } from "../utils/embedding";

/**
 * chat
 * only handle kind 14, and role = user
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);

      if (_event.kind !== 14) {
        return;
      }

      const pubkey = _event.sig;
      const { db } = await connectToDatabase();

      const userInfo = await db.collection("events").findOne({
        kind: 0,
        pubkey: pubkey,
      });

      // get memory of user
      const similarPosts = await db
        .collection("events")
        .find(
          {
            pubkey: pubkey,
          },
          {
            vector: await embedding(_event.content),
            limit: 10,
            projection: {
              $vector: 0,
            },
          },
        )
        .toArray();

      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `This is your BIO: ${userInfo?.content || "NULL"}`,
          },
          {
            role: "user",
            content: _event.content,
          },
          {
            role: "system",
            content: `This is your worldview and values: ${
              similarPosts.map((event) => event.content).join(", ") ?? "NULL"
            }. Please summarize and reply to the user.`,
          },
        ],
      });

      const content = chatCompletion.choices[0].message.content;
      if (content) {
        // boardcast a message to client
        // don't handle this message
        await snsClient.send(
          new PublishCommand({
            TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
            Message: JSON.stringify({
              id: uuidv4(),
              kind: 14,
              pubkey: _event.sig.replace(_event.pubkey, ""),
              created_at: Math.floor(Date.now() / 1000),
              content: content,
              tags: [
                ["p", _event.pubkey],
                ["role", "assistant"],
              ],
              sig: _event.sig,
            }),
            MessageAttributes: {
              kind: {
                DataType: "Number",
                StringValue: "14",
              },
              role: {
                DataType: "String",
                StringValue: "assistant",
              },
            },
          }),
        );
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
