"use client";

import { ChatInterface } from "@/components/chat/chat-interface";
import { use } from "react";

export default function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  return <ChatInterface threadId={threadId} />;
}
