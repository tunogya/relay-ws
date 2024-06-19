import { Handler, APIGatewayEvent } from "aws-lambda";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  try {
    // @ts-ignore
    const messageType = JSON.parse(event.body)[0];
    if (messageType !== "EVENT") {
      return;
    }
    // @ts-ignore
    const { id, kind, pubkey, created_at, content, tags, sig } = JSON.parse(
      event.body,
    )[1];
    // isPubkeyAllowed
    if (!isPubkeyAllowed(pubkey)) {
      return {
        statusCode: 200,
        body: JSON.stringify([
          "OK",
          id,
          false,
          "Denied. The pubkey is not allowed.",
        ]),
      };
    }
    // Check if the event kind is allowed
    if (!isEventKindAllowed(kind)) {
      return {
        statusCode: 200,
        body: JSON.stringify([
          "OK",
          id,
          false,
          `Denied. Event kind ${kind} is not allowed.`,
        ]),
      };
    }

    const { verifyEvent } = require("nostr-tools/pure");
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
        body: JSON.stringify([
          "OK",
          id,
          false,
          `Invalid: signature verification failed.`,
        ]),
      };
    }
    const category =
      tags.find((tag: any[]) => tag[0] === "category")?.[1] || undefined;
    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.NOSTR_SNS_ARN,
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
          ...(category && {
            category: { DataType: "String", StringValue: category },
          }),
        },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify(["OK", id, true, `Event received successfully.`]),
    };
  } catch (e) {
    return;
  }
};

const isPubkeyAllowed = (pubkey: string) => {
  return true;
};

const isEventKindAllowed = (kind: number) => {
  return true;
};
