import { getUserProfileHandler } from "./getUserProfileHandler";
import { searchPostsHandler } from "./searchPostsHandler";

export const executeFunction = async (
  callId: string,
  functionName: string,
  params: string,
) => {
  if (assistantFunctions?.[functionName] !== undefined) {
    const func = assistantFunctions[functionName];
    const result = await func(params);
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
  searchPosts: searchPostsHandler,
  getUserProfile: getUserProfileHandler,
};
