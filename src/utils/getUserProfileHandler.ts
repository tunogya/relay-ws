import { connectToDatabase } from "./astradb";

export const getUserProfileHandler = async (params: string) => {
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
