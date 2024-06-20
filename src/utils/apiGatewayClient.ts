import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";

const client = new ApiGatewayManagementApiClient({
  endpoint: `https://relay.abandon.ai`,
  region: "ap-northeast-1",
});

//     await client.send(
//       new PostToConnectionCommand({
//         ConnectionId: connectionId,
//         Data: "Hello!",
//       }),
//     );

export default client;
