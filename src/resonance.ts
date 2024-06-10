import { Handler, SNSEvent } from "aws-lambda";

/**
 * resonance
 * Find some resonance for you
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;
  for (const record of records) {
    console.log(record);
  }

  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
};
