import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "./utils/astradb";
import { ddbDocClient } from "./utils/ddbDocClient";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

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
      const isValid = verifyEvent(event);

      if (!isValid) {
        return;
      }

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
          },
        };
        let tagsArray = [];
        for (const tag of event.tags) {
          const length = tag.length;
          if (length < 2) {
            continue;
          }
          const item: any = {
            id: event.id,
          };
          for (let i = 0; i < length; i++) {
            item[`tag${i}`] = tag[i];
          }
          tagsArray.push(item);
        }
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          db.collection("tags").insertMany(tagsArray),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: event,
            }),
          ),
        ]);
      } else if (event.kind === 1) {
        filter = { kind: 1, id: event.id };
        update = {
          $set: {
            pubkey: event.pubkey,
            content: event.content,
            tags: event.tags,
            sig: event.sig,
            created_at: event.created_at,
          },
        };
        let tagsArray = [];
        for (const tag of event.tags) {
          const length = tag.length;
          if (length < 2) {
            continue;
          }
          const item: any = {
            id: event.id,
          };
          for (let i = 0; i < length; i++) {
            item[`tag${i}`] = tag[i];
          }
          tagsArray.push(item);
        }
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          db.collection("tags").insertMany(tagsArray),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: event,
            }),
          ),
        ]);
      } else if (event.kind === 5) {
        const tags = event.tags;
        const ids = tags.map((item) => item[1]);
        for (const id of ids) {
          await Promise.all([
            db.collection("events").deleteOne({ id: id }),
            ddbDocClient.send(
              new DeleteCommand({
                TableName: "events",
                Key: {
                  id: id,
                },
              }),
            ),
          ]);
        }
      }
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
