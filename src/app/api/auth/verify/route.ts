import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string };
  const accessCode = process.env.ACCESS_CODE;

  if (!accessCode) {
    // No access code configured — allow all access
    return NextResponse.json({ valid: true });
  }

  if (code === accessCode) {
    return NextResponse.json({ valid: true });
  }

  return NextResponse.json({ valid: false }, { status: 401 });
}
