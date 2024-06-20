import { SQSClient } from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: "ap-northeast-1",
});

export default client;
