import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import redisClient from "../utils/redisClient";
import apiGatewayClient from "../utils/apiGatewayClient";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

/**
 * boardcast
 * listen kind = 1, 4
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      if (_event.kind !== 1 && _event.kind !== 4) {
        return;
      }

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
