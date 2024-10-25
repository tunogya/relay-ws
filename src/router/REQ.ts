import { Handler, APIGatewayEvent } from "aws-lambda";
// @ts-ignore
import { Filter } from "nostr-tools/filter";
import { connectToDatabase } from "../utils/astradb";
import apiGatewayClient from "../utils/apiGatewayClient";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/*
 * From client to relay:
 * ["REQ", <subscription_id>, <filters1>, <filters2>, ...]
 *
 * filtersX:
 * {
 *  "ids": <a list of event ids>,
 *  "authors": <a list of lowercase pubkeys, the pubkey of an event must be one of these>,
 *  "kinds": <a list of a kind numbers>,
 *  "#<single-letter (a-zA-Z)>": <a list of tag values, for #e — a list of event ids, for #p — a list of pubkeys, etc.>,
 *  "since": <an integer unix timestamp in seconds, events must be newer than this to pass>,
 *  "until": <an integer unix timestamp in seconds, events must be older than this to pass>,
 *  "limit": <maximum number of events relays SHOULD return in the initial query>
 * }
 *
 * From relay to client:
 * ["EVENT", <subscription_id>, <event>]
 */

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const connectionId = event.requestContext.connectionId;
  const messageArray = JSON.parse(
    // @ts-ignore
    event.body,
  );
  const subscription_id = messageArray?.[1];
  const filters: Filter[] = messageArray?.slice(2) || [];
  const { db } = await connectToDatabase();

  const handleFiltersX = async (filter: Filter) => {
    const { ids, authors, kinds, limit, since, until } = filter;

    const query: Record<string, any> = {};

    if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
      query.id = { $in: ids };
    }
    if (
      Array.isArray(authors) &&
      authors.every((author) => typeof author === "string")
    ) {
      query.pubkey = { $in: authors };
    }
    if (
      Array.isArray(kinds) &&
      kinds.every((kind) => typeof kind === "number")
    ) {
      query.kind = { $in: kinds };
    }
    if (typeof since === "number") {
      query.created_at = { $gte: since };
    }
    if (typeof until === "number") {
      query.created_at = {
        ...query.created_at,
        $lte: until,
      };
    }

    try {
      const cursor = db
        .collection("events")
        .find(query)
        .limit(typeof limit === "number" ? limit : 20);

      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (doc) {
          const { id, pubkey, kind, created_at, content, tags, sig } = doc;
          const isValid = verifyEvent({
            id,
            pubkey,
            kind,
            created_at,
            content,
            tags,
            sig,
          });
          if (isValid) {
            try {
              await apiGatewayClient.send(
                new PostToConnectionCommand({
                  ConnectionId: connectionId,
                  Data: JSON.stringify([
                    "EVENT",
                    subscription_id,
                    {
                      id: doc.id,
                      pubkey: doc.pubkey,
                      created_at: doc.created_at,
                      kind: doc.kind,
                      content: doc.content,
                      tags: doc.tags,
                      sig: doc.sig,
                    },
                  ]),
                }),
              );
            } catch (e) {
              console.error("Error sending event to connection:", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error querying database:", e);
    }
  };

  for (const filter of filters) {
    if (!filter.ids?.length && !filter.authors?.length) {
      continue; // 跳过
    }
    await handleFiltersX(filter);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      "OK",
      subscription_id,
      true,
      "Subscription was created success.",
    ]),
  };
};
