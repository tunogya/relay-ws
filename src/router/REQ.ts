import { Handler, APIGatewayEvent } from "aws-lambda";
import redisClient from "../utils/redisClient";
// @ts-ignore
import { Filter } from "nostr-tools/filter";
import { connectToDatabase } from "../utils/astradb";
import apiGatewayClient from "../utils/apiGatewayClient";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

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
    if (
      authors &&
      authors.length === 1 &&
      kinds &&
      kinds.length === 1 &&
      kinds[0] === 1
    ) {
      const pubkey = authors[0];
      if (pubkey) {
        await redisClient.set(`p2cid:${pubkey}`, connectionId);
      }
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
      const event = await cursor.next();
      try {
        await apiGatewayClient.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(["EVENT", subscription_id, event]),
          }),
        );
      } catch (e) {
        console.log(e);
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
