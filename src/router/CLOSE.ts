import { Handler, APIGatewayEvent } from "aws-lambda";

/*
 * From client to relay:
 * ["CLOSE", <subscription_id>]
 *
 * From relay to client:
 * ["CLOSED", <subscription_id>, <message>]
 *
 * message: duplicate, pow, blocked, rate-limited, invalid, and error
 */
export const handler: Handler = async (event: APIGatewayEvent, context) => {
  const messageArray = JSON.parse(
    // @ts-ignore
    event.body,
  );
  const subscription_id = messageArray?.[1];

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      "CLOSED",
      subscription_id,
      "The subscription was ended on the server side.",
    ]),
  };
};
