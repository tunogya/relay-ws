import { Handler, APIGatewayEvent } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const connectionId = event.requestContext.connectionId;
  const client = new ApiGatewayManagementApiClient({
    endpoint: `https://relay.abandon.ai`,
    region: "ap-northeast-1",
  });

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
  };
};
