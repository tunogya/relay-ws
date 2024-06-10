import { Handler, SNSEvent } from "aws-lambda";
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

  for (const record of records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      // parse tags to tags_map, for db query
      const tags_map = convertTagsToDict(message.tags);
      if (message.kind === 0) {
        // need to replace with same pubkey
        return await db.collection("events").updateOne(
          {
            kind: 0, // must be 0
            pubkey: message.pubkey, // must be same pubkey
          },
          {
            $set: {
              id: message.id, // can be different
              content: message.content, // can be different
              tags: message.tags, // can be different
              sig: message.sig, // can be different
              created_at: message.created_at, // can be different
              tags_map, // for db query
            },
          },
        );
      } else if (message.kind === 1) {
        // message's id can inserted first
        // so need to replace with same id
        return await db.collection("events").updateOne(
          {
            kind: 1, // must be 1
            id: message.id, // must be same id
          },
          {
            $set: {
              pubkey: message.pubkey, // maybe inserted first, but not inserted
              content: message.content, // inserted
              tags: message.tags, // inserted
              sig: message.sig, // inserted
              created_at: message.created_at, // inserted
              tags_map, // for db query
            },
          },
        );
      }
    } catch (e) {
      console.log(e);
    }
  }

  console.log(`Successfully processed ${records.length} records.`);
  return {
    success: true,
    count: records.length,
  };
};
