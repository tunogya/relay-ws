import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * embeddings
 * only listen kind = 1
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const event = JSON.parse(record.Sns.Message);
      const isValid = verifyEvent(event);

      if (!isValid) {
        return;
      }

      if (event.kind !== 1) {
        return;
      }

      if (!event.content) {
        return;
      }

      const response = await openai.embeddings.create({
        input: event.content,
        model: "text-embedding-3-small",
      });

      const $vector = response.data[0].embedding;

      await db
        .collection("events")
        .updateOne({ id: event.id }, { $set: { $vector } }, { upsert: true });
    } catch (_) {
      throw new Error("Intentional failure to trigger DLQ");
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
};
