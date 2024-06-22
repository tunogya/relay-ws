import { APIGatewayEvent, Handler } from "aws-lambda";
import redisClient from "../utils/redisClient";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  let authorization = event.headers["Authorization"];
  if (!authorization) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  } else {
    authorization = Buffer.from(authorization.split("Basic ")[1]).toString(
      "base64",
    );
    const pubkey = authorization.split(":")[0];
    await redisClient.set(
      `pubkey2conn:${pubkey}`,
      event.requestContext.connectionId,
      {
        ex: 24 * 60 * 60,
      },
    );
  }
  return {
    statusCode: 200,
  };
};
