import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await db
    .select({
      id: threads.id,
      title: threads.title,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
      messageCount: count(messages.id),
    })
    .from(threads)
    .leftJoin(messages, eq(threads.id, messages.threadId))
    .groupBy(threads.id, threads.title, threads.createdAt, threads.updatedAt)
    .orderBy(desc(threads.updatedAt))
    .limit(50);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { title } = (await req.json()) as { title?: string };
  const id = nanoid();

  await db.insert(threads).values({
    id,
    title: title || "New conversation",
  });

  return NextResponse.json({ id, title });
}
