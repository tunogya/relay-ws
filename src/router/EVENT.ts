import { Handler, APIGatewayEvent } from "aws-lambda";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/*
 * From client to relay:
 * ["EVENT", {id, kind, pubkey, created_at, content, tags, sig}]
 *
 * From relay to client:
 * ["OK", <event_id>, <true|false>, <message>]
 *
 * message: duplicate, pow, blocked, rate-limited, invalid, and error
 */
export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const messageArray = JSON.parse(
    // @ts-ignore
    event.body,
  );
  // @ts-ignore
  const { id, kind, pubkey, created_at, content, tags, sig } = messageArray[1];
  try {
    const isValid = verifyEvent({
      id,
      kind,
      pubkey,
      created_at,
      content,
      tags,
      sig,
    });
    if (!isValid) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          "OK",
          id,
          false,
          `invalid: signature verification failed.`,
        ]),
      };
    }
    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
        Message: JSON.stringify({
          id,
          kind,
          pubkey,
          created_at,
          content,
          tags,
          sig,
        }),
        MessageAttributes: {
          kind: {
            DataType: "Number",
            StringValue: kind.toString(),
          },
          premium: {
            DataType: "Number",
            // TODO: Premium users
            StringValue: "1",
          },
        },
      }),
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["OK", id, true, `Event received successfully.`]),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["OK", id, false, `error: ${e}`]),
    };
  }
};
