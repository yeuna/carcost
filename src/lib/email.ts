import type { DueService } from "./queries";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ReminderEmailResult {
  sent: boolean;
  reason?: string;
}

// Send a service-reminder digest via Resend. Returns sent:false (with a reason)
// rather than throwing when email isn't configured, so the cron job stays green.
export async function sendServiceReminderEmail(
  items: DueService[],
): Promise<ReminderEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.NOTIFY_FROM || "CarCost <onboarding@resend.dev>";

  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not set" };
  if (!to) return { sent: false, reason: "NOTIFY_EMAIL not set" };
  if (items.length === 0) return { sent: false, reason: "nothing due" };

  const overdue = items.filter((i) => i.status === "overdue");
  const soon = items.filter((i) => i.status === "soon");

  const subject =
    overdue.length > 0
      ? `🔧 ${overdue.length} car service${overdue.length > 1 ? "s" : ""} overdue`
      : `🔧 ${soon.length} car service${soon.length > 1 ? "s" : ""} due soon`;

  const { html, text } = renderEmail(overdue, soon);

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `Resend ${res.status}: ${body}` };
  }
  return { sent: true };
}

function renderEmail(overdue: DueService[], soon: DueService[]) {
  const appUrl = process.env.APP_URL || "";

  const row = (i: DueService) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#fafafa;">
        <strong>${esc(i.carName)}</strong> — ${esc(i.name)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#a1a1aa;text-align:right;white-space:nowrap;">
        ${esc(i.label)}
      </td>
    </tr>`;

  const section = (title: string, color: string, list: DueService[]) =>
    list.length
      ? `<h2 style="font-size:15px;color:${color};margin:20px 0 6px;">${title}</h2>
         <table style="width:100%;border-collapse:collapse;">${list.map(row).join("")}</table>`
      : "";

  const html = `
  <div style="background:#09090b;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;padding:24px;border:1px solid #27272a;">
      <div style="font-size:20px;font-weight:700;color:#fafafa;">🚗 CarCost reminder</div>
      <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0;">Here's what needs attention:</p>
      ${section("🔴 Overdue", "#f87171", overdue)}
      ${section("🟡 Due soon", "#fbbf24", soon)}
      ${
        appUrl
          ? `<a href="${esc(appUrl)}" style="display:inline-block;margin-top:20px;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;">Open CarCost</a>`
          : ""
      }
    </div>
  </div>`;

  const textLines = [
    "CarCost reminder — services needing attention:",
    "",
    ...overdue.map((i) => `OVERDUE  ${i.carName} — ${i.name} (${i.label})`),
    ...soon.map((i) => `DUE SOON ${i.carName} — ${i.name} (${i.label})`),
  ];
  return { html, text: textLines.join("\n") };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
