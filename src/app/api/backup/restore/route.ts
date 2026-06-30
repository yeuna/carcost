import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { restoreAll, type Backup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Restore from an uploaded backup file. Protected by middleware (auth cookie) and
// gated behind a typed "RESTORE" confirmation. Destructive: replaces all data.
export async function POST(req: NextRequest) {
  const settings = new URL("/settings", req.url);
  try {
    const form = await req.formData();

    if (String(form.get("confirm") ?? "").trim() !== "RESTORE") {
      settings.searchParams.set("restoreError", "Type RESTORE to confirm.");
      return NextResponse.redirect(settings, { status: 303 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      settings.searchParams.set("restoreError", "Choose a backup file.");
      return NextResponse.redirect(settings, { status: 303 });
    }

    const backup = JSON.parse(await file.text()) as Backup;
    const result = await restoreAll(backup);

    revalidatePath("/");
    revalidatePath("/settings");
    settings.searchParams.set("restored", String(result.total));
    return NextResponse.redirect(settings, { status: 303 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Restore failed.";
    settings.searchParams.set("restoreError", msg);
    return NextResponse.redirect(settings, { status: 303 });
  }
}
