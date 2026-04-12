import { createOrchestratorStream } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db";
import { threads, messages as messagesTable } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import type { ModelMessage } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  // Verify access code if configured
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode) {
    const authHeader = req.headers.get("x-access-code");
    if (authHeader !== accessCode) {
      return new Response(JSON.stringify({ error: "Invalid access code" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const body = await req.json();
  const { messages, threadId: incomingThreadId } = body as {
    messages: ModelMessage[];
    threadId?: string;
  };

  const threadId = incomingThreadId ?? nanoid();

  if (!incomingThreadId) {
    const firstMsg = messages[0];
    const title =
      typeof firstMsg?.content === "string"
        ? firstMsg.content.slice(0, 100)
        : "New conversation";
    await db.insert(threads).values({ id: threadId, title });
  }

  const lastMessage = messages[messages.length - 1];
  await db.insert(messagesTable).values({
    id: nanoid(),
    threadId,
    role: lastMessage.role as "user" | "assistant" | "system" | "tool",
    content:
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content),
  });

  const result = createOrchestratorStream(messages);

  // Persist assistant response after stream completes (fire-and-forget)
  void Promise.resolve(result.text).then(async (text) => {
    if (text) {
      await db.insert(messagesTable).values({
        id: nanoid(),
        threadId,
        role: "assistant",
        content: text,
      });
    }
  }).catch(() => {});

  return result.toUIMessageStreamResponse({
    headers: { "X-Thread-Id": threadId },
  });
}
