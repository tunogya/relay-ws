import { SQSClient } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: "ap-northeast-1",
});

export default sqsClient;
