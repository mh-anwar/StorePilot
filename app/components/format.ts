// Display helpers shared by the embedded app and the demo. Client-safe.

export { formatDate, formatMoney } from "../lib/disputes/evidence";

type Tone = "neutral" | "info" | "success" | "caution" | "warning" | "critical";

export const STATUS_LABEL: Record<string, string> = {
  NEEDS_RESPONSE: "Needs response",
  UNDER_REVIEW: "Submitted",
  CHARGE_REFUNDED: "Refunded",
  ACCEPTED: "Accepted",
  WON: "Won",
  LOST: "Lost",
};

export const STATUS_TONE: Record<string, Tone> = {
  NEEDS_RESPONSE: "warning",
  UNDER_REVIEW: "info",
  CHARGE_REFUNDED: "neutral",
  ACCEPTED: "neutral",
  WON: "success",
  LOST: "critical",
};

export const RECOMMENDATION_LABEL: Record<string, string> = {
  FIGHT: "Fight",
  ACCEPT: "Accept",
  REVIEW: "Your call",
};

export const RECOMMENDATION_TONE: Record<string, Tone> = {
  FIGHT: "success",
  ACCEPT: "neutral",
  REVIEW: "caution",
};

export function scoreTone(score: number | null | undefined): Tone {
  if (score == null) return "neutral";
  if (score >= 65) return "success";
  if (score >= 35) return "caution";
  return "critical";
}

export function dueLabel(daysLeft: number | null): { text: string; tone: Tone } {
  if (daysLeft === null) return { text: "No deadline", tone: "neutral" };
  if (daysLeft < 0) return { text: "Deadline passed", tone: "critical" };
  if (daysLeft === 0) return { text: "Due today", tone: "critical" };
  if (daysLeft === 1) return { text: "Due tomorrow", tone: "critical" };
  if (daysLeft <= 3) return { text: `${daysLeft} days left`, tone: "critical" };
  if (daysLeft <= 7) return { text: `${daysLeft} days left`, tone: "warning" };
  return { text: `${daysLeft} days left`, tone: "neutral" };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
