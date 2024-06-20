import { SNSClient } from "@aws-sdk/client-sns";

const client = new SNSClient({
  region: "ap-northeast-1",
});

export default client;
