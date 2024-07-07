import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import { ddbDocClient } from "../utils/ddbDocClient";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * delete
 * listen kind = 5
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

      if (_event.kind !== 5) {
        return;
      }

      const tags = _event.tags;
      const ids = tags.map((item) => item[1]);
      for (const id of ids) {
        try {
          await Promise.all([
            // delet events
            db.collection("events").deleteOne({ id: id }),
            // delete tags
            db.collection("tags").deleteMany({
              id: id,
            }),
            // delete xray-contents
            db.collection("contents").deleteMany({
              id: id,
            }),
            // delete dynamodb backup
            ddbDocClient.send(
              new DeleteCommand({
                TableName: "events",
                Key: {
                  id: id,
                },
              }),
            ),
          ]);
        } catch (e) {
          console.log(e);
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
