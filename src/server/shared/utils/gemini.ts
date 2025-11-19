import { AIMessage, type BaseMessage } from "@langchain/core/messages";

/**
 * Ensures that all AI messages with tool calls have a thought signature.
 * This is required for Gemini 3 Pro models which enforce strict validation on thought signatures.
 * If a signature is missing (e.g. from a previous model version), a dummy signature is added.
 *
 * @param messages - The list of messages to process
 */
export function ensureThoughtSignatures(messages: BaseMessage[]): void {
  for (const message of messages) {
    if (message instanceof AIMessage && message.tool_calls?.length) {
      // Check if thought signature exists in additional_kwargs
      const kwargs = message.additional_kwargs || {};
      
      // We look for the signature in various places it might be stored
      // 1. additional_kwargs.thoughtSignature
      // 2. In the raw tool_calls structure if LangChain preserved it (unlikely in standard typings but possible)
      
      // If we don't find it, and it's a tool call, we must add the dummy signature.
      // The dummy signature should be added where the model expects it.
      // When using ChatGoogleGenerativeAI, it converts AIMessage back to Content.
      // It typically looks at additional_kwargs for model-specific fields.
      
      if (!kwargs.thoughtSignature) {
        // Add the dummy signature to bypass strict validation
        // This is specifically for "Migrating from other models" scenario
        message.additional_kwargs = {
          ...kwargs,
          thoughtSignature: "context_engineering_is_the_way_to_go",
        };
      }
    }
  }
}
