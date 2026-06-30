import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";
import { exportAll, serializeBackup, backupFilename } from "@/lib/backup";
import { sendBackupEmail, type ReminderEmailResult } from "@/lib/email";

export const dynamic = "force-dynamic";

const BLOB_PREFIX = "backups/";

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

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({
      ranAt: new Date().toISOString(),
      stored: false,
      reason: "BLOB_READ_WRITE_TOKEN not set — provision a Vercel Blob store",
    });
  }

  const json = serializeBackup(await exportAll());
  const filename = backupFilename();

  // Store the snapshot privately (backups contain personal data — require auth to
  // read). `addRandomSuffix: false` keeps one blob per day (re-runs overwrite).
  const blob = await put(`${BLOB_PREFIX}${filename}`, json, {
    access: "private",
    contentType: "application/json",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  // Retention: keep the newest N daily backups, delete the rest.
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS) || 30;
  const { blobs } = await list({ prefix: BLOB_PREFIX, token });
  const sorted = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  const stale = sorted.slice(retentionDays);
  if (stale.length) await del(stale.map((b) => b.url), { token });

  // Weekly offsite copy: email the backup on Sundays.
  let email: ReminderEmailResult = { sent: false, reason: "not the weekly email day" };
  if (new Date().getUTCDay() === 0) {
    email = await sendBackupEmail(json, filename);
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    stored: true,
    blobUrl: blob.url,
    pruned: stale.length,
    retained: Math.min(sorted.length, retentionDays),
    email,
  });
}
