import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const out = await login(String(body?.email || ""), String(body?.password || ""));
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
