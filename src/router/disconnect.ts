import { APIGatewayEvent, Handler } from "aws-lambda";
import redisClient from "../utils/redisClient";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const connectionId = event.requestContext.connectionId;
  try {
    const pubkey = await redisClient.get(`conn2pubkey:${connectionId}`);
    await redisClient
      .pipeline()
      .decr("ws:connected")
      .del(`pubkey2conn:${pubkey}`)
      .del(`conn2pubkey:${connectionId}`)
      .exec();
  } catch (e) {
    console.log(e);
  }
  return {
    statusCode: 200,
  };
};
