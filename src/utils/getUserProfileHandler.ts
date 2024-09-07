import { connectToDatabase } from "./astradb";

export const getUserProfileHandler = async (params: string) => {
  console.log("params:", params);
  try {
    const { pubkey } = JSON.parse(params);
    if (!pubkey) {
      return {
        ok: false,
        message: "Need `pubkey` params",
      };
    }

    const { db } = await connectToDatabase();

    const profile = await db.collection("events").findOne({
      kind: 0,
      pubkey: pubkey,
    });

    return {
      ok: true,
      data: profile,
    };
  } catch (e) {
    return {
      ok: false,
      message: `error: ${e}`,
    };
  }
};

const getUserProfile = {
  type: "function",
  function: {
    name: "getUserProfile",
    description:
      "Get user's metadata. For example, user's name, about, picture, etc.",
    parameters: {
      type: "object",
      properties: {
        pubkey: {
          type: "string",
          description: "Public key of user.",
        },
      },
      required: ["pubkey"],
      additionalProperties: false,
    },
  },
};
