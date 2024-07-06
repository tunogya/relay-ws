import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import { ddbDocClient } from "../utils/ddbDocClient";
import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import { parseEventTags } from "../utils/parseTags";

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
      const _event = JSON.parse(record.Sns.Message);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      let filter, update;
      if (_event.kind === 0) {
        filter = { kind: 0, pubkey: _event.pubkey };
        update = {
          $set: {
            id: _event.id,
            content: _event.content,
            tags: _event.tags,
            sig: _event.sig,
            created_at: _event.created_at,
          },
        };
        let tagsArray = [];
        for (const tag of _event.tags) {
          const length = tag.length;
          if (length < 2) {
            continue;
          }
          const item: any = {
            id: _event.id,
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
              Item: _event,
            }),
          ),
        ]);
      } else if (_event.kind === 1) {
        filter = { kind: 1, id: _event.id };
        update = {
          $set: {
            pubkey: _event.pubkey,
            content: _event.content,
            tags: _event.tags,
            sig: _event.sig,
            created_at: _event.created_at,
          },
        };
        const tags_array = parseEventTags(_event);
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          db.collection("tags").insertMany(tags_array),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: _event,
            }),
          ),
        ]);
      } else if (_event.kind === 5) {
        const tags = _event.tags;
        const ids = tags.map((item) => item[1]);
        for (const id of ids) {
          await Promise.all([
            db.collection("events").deleteOne({ id: id }),
            db.collection("tags").deleteMany({
              id: id,
            }),
            db.collection("contents").deleteMany({
              id: id,
            }),
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
