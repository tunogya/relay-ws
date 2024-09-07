import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import openai from "../utils/openai";
import redisClient from "../utils/redisClient";
import { executeFunction } from "../utils/executeFunction";
import { v4 as uuidv4 } from "uuid";
import snsClient from "../utils/snsClient";
import { PublishCommand } from "@aws-sdk/client-sns";

/**
 * chat
 * only handle kind 14
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const processRecord = async (record: SQSRecord) => {
    try {
      const _event = JSON.parse(record.body);
      const asstPubkey = _event.tags.filter((i: any) => i[0] === "p")?.[0]?.[1];

      if (_event.kind !== 14) {
        return;
      }

      const assistant_id = "asst_J2Wr8FyeghaDrph8EAbpPvol";

      // find thread_id from cache, if not exist, create one
      // event.sig is room id, which is pubkey+pubkey
      let thread_id = (await redisClient.get(`room2thread:${_event.sig}`)) as
        | string
        | null;
      if (!thread_id) {
        const thread = await openai.beta.threads.create();
        thread_id = thread.id;
        // cache to redis
        await redisClient.set(`room2thread:${_event.sig}`, thread_id);
      }

      // attach current message to thread
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: JSON.stringify(_event),
      });

      try {
        openai.beta.threads.runs
          .stream(thread_id, {
            assistant_id: assistant_id,
          })
          .on("event", async (event) => {
            if (event.event === "thread.run.requires_action") {
              const requiredActions =
                event.data.required_action?.submit_tool_outputs.tool_calls ||
                [];
              const functionCalls = await Promise.all(
                requiredActions.map(async (action) => {
                  return await executeFunction(
                    action.id,
                    action.function.name,
                    action.function.arguments,
                  );
                }),
              );
              console.log(functionCalls);
              openai.beta.threads.runs.submitToolOutputsStream(
                thread_id,
                event.data.id,
                {
                  tool_outputs: functionCalls.map((call) => ({
                    tool_call_id: call?.callId,
                    output: call?.results,
                  })),
                },
              );
            }
          })
          .on("textCreated", async (text) => {
            const event = {
              id: uuidv4(),
              content: text.value,
              pubkey: asstPubkey,
              created_at: Math.floor(Date.now() / 1000),
              kind: 14,
              tags: [
                ["p", _event.pubkey],
                ["role", "assistant"],
              ],
              sig: _event.sig,
            };
            console.log(JSON.stringify(event));
            await snsClient.send(
              new PublishCommand({
                TopicArn: process.env.NOSTR_EVENTS_SNS_ARN,
                Message: JSON.stringify(event),
                MessageAttributes: {
                  kind: {
                    DataType: "Number",
                    StringValue: "14",
                  },
                },
              }),
            );
            console.log("Send chat message.");
          });
      } catch (e) {
        console.log("something went wrong on threads run", e);
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
