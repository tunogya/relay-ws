import OpenAI from "openai";

const openai = new OpenAI({
  baseURL:
    "https://gateway.ai.cloudflare.com/v1/702151bcf1ad137360fb347e0353316c/tripiz/openai",
});

export default openai;
