import { NextResponse } from "next/server";
import { switchOrg } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    await switchOrg(String(body?.orgId || ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
