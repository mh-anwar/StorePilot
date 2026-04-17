import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(req: Request) {
  await logout();
  // If the form was submitted directly, redirect; otherwise return JSON.
  const accept = req.headers.get("accept") || "";
  if (!accept.includes("application/json")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.json({ ok: true });
}
