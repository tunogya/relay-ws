import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { v4 as uuidv4 } from "uuid";
import { embedding } from "../utils/embedding";

/**
 * discuss
 * only listen kind = 1 and 1063
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);
      const index = Number(record.messageAttributes["index"].stringValue || 0);
      const isValid = verifyEvent(_event);

      const pList = _event.tags.filter((i: any) => i[0] === "p");
      const aiPubkey = pList[index][1];

      if (!isValid) {
        return;
      }

      if (_event.kind !== 1 && _event.kind !== 1063) {
        return;
      }

      const pubkey = _event.pubkey;

      const profile = await db.collection("events").findOne({
        kind: 0,
        pubkey: aiPubkey,
      });
      const prompt = `This is your profile: ${JSON.stringify(profile || {})}`;

      // search similar posts, incloud comments
      const similarPosts = await db
        .collection("events")
        .find(
          {
            $or: [
              {
                kind: 1,
                pubkey: aiPubkey,
              },
              {
                kind: 1603,
                pubkey: aiPubkey,
              },
            ],
          },
          {
            vector: await embedding(_event.content),
            limit: 10,
            projection: {
              sig: 0,
              $vector: 0,
            },
          },
        )
        .toArray();

      const request = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: prompt,
          },
          ...similarPosts.map(
            (item) =>
              ({
                role: "assistant",
                content: item.content,
              }) as ChatCompletionMessageParam,
          ),
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

      const result = await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
          Message: JSON.stringify({
            id: uuidv4(),
            pubkey: aiPubkey,
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: reply,
            tags: [
              ["e", _event.id],
              ["p", _event.pubkey],
              ["alt", "reply"],
            ],
            sig: "",
          }),
          MessageAttributes: {
            kind: {
              DataType: "Number",
              StringValue: "1",
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
