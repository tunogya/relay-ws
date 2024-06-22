import { APIGatewayEvent, Handler } from "aws-lambda";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  // pubkey = subscription_id;
  // await redisClient.del(`p2cid:${subscription_id}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  };
};
