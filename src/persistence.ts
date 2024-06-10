import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import { convertTagsToDict } from "./utils/convertTagsToDict";

/**
 * persistence
 * check nostr events and save to db
 * need to parse tags_map for db query
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const message = JSON.parse(record.Sns.Message);
      // parse tags to tags_map, for db query
      const tags_map = convertTagsToDict(message.tags);

      let filter, update;
      if (message.kind === 0) {
        filter = { kind: 0, pubkey: message.pubkey };
        update = {
          $set: {
            id: message.id,
            content: message.content,
            tags: message.tags,
            sig: message.sig,
            created_at: message.created_at,
            tags_map,
          },
        };
      } else if (message.kind === 1) {
        filter = { kind: 1, id: message.id };
        update = {
          $set: {
            pubkey: message.pubkey,
            content: message.content,
            tags: message.tags,
            sig: message.sig,
            created_at: message.created_at,
            tags_map,
          },
        };
      }

      if (filter && update) {
        await db
          .collection("events")
          .updateOne(filter, update, { upsert: true });
      }
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
