import { Handler, SNSEvent } from "aws-lambda";

/**
 * saveEvents
 * check nostr events and save to db
 * need to parse tags_map for db query
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
