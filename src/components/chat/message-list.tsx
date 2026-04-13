"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  onSuggestionClick?: (text: string) => void;
}

export function MessageList({ messages, isLoading, onSuggestionClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">StorePilot AI</h2>
          <p className="text-muted-foreground text-sm">
            Ask me anything about your store — revenue analytics, inventory
            management, content optimization, or marketing strategies.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              "What were my top products this month?",
              "Which items are low on stock?",
              "Write a description for product #5",
              "Create a summer sale campaign",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSuggestionClick?.(prompt)}
                className="bg-muted/50 rounded-lg p-2.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading &&
          messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
