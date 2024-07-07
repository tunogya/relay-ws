import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * moderation
 * only listen kind = 1
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

      if (!_event.content) {
        return;
      }

      const moderation = await openai.moderations.create({
        input: _event.content,
      });
      const possibly_sensitive = moderation.results[0].flagged;

      await db
        .collection("events")
        .updateOne(
          { id: _event.id },
          { $set: { possibly_sensitive } },
          { upsert: true },
        );
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
