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
  // handle chat message
  // @ts-ignore
  const { id, kind, pubkey, created_at, content, tags, sig } = messageArray[1];
  try {
    console.log("Check event valid...");
    let isValid;
    try {
      // check invalid
      isValid = verifyEvent({
        id,
        kind,
        pubkey,
        created_at,
        content,
        tags,
        sig,
      });
    } catch (e) {
      isValid = false;
    }
    if (kind === 14) {
      isValid = true;
    }
    if (!isValid) {
      console.log("The event is invalid!");
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
    console.log("The event is valid!");
    const { db } = await connectToDatabase();
    const event = await db.collection("events").findOne({
      id: id,
    });
    if (event) {
      console.log("duplicate: this event already exist.");
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
      console.log("Event received successfully.");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["OK", id, true, `Event received successfully.`]),
      };
    } else {
      console.log("error: SNS send error.");
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
