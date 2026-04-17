import { NextResponse } from "next/server";
import { signup } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const out = await signup({
      email: String(body?.email || ""),
      password: String(body?.password || ""),
      name: body?.name,
      orgName: body?.orgName,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
