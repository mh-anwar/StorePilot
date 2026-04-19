// Notification handlers. Emails go through Resend when RESEND_API_KEY is
// set — otherwise we log-and-succeed so workflows can be built and tested
// without comms wired up. Slack posts hit a webhook URL; http.request is
// a generic escape hatch for any other outbound call.
import { registerStep } from "../registry";
import { recordAudit } from "@/lib/agents/audit";

registerStep("notify.email", {
  category: "Notify",
  description: "Send an email via Resend (if configured) to one or more addresses.",
  handler: async (_step, cfg, ctx) => {
    const to = Array.isArray(cfg.to) ? (cfg.to as string[]) : [String(cfg.to ?? "")];
    const subject = String(cfg.subject ?? "(no subject)");
    const body = String(cfg.body ?? "");
    if (!to[0]) return { status: "error", error: "'to' required" };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Dry run: record it, don't fail.
      await recordAudit({
        orgId: ctx.orgId,
        actor: `automation:${ctx.runId}` as never,
        toolName: "notify.email",
        args: cfg,
        result: { dryRun: true, to, subject },
      });
      return {
        status: "ok",
        output: { dryRun: true, to, subject, note: "RESEND_API_KEY not set" },
      };
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: String(cfg.from ?? "StorePilot <notifications@storepilot.app>"),
        to,
        subject,
        text: body,
        ...(cfg.html ? { html: String(cfg.html) } : {}),
      }),
    });
    if (!r.ok) {
      return { status: "error", error: `resend ${r.status}: ${await r.text()}` };
    }
    const j = await r.json();
    return { status: "ok", output: { id: j.id, to, subject } };
  },
});

registerStep("notify.slack", {
  category: "Notify",
  description: "POST a message to a Slack incoming webhook URL.",
  handler: async (_step, cfg) => {
    const url = String(cfg.webhookUrl ?? "");
    const text = String(cfg.text ?? "");
    if (!url || !text) return { status: "error", error: "webhookUrl + text required" };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) return { status: "error", error: `slack ${r.status}` };
    return { status: "ok", output: { delivered: true } };
  },
});

registerStep("http.request", {
  category: "Integrations",
  description: "Make an HTTP request to any URL. Useful for Zapier-style glue.",
  handler: async (_step, cfg) => {
    const url = String(cfg.url ?? "");
    const method = String(cfg.method ?? "POST").toUpperCase();
    if (!url) return { status: "error", error: "url required" };
    const headers: Record<string, string> = (cfg.headers as Record<string, string>) ?? {};
    const body =
      cfg.body == null
        ? undefined
        : typeof cfg.body === "string"
          ? (cfg.body as string)
          : JSON.stringify(cfg.body);
    if (body && !headers["content-type"] && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const r = await fetch(url, { method, headers, body });
    const text = await r.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch {}
    if (!r.ok) return { status: "error", error: `${method} ${url} → ${r.status}: ${text.slice(0, 200)}` };
    return { status: "ok", output: { status: r.status, body: parsed } };
  },
});
