"use client";

import { ChatInterface } from "@/components/chat/chat-interface";
import { AccessGate } from "@/components/chat/access-gate";
import { nanoid } from "nanoid";
import { useMemo, useState, useEffect } from "react";

export default function NewChatPage() {
  const threadId = useMemo(() => nanoid(), []);
  const [accessCode, setAccessCode] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sp-access-code");
    if (stored) setAccessCode(stored);
  }, []);

  if (accessCode === null) {
    // Check if there's a stored code (hasn't loaded yet vs no code)
    const stored = typeof window !== "undefined" ? localStorage.getItem("sp-access-code") : null;
    if (!stored) {
      return <AccessGate onAuthenticated={setAccessCode} />;
    }
  }

  if (!accessCode) {
    return <AccessGate onAuthenticated={setAccessCode} />;
  }

  return <ChatInterface threadId={threadId} accessCode={accessCode} />;
}
