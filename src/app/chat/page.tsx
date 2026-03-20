"use client";

import { ChatInterface } from "@/components/chat/chat-interface";
import { nanoid } from "nanoid";
import { useMemo } from "react";

export default function NewChatPage() {
  const threadId = useMemo(() => nanoid(), []);

  return <ChatInterface threadId={threadId} />;
}
