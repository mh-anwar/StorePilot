// Outgoing email for deadline alerts. One small transport so tests can swap it
// and so the provider can change without touching alert logic.
//
// Production uses Resend's HTTP API when RESEND_API_KEY and ALERTS_FROM_EMAIL
// are set. Without them, alerts are skipped (and logged), never faked.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailResult = { sent: true; id?: string } | { sent: false; reason: string };
export type EmailTransport = (message: EmailMessage) => Promise<EmailResult>;

let override: EmailTransport | null = null;

/** Tests inject a transport; pass null to restore the real one. */
export function setEmailTransport(transport: EmailTransport | null) {
  override = transport;
}

export function emailConfigured(): boolean {
  return Boolean(override) || Boolean(process.env.RESEND_API_KEY && process.env.ALERTS_FROM_EMAIL);
}

const resend: EmailTransport = async (message) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL;
  if (!key || !from) return { sent: false, reason: "email not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: body.id };
};

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  try {
    return await (override ?? resend)(message);
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
