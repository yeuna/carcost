import { NextRequest, NextResponse } from "next/server";
import {
  getDueServices,
  getDueRenewals,
  markNotified,
  markRenewalNotified,
  clearStaleNotifications,
  clearStaleRenewalNotifications,
} from "@/lib/queries";
import { sendServiceReminderEmail, type ReminderEmailResult } from "@/lib/email";

export const dynamic = "force-dynamic";

const REPEAT_AFTER_DAYS = 7;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (e.g. local dev). On Vercel, set CRON_SECRET
  // and the platform sends it automatically as a Bearer token.
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// True when a due item warrants an email now: it's newly due, escalated from
// soon→overdue, or has stayed due past the repeat window since the last email.
function needsNotify(
  item: { status: string; notifiedStatus: string | null; notifiedAt: Date | null },
  now: number,
): boolean {
  if (item.notifiedStatus !== item.status) return true;
  if (!item.notifiedAt) return true;
  const days = (now - new Date(item.notifiedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= REPEAT_AFTER_DAYS;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [dueServices, dueRenewals] = await Promise.all([getDueServices(), getDueRenewals()]);

  // Clear flags on items no longer due so they can re-notify later.
  await Promise.all([
    clearStaleNotifications(dueServices.map((d) => d.scheduleId)),
    clearStaleRenewalNotifications(dueRenewals.map((d) => d.renewalId)),
  ]);

  const now = Date.now();
  const servicesToNotify = dueServices.filter((d) => needsNotify(d, now));
  const renewalsToNotify = dueRenewals.filter((d) => needsNotify(d, now));
  const toNotify = [...servicesToNotify, ...renewalsToNotify];

  let emailResult: ReminderEmailResult = { sent: false, reason: "nothing new to notify" };
  if (toNotify.length > 0) {
    emailResult = await sendServiceReminderEmail(toNotify);
    if (emailResult.sent) {
      for (const d of servicesToNotify) await markNotified(d.scheduleId, d.status);
      for (const d of renewalsToNotify) await markRenewalNotified(d.renewalId, d.status);
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    dueCount: dueServices.length + dueRenewals.length,
    notifiedCount: emailResult.sent ? toNotify.length : 0,
    email: emailResult,
    due: [
      ...dueServices.map((d) => ({ car: d.carName, service: d.name, status: d.status, label: d.label })),
      ...dueRenewals.map((d) => ({ car: d.carName, renewal: d.name, status: d.status, label: d.label })),
    ],
  });
}
