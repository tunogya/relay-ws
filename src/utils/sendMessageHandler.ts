import { PublishCommand } from "@aws-sdk/client-sns";
import snsClient from "./snsClient";
import { v4 as uuidv4 } from "uuid";

export const sendMessageHandler = async (params: string) => {
  console.log(params);
  try {
    const { pubkey, content, sig, tags } = JSON.parse(params);
    const result = await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
        Message: JSON.stringify({
          id: uuidv4(),
          pubkey: pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 14,
          content: content,
          tags: tags,
          sig: sig,
        }),
        MessageAttributes: {
          kind: {
            DataType: "Number",
            StringValue: "14",
          },
        },
      }),
    );
    if (result.MessageId) {
      return {
        ok: true,
        message: "send message successful",
      };
    }
  } catch (e) {
    return {
      ok: false,
      message: `error: ${e}`,
    };
  }
};
