import { Handler, SNSEvent } from "aws-lambda";

/**
 * callCarlJung
 * Carl Jung, ready to talk with your dreams
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
