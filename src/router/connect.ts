import { APIGatewayEvent, Handler } from "aws-lambda";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  };
};
