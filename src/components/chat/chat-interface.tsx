"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useMemo } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

interface ChatInterfaceProps {
  threadId: string;
  accessCode: string;
}

export function ChatInterface({ threadId, accessCode }: ChatInterfaceProps) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { "x-access-code": accessCode },
        body: { threadId },
      }),
    [threadId, accessCode]
  );

  const { messages, sendMessage, stop, status } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      const text = input;
      setInput("");
      await sendMessage({ text });
    },
    [input, isLoading, sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
      />
    </div>
  );
}
