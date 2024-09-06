import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
import redisClient from "../utils/redisClient";

/**
 * chat
 * only handle kind 14
 */
export const handler: Handler = async (event: SQSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

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
      const message = await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: JSON.stringify(_event),
      });

      try {
        const run = openai.beta.threads.runs
          .stream(thread_id, {
            assistant_id: assistant_id,
          })
          .on("textCreated", (text) => process.stdout.write("\nassistant > "))
          .on("textDelta", (textDelta, snapshot) =>
            process.stdout.write(textDelta.value),
          )
          .on("toolCallCreated", (toolCall) =>
            process.stdout.write(`\nassistant > ${toolCall.type}\n\n`),
          )
          .on("toolCallDelta", (toolCallDelta, snapshot) => {
            if (toolCallDelta.type === "code_interpreter") {
              if (toolCallDelta.code_interpreter?.input) {
                process.stdout.write(toolCallDelta.code_interpreter.input);
              }
              if (toolCallDelta.code_interpreter?.outputs) {
                process.stdout.write("\noutput >\n");
                toolCallDelta.code_interpreter.outputs.forEach((output) => {
                  if (output.type === "logs") {
                    process.stdout.write(`\n${output.logs}\n`);
                  }
                });
              }
            }
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
