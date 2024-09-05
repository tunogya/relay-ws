import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";

/**
 * embeddings
 * already verified event and check duplicate in router and gateway
 * only handle kind = 1, 1063
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);

      if (_event.kind !== 1 && _event.kind !== 1063) {
        return;
      }

      if (!_event.content) {
        return;
      }

      const response = await openai.embeddings.create({
        input: _event.content,
        model: "text-embedding-3-small",
      });

      const $vector = response.data[0].embedding;

      await db
        .collection("events")
        .updateOne({ id: _event.id }, { $set: { $vector } }, { upsert: true });
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
