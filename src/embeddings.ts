import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import openai from "./utils/openai";

/**
 * embeddings
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const message = JSON.parse(record.Sns.Message);
      if (!message.content) {
        return;
      }
      const response = await openai.embeddings.create({
        input: message.content,
        model: "text-embedding-3-small",
      });
      const $vector = response.data[0].embedding;

      await db
        .collection("events")
        .updateOne({ id: message.id }, { $set: { $vector } }, { upsert: true });
    } catch (e) {
      console.log(e);
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
};
