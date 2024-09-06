import openai from "../utils/openai";
import { connectToDatabase } from "./astradb";

async function embedding(prompt: string) {
  try {
    const response = await openai.embeddings.create({
      input: prompt,
      model: "text-embedding-3-small",
    });
    return response.data[0].embedding;
  } catch (e) {
    throw new Error("Failed to embed prompt");
  }
}

export const searchPostsHandler = async (params: string) => {
  try {
    const { pubkey, query } = JSON.parse(params);
    if (!pubkey || !query) {
      return {
        ok: false,
        message: "Need `pubkey` and `query` params",
      };
    }

    const { db } = await connectToDatabase();

    const similarPosts = await db
      .collection("events")
      .find(
        {
          $or: [
            { kind: 1, pubkey: pubkey },
            { kind: 1063, pubkey: pubkey },
          ],
        },
        {
          vector: await embedding(query),
          limit: 10,
          projection: {
            $vector: 0,
          },
        },
      )
      .toArray();

    return {
      ok: true,
      data: similarPosts,
    };
  } catch (e) {
    return {
      ok: false,
      message: `error: ${e}`,
    };
  }
};

const searchPosts = {
  type: "function",
  function: {
    name: "searchPosts",
    description:
      "If you want to know more about someone, just query something.",
    parameters: {
      type: "object",
      properties: {
        pubkey: {
          type: "string",
          description: "Public key of user.",
        },
        query: {
          type: "string",
          description: "Query string",
        },
      },
      required: ["pubkey", "query"],
      additionalProperties: false,
    },
  },
};
