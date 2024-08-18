import openai from "./openai";

export async function embedding(prompt: string) {
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
