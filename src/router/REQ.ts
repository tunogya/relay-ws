import { Handler, APIGatewayEvent } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const connectionId = event.requestContext.connectionId;
  const callbackUrl = `https://relay.abandon.ai`;
  const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: "Hello!",
      }),
    );
  } catch (error) {
    console.log(error);
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  };
};
