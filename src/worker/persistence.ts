import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import { ddbDocClient } from "../utils/ddbDocClient";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

/**
 * persistence
 * check nostr events and save to db, or delete it
 * already verified event and check duplicate in router and gateway
 * only handle kind = 0, 1, 5, 1063
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);

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
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: _event,
            }),
          ),
        ]);
      } else if (_event.kind === 1 || _event.kind === 1063) {
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
        await Promise.all([
          db.collection("events").updateOne(filter, update, { upsert: true }),
          ddbDocClient.send(
            new PutCommand({
              TableName: "events",
              Item: _event,
            }),
          ),
        ]);
      } else if (_event.kind === 5) {
        const tags = _event.tags;
        const ids = tags.map((item: any) => item[1]);
        for (const id of ids) {
          try {
            await Promise.all([
              // delet events
              db.collection("events").deleteOne({ id: id }),
              // delete dynamodb backup
              ddbDocClient.send(
                new DeleteCommand({
                  TableName: "events",
                  Key: {
                    id: id,
                  },
                }),
              ),
            ]);
          } catch (e) {
            console.log(e);
          }
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
