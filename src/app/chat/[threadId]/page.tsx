"use client";

import { ChatInterface } from "@/components/chat/chat-interface";
import { AccessGate } from "@/components/chat/access-gate";
import { use, useState, useEffect } from "react";

export default function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sp-access-code");
    if (stored) setAccessCode(stored);
  }, []);

  if (!accessCode) {
    return <AccessGate onAuthenticated={setAccessCode} />;
  }

  return <ChatInterface threadId={threadId} accessCode={accessCode} />;
}
