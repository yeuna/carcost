import { NextRequest, NextResponse } from "next/server";
import {
  getDueServices,
  markNotified,
  clearStaleNotifications,
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

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await getDueServices();

  // Clear flags on services that are no longer due so they can re-notify later.
  await clearStaleNotifications(due.map((d) => d.scheduleId));

  // Decide which due items warrant an email right now.
  const now = Date.now();
  const toNotify = due.filter((d) => {
    if (d.notifiedStatus !== d.status) return true; // new, or escalated soon->overdue
    if (!d.notifiedAt) return true;
    const days = (now - new Date(d.notifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days >= REPEAT_AFTER_DAYS;
  });

  let emailResult: ReminderEmailResult = { sent: false, reason: "nothing new to notify" };
  if (toNotify.length > 0) {
    emailResult = await sendServiceReminderEmail(toNotify);
    if (emailResult.sent) {
      for (const d of toNotify) await markNotified(d.scheduleId, d.status);
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    dueCount: due.length,
    notifiedCount: emailResult.sent ? toNotify.length : 0,
    email: emailResult,
    due: due.map((d) => ({ car: d.carName, service: d.name, status: d.status, label: d.label })),
  });
}
