import { NextResponse } from "next/server";
import { listStepTypes } from "@/lib/workflows/handlers";

export async function GET() {
  return NextResponse.json({ stepTypes: listStepTypes() });
}
