import { ddbDocClient } from "./ddbDocClient";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { Db } from "@datastax/astra-db-ts";

export const newUserInfo = async (
  name: string,
  userSk: Uint8Array,
  userPubkey: string,
  db: Db,
) => {
  const randomNumber = Math.floor(Math.random() * 10000);
  const { finalizeEvent } = require("nostr-tools/pure");
  const kind0_event = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: name,
        picture: `https://www.larvalabs.com/cryptopunks/cryptopunk${randomNumber
          .toString()
          .padStart(4, "0")}.png`,
      }),
    },
    userSk,
  );
  try {
    await Promise.all([
      db.collection("events").updateOne(
        {
          kind: 0,
          pubkey: userPubkey,
        },
        {
          $set: {
            id: kind0_event.id,
            kind: kind0_event.kind,
            content: kind0_event.content,
            tags: kind0_event.tags,
            sig: kind0_event.sig,
            created_at: kind0_event.created_at,
          },
        },
        {
          upsert: true,
        },
      ),
      ddbDocClient.send(
        new PutCommand({
          TableName: "events",
          Item: kind0_event,
        }),
      ),
    ]);
  } catch (e) {
    console.log(e);
  }
};
