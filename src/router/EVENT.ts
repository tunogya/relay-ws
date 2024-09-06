import { Handler, APIGatewayEvent } from "aws-lambda";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";
import { connectToDatabase } from "../utils/astradb";

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
    // check invalid
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

    const { db } = await connectToDatabase();
    const event = await db.collection("events").findOne({
      id: id,
    });
    if (event) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          "OK",
          id,
          false,
          `duplicate: this event already exist.`,
        ]),
      };
    }

    // TODO: check pow

    // TODO: check blocked

    // TODO: check rate-limited

    const result = await snsClient.send(
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
        },
      }),
    );

    if (result.MessageId) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["OK", id, true, `Event received successfully.`]),
      };
    } else {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["OK", id, false, `error: SNS send error.`]),
      };
    }
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["OK", id, false, `error: ${e}.`]),
    };
  }
};
