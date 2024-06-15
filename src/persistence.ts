import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import { convertTagsToDict } from "./utils/convertTagsToDict";
import { ddbDocClient } from "./utils/ddbDocClient";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

/**
 * persistence
 * check nostr events and save to db
 * need to parse tags_map for db query
 * listen all kind
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const event = JSON.parse(record.Sns.Message);
      const { verifyEvent } = require("nostr-tools/pure");
      const isValid = verifyEvent(event);

      if (!isValid) {
        return;
      }

      // parse tags to tags_map, for db query
      const tags_map = convertTagsToDict(event.tags);

      let filter, update;
      if (event.kind === 0) {
        filter = { kind: 0, pubkey: event.pubkey };
        update = {
          $set: {
            id: event.id,
            content: event.content,
            tags: event.tags,
            sig: event.sig,
            created_at: event.created_at,
            tags_map,
          },
        };
      } else if (event.kind === 1) {
        filter = { kind: 1, id: event.id };
        update = {
          $set: {
            pubkey: event.pubkey,
            content: event.content,
            tags: event.tags,
            sig: event.sig,
            created_at: event.created_at,
            tags_map,
          },
        };
      }

      if (filter && update) {
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: event,
            }),
          ),
        ]);
      }
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
