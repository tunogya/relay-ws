import { APIGatewayEvent, Handler } from "aws-lambda";
import redisClient from "../utils/redisClient";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  let authorization = event.headers["Authorization"];
  if (!authorization) {
    return {
      statusCode: 401,
    };
  }
  authorization = Buffer.from(authorization.split("Basic ")[1]).toString(
    "base64",
  );
  const pubkey = authorization.split(":")[0];
  const connectionId = event.requestContext.connectionId;
  await redisClient
    .pipeline()
    .incr("ws:connected")
    .set(`conn2pubkey:${connectionId}`, pubkey, {
      ex: 24 * 60 * 60,
    })
    .set(`pubkey2conn:${pubkey}`, connectionId, {
      ex: 24 * 60 * 60,
    })
    .exec();
  return {
    statusCode: 200,
  };
};
