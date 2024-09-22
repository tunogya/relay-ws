import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import openai from "../utils/openai";
import snsClient from "../utils/snsClient";
import redisClient from "../utils/redisClient";
import { PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";

/**
 * chat
 * only handle kind 14
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);

      if (_event.kind !== 14) {
        return;
      }

      // boardcast a message to client
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
          Message: JSON.stringify({
            id: uuidv4(),
            kind: 14,
            pubkey: _event.sig.replace(_event.pubkey, ""),
            created_at: Math.floor(Date.now() / 1000),
            content: "收到消息",
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
