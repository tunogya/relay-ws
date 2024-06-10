import { SNSClient } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({
  region: "ap-northeast-1",
});

export default snsClient;
