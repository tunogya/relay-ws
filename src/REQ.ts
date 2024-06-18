import { Handler, APIGatewayEvent } from "aws-lambda";

export const handler: Handler = async (event: APIGatewayEvent, context) => {
  console.log(event);
  return {
    data: event,
  };
};
