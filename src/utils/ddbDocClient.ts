import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({
  region: "ap-northeast-1",
});

export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
