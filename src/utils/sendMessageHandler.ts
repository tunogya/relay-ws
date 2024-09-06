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

const sendMessage = {
  type: "function",
  function: {
    name: "sendMessage",
    description: "",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "Id is uuidv4 code is chat message. You can ignore this field because it will be automatically generated during actual execution.",
        },
        created_at: {
          type: "number",
          description:
            "The created_at property is a UNIX timestamp set by the event creator, normally to the time it was created. You can ignore this field because it will be automatically generated during actual execution.",
        },
        kind: {
          type: "number",
          description: "If you want to send a chat message, kind is 14.",
        },
        pubkey: {
          type: "string",
          description: "Public key of the event creator.",
        },
        content: {
          type: "string",
          description: "In the case of kind:14, content is chat message.",
        },
        sig: {
          type: "string",
          description:
            "In the case of kind:14, sig is roomId, which is the same code of received event.sig.",
        },
        tags: {
          type: "array",
          description:
            'Each tag is an array of one or more strings, with some conventions around them. In the case of kind:14, tags need `p` to mention a public key. For example: [["p": <mention_pubkey>]]',
        },
      },
      required: ["pubkey", "content", "sig", "tags"],
      additionalProperties: false,
    },
  },
};
