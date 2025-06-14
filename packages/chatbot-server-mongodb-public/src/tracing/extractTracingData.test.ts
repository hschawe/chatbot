import { DbMessage, Message, ToolMessage } from "mongodb-rag-core";
import { ObjectId } from "mongodb-rag-core/mongodb";
import { llmDoesNotKnowMessage } from "../systemPrompt";
import { extractTracingData } from "./extractTracingData";
import { SEARCH_TOOL_NAME, SearchToolReturnValue } from "../tools/search";

describe("extractTracingData", () => {
  const msgId = new ObjectId();
  const baseUserMessage: Message = {
    role: "user",
    content: "foo",
    createdAt: new Date(),
    id: new ObjectId(),
  };
  const baseAssistantMessage: Message = {
    role: "assistant",
    content: "foo",
    createdAt: new Date(),
    id: msgId,
  };
  const toolResults = {
    results: [
      {
        text: "text",
        url: "url",
      },
      {
        text: "text",
        url: "url",
      },
    ],
  } satisfies SearchToolReturnValue;

  const baseToolMessage: DbMessage<ToolMessage> = {
    role: "tool",
    name: SEARCH_TOOL_NAME,
    content: JSON.stringify(toolResults),
    createdAt: new Date(),
    id: new ObjectId(),
  };

  const conversationId = new ObjectId();
  test("should reject query", () => {
    const messages: Message[] = [
      {
        ...baseUserMessage,
        rejectQuery: true,
      },
      baseAssistantMessage,
    ];
    const tracingData = extractTracingData(messages, msgId, conversationId);
    expect(tracingData.rejectQuery).toBe(true);
    expect(tracingData.tags.includes("rejected_query")).toBe(true);
  });
  test("should extract metadata", () => {
    const messages: Message[] = [
      {
        ...baseUserMessage,
        customData: {
          programmingLanguage: "javascript",
          mongoDbProduct: "MongoDB Atlas",
        },
      },
      baseAssistantMessage,
    ];
    const tracingData = extractTracingData(messages, msgId, conversationId);
    expect(tracingData.tags.includes("javascript")).toBe(true);
    expect(tracingData.tags.includes("mongodb_atlas")).toBe(true);
  });
  test("should get number of retrieved chunks", () => {
    const messagesNoContext: Message[] = [
      {
        ...baseUserMessage,
      },
      { ...baseToolMessage, content: JSON.stringify([]) },
      baseAssistantMessage,
    ];
    const tracingData = extractTracingData(
      messagesNoContext,
      msgId,
      conversationId
    );
    expect(tracingData.numRetrievedChunks).toBe(0);
    expect(tracingData.tags.includes("no_retrieved_content")).toBe(true);

    const messagesWithContext: Message[] = [
      {
        ...baseUserMessage,
      },
      baseToolMessage,
      baseAssistantMessage,
    ];
    const tracingDataWithContext = extractTracingData(
      messagesWithContext,
      msgId,
      conversationId
    );
    expect(tracingDataWithContext.numRetrievedChunks).toBe(2);
    expect(tracingDataWithContext.tags.includes("no_retrieved_content")).toBe(
      false
    );
  });
  test("should capture verified answer", () => {
    const messagesNoContext: Message[] = [
      baseUserMessage,
      {
        ...baseAssistantMessage,
        metadata: {
          verifiedAnswer: {
            _id: "123",
            created: new Date(),
          },
        },
      },
    ];
    const tracingData = extractTracingData(
      messagesNoContext,
      msgId,
      conversationId
    );
    expect(tracingData.isVerifiedAnswer).toBe(true);
    expect(tracingData.tags.includes("verified_answer")).toBe(true);
  });
  test("should capture LLM does not know", () => {
    const messagesNoContext: Message[] = [
      baseUserMessage,
      {
        ...baseAssistantMessage,
        content: llmDoesNotKnowMessage,
      },
    ];
    const tracingData = extractTracingData(
      messagesNoContext,
      msgId,
      conversationId
    );
    expect(tracingData.llmDoesNotKnow).toBe(true);
    expect(tracingData.tags.includes("llm_does_not_know")).toBe(true);
  });
  test("should capture message indexes", () => {
    const messages: Message[] = [baseUserMessage, baseAssistantMessage];
    const tracingData = extractTracingData(messages, msgId, conversationId);
    expect(tracingData.userMessageIndex).toBe(0);
    expect(tracingData.assistantMessageIndex).toBe(1);
  });
});
