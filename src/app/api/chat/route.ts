import { createOrchestratorStream } from "@/lib/agents/orchestrator";
import { convertToModelMessages } from "ai";
import { db } from "@/lib/db";
import { threads, messages as messagesTable } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export const maxDuration = 60;

export async function POST(req: Request) {
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode) {
    const code = req.headers.get("x-access-code");
    if (code !== accessCode) {
      return new Response('{"error":"Unauthorized"}', {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const body = await req.json().catch(() => null);
  if (!body?.messages?.length) {
    return new Response('{"error":"messages required"}', {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { threadId: tid } = body;
  const threadId = tid ?? nanoid();

  // convert UIMessages -> ModelMessages for streamText
  const modelMessages = await convertToModelMessages(body.messages);

  if (!tid) {
    const first = body.messages[0];
    const title = first?.parts?.find((p: { type: string }) => p.type === "text")?.text?.slice(0, 100) || "New conversation";
    try {
      await db.insert(threads).values({ id: threadId, title });
    } catch { /* thread might exist */ }
  }

  // save user msg
  const last = body.messages[body.messages.length - 1];
  if (last?.role === "user") {
    const text = last.parts?.find((p: { type: string }) => p.type === "text")?.text || "";
    try {
      await db.insert(messagesTable).values({
        id: nanoid(),
        threadId,
        role: "user",
        content: text,
      });
    } catch { /* non-critical */ }
  }

  const result = createOrchestratorStream(modelMessages);

  return result.toUIMessageStreamResponse({
    headers: { "X-Thread-Id": threadId },
  });
}
