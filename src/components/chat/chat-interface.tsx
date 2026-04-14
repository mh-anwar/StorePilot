"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useMemo, useEffect } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

interface ChatInterfaceProps {
  threadId: string;
  accessCode: string;
}

export function ChatInterface({ threadId, accessCode }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [userKey, setUserKey] = useState<string | null>(null);
  const [userModel, setUserModel] = useState<string | null>(null);

  useEffect(() => {
    setUserKey(localStorage.getItem("sp_user_key"));
    setUserModel(localStorage.getItem("sp_user_model"));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: {
          "x-access-code": accessCode,
          ...(userKey ? { "x-anthropic-key": userKey } : {}),
          ...(userModel ? { "x-model": userModel } : {}),
        },
        body: { threadId },
      }),
    [threadId, accessCode, userKey, userModel]
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

  const handleSuggestion = useCallback(
    async (text: string) => {
      if (isLoading) return;
      await sendMessage({ text });
    },
    [isLoading, sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} onSuggestionClick={handleSuggestion} />
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
