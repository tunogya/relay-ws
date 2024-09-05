import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import redisClient from "../utils/redisClient";
import apiGatewayClient from "../utils/apiGatewayClient";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

/**
 * boardcast gateway
 * listen all valid and invalid events
 * handle all valid and invalid events
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const _event = JSON.parse(record.Sns.Message);

      // handle events
      for (const tag of _event.tags) {
        if (tag?.[0] === "p") {
          const pubkey = tag?.[1];
          const connectionId = await redisClient.get(`pubkey2conn:${pubkey}`);
          if (connectionId) {
            try {
              await apiGatewayClient.send(
                new PostToConnectionCommand({
                  ConnectionId: `${connectionId}`,
                  Data: JSON.stringify(["EVENT", _event.id, _event]),
                }),
              );
              console.log(
                "Successfully sent message to connection",
                connectionId,
              );
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    } catch (_) {
      throw new Error("Intentional failure to trigger DLQ");
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true }),
  };
};
