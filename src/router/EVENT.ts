import { Handler, APIGatewayEvent } from "aws-lambda";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

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
          `Invalid: signature verification failed.`,
        ]),
      };
    }
    const category =
      tags.find((tag: any[]) => tag[0] === "category")?.[1] || undefined;
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
          ...(category && {
            category: { DataType: "String", StringValue: category },
          }),
        },
      }),
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["OK", id, true, `Event received successfully.`]),
    };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["OK", id, false, e]),
    };
  }
};
