import { NextResponse } from "next/server";
import { exportAll, serializeBackup, backupFilename } from "@/lib/backup";

export const dynamic = "force-dynamic";

// On-demand backup download. Protected by middleware (requires the app auth cookie).
export async function GET() {
  const json = serializeBackup(await exportAll());
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
