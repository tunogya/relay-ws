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
  // // pubkey = subscription_id
  // await redisClient.set(`p2cid:${subscription_id}`, connectionId, {
  //   ex: 24 * 60 * 60,
  // });
  const filters: Filter[] = messageArray?.slice(2) || [];

  const { db } = await connectToDatabase();

  const handleFiltersX = async (filter: Filter) => {
    const { ids, authors, kinds, limit, search, since, until } = filter;
    const query: Record<string, any> = {};
    if (ids && ids.length > 0) {
      query.id = { $in: ids };
    }
    if (authors && authors.length > 0) {
      query.pubkey = { $in: authors };
    }
    if (kinds && kinds.length > 0) {
      query.kind = { $in: kinds };
    }
    if (since) {
      query.created_at = { $gte: since };
    }
    if (until) {
      query.created_at = {
        ...query.created_at,
        $lte: until,
      };
    }
    const cursor = db
      .collection("events")
      .find(query)
      .limit(limit || 20);
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
          await apiGatewayClient
            .send(
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
            )
            .catch((e) => console.log(e));
        }
      }
    }
  };

  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
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
