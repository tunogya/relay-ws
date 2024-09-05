import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import sqsClient from "../utils/sqsClient";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

/**
 * base gateway
 * listen all valid events
 * handle all valid events
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const _event = JSON.parse(record.Sns.Message);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        console.log("invalid event");
        return;
      }

      // $persistence
      try {
        await sqsClient.send(
          new SendMessageCommand({
            MessageBody: JSON.stringify(_event),
            QueueUrl:
              "https://sqs.ap-northeast-1.amazonaws.com/913870644571/persistence.fifo",
            MessageDeduplicationId: _event.id,
            MessageGroupId: _event.pubkey,
          }),
        );
        console.log("Send event to SQS: persistence.fifo");
      } catch (e) {
        console.log(e);
      }

      // $embeddings
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
        console.log("Send event to SQS: embeddings.fifo");
      } catch (e) {
        console.log(e);
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
