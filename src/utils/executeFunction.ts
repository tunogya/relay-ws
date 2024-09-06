import { getUserProfileHandler } from "./getUserProfileHandler";
import { searchPostsHandler } from "./searchPostsHandler";
import { sendMessageHandler } from "./sendMessageHandler";

export const executeFunction = async (
  callId: string,
  functionName: string,
  params: string,
) => {
  if (assistantFunctions?.[functionName] !== undefined) {
    const result = assistantFunctions[functionName](params);
    return {
      callId,
      results: JSON.stringify(result),
    };
  } else {
    return {
      callId,
      results: JSON.stringify({
        error: "No function found.",
      }),
    };
  }
};

const assistantFunctions: {
  [key: string]: (params: string) => Promise<any>;
} = {
  sendMessage: sendMessageHandler,
  searchPosts: searchPostsHandler,
  getUserProfile: getUserProfileHandler,
};
