import { APIGatewayEvent, Handler } from "aws-lambda";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const connectionId = event.requestContext.connectionId;
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectionId: connectionId,
    }),
  };
};
