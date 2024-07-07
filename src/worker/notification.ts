import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * notification
 * listen kind = 1, 4
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      for (const tag of _event.tags) {
        if (tag?.[0] === "p") {
          const pubkey = tag?.[1];
          // TODO query push token and send notification
        }
      }
    } catch (_) {
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
