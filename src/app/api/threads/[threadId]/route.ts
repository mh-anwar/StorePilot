import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;

  const [thread] = await db
    .select({
      id: threads.id,
      title: threads.title,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
      messageCount: count(messages.id),
    })
    .from(threads)
    .leftJoin(messages, eq(threads.id, messages.threadId))
    .where(eq(threads.id, threadId))
    .groupBy(threads.id, threads.title, threads.createdAt, threads.updatedAt);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json(thread);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  await db.delete(threads).where(eq(threads.id, threadId));
  return NextResponse.json({ success: true });
}
