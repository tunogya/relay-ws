import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import sqsClient from "../utils/sqsClient";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

/**
 * AI gateway
 * listen all events
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

      let queue_url = "";

      switch (_event.kind) {
        case 0:
          // persistence
          queue_url =
            "https://sqs.ap-northeast-1.amazonaws.com/913870644571/persistence.fifo";
          break;
        case 1:
          // persistence
          queue_url =
            "https://sqs.ap-northeast-1.amazonaws.com/913870644571/persistence.fifo";
          break;
        case 5:
          // delete
          queue_url =
            "https://sqs.ap-northeast-1.amazonaws.com/913870644571/delete.fifo";
          break;
        default:
          break;
      }

      if (queue_url) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              MessageBody: JSON.stringify(_event),
              QueueUrl: queue_url,
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
