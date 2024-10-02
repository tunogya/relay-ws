import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import openai from "../utils/openai";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase } from "../utils/astradb";
import { embedding } from "../utils/embedding";

/**
 * chat
 * only handle kind 14, and role = user
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);

      if (_event.kind !== 14) {
        return;
      }

      const pubkey = _event.sig;
      const { db } = await connectToDatabase();

      const userInfo = await db.collection("events").findOne({
        kind: 0,
        pubkey: pubkey,
      });

      // tags: [["history", "chat1", "chat2", ...]]

      let historyChatContent = "";

      // get history chat from _event.tags
      const historyChat = _event.tags.find((tag: any) => tag[0] === "history");
      if (historyChat) {
        historyChatContent = historyChat.slice(1).join("/n");
      }

      const content_with_history = `${historyChatContent}\n\n${_event.content}`;

      // get memory of user
      const similarPosts = await db
        .collection("events")
        .find(
          {
            pubkey: pubkey,
          },
          {
            vector: await embedding(content_with_history),
            limit: 10,
            projection: {
              $vector: 0,
            },
          },
        )
        .toArray();

      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant embodying a specific persona. Use the following information to shape your responses:

1. Personal Biography:
${userInfo?.content || "No specific biography available."}

2. Conversation History:
${historyChatContent || "No specific conversation history available."}

3. Worldview and Values:
${
  similarPosts.map((event) => event.content).join(", ") ||
  "No specific worldview or values available."
}

Based on this information, respond to the user's message in a way that reflects this persona's unique personality, knowledge, and perspective. Maintain consistency with the provided background and previous interactions.`,
          },
          {
            role: "user",
            content: _event.content,
          },
        ],
      });

      const content = chatCompletion.choices[0].message.content;
      if (content) {
        // boardcast a message to client
        // don't handle this message
        await snsClient.send(
          new PublishCommand({
            TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
            Message: JSON.stringify({
              id: uuidv4(),
              kind: 14,
              pubkey: _event.sig.replace(_event.pubkey, ""),
              created_at: Math.floor(Date.now() / 1000),
              content: content,
              tags: [
                ["p", _event.pubkey],
                ["role", "assistant"],
              ],
              sig: _event.sig,
            }),
            MessageAttributes: {
              kind: {
                DataType: "Number",
                StringValue: "14",
              },
              role: {
                DataType: "String",
                StringValue: "assistant",
              },
            },
          }),
        );
      }
    } catch (e) {
      console.log(e);
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
