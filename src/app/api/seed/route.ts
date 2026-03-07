import { seed } from "@/lib/seed";
import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed is disabled in production" },
      { status: 403 }
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const stats = await seed(databaseUrl);
  return NextResponse.json({ success: true, stats });
}
