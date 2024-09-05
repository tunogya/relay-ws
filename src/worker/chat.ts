import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * chat
 * only handle kind 14
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

      if (_event.kind !== 14) {
        return;
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
