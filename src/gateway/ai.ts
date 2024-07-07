import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import sqsClient from "../utils/sqsClient";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

/**
 * AI gateway
 * only listen kind = 1, premium = 1
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const _event = JSON.parse(record.Sns.Message);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      if (_event.kind !== 1) {
        return;
      }

      // $discuss_reflections
      if (
        _event.tags.some(
          (item) => item?.[0] === "category" && item?.[1] === "reflections",
        )
      ) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/discuss_reflections.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }

      // $discuss_memories
      if (
        _event.tags.some(
          (item) => item?.[0] === "category" && item?.[1] === "memories",
        )
      ) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/discuss_memories.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }

      // $discuss_dreams
      if (
        _event.tags.some(
          (item) => item?.[0] === "category" && item?.[1] === "dreams",
        )
      ) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/discuss_dreams.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }

      // $embeddings
      if (_event.content) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/embeddings.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }

      // $moderation
      if (_event.content) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/moderation.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }

      // $xray
      if (_event.content) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl:
                "https://sqs.ap-northeast-1.amazonaws.com/913870644571/xray.fifo",
              MessageDeduplicationId: _event.id,
              MessageGroupId: _event.pubkey,
            }),
          );
        } catch (e) {
          console.log(e);
        }
      }
    } catch (e) {
      console.log(e);
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
