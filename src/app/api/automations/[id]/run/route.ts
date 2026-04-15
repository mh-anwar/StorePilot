import { NextResponse } from "next/server";
import { runAutomation } from "@/lib/automations/runner";

export const maxDuration = 120;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const apiKey = req.headers.get("x-anthropic-key") || undefined;
  try {
    const res = await runAutomation(Number(id), { apiKey });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
