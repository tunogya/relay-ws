import { APIGatewayEvent, Handler } from "aws-lambda";
import redisClient from "../utils/redisClient";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  console.log(event);
  const pubkey = event?.queryStringParameters?.pubkey;
  const connectionId = event.requestContext.connectionId;
  if (pubkey) {
    await redisClient
      .pipeline()
      .set(`conn2pubkey:${connectionId}`, pubkey, {
        ex: 24 * 60 * 60,
      })
      .set(`pubkey2conn:${pubkey}`, connectionId, {
        ex: 24 * 60 * 60,
      })
      .exec();
  }
  return {
    statusCode: 200,
  };
};
