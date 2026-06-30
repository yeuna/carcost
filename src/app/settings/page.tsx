import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { saveRecurringConfig } from "@/lib/actions";
import { getRecurringInsuranceConfig } from "@/lib/queries";
import { money, ordinal } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ restored?: string; restoreError?: string }>;
}) {
  const config = await getRecurringInsuranceConfig();
  const { restored, restoreError } = await searchParams;

  const notifyEmail = process.env.NOTIFY_EMAIL;
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const emailReady = !!(notifyEmail && resendConfigured);
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <>
      <Header back={{ href: "/", label: "Dashboard" }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-8 text-2xl font-bold">Settings</h1>

        {/* ── Insurance reminders ── */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-semibold">Insurance reminders</h2>
          <p className="mb-5 text-sm text-zinc-400">
            One monthly bill covering all cars. Set the amount and due day and the
            app will prompt you to record it each month.
          </p>

          {config && (
            <div className="mb-5 rounded-xl bg-zinc-900/60 px-4 py-3 text-sm ring-1 ring-white/5">
              <span className="text-zinc-400">Current: </span>
              <span className="font-medium">{money(config.amount)}/mo</span>
              <span className="text-zinc-400"> · due the </span>
              <span className="font-medium">{ordinal(config.dayOfMonth)}</span>
              {config.provider && (
                <span className="text-zinc-400"> · {config.provider}</span>
              )}
              {config.lastPaidMonth && (
                <div className="mt-1 text-xs text-zinc-500">
                  Last recorded: {config.lastPaidMonth}
                </div>
              )}
            </div>
          )}

          <form action={saveRecurringConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly amount">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={config ? String(config.amount) : ""}
                  className={inputClass}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Due day of month" hint="1–28 (capped so short months always trigger)">
                <input
                  name="dayOfMonth"
                  inputMode="numeric"
                  required
                  defaultValue={config ? String(config.dayOfMonth) : "24"}
                  className={inputClass}
                  placeholder="24"
                />
              </Field>
            </div>

            <Field label="Provider (optional)">
              <input
                name="provider"
                defaultValue={config?.provider ?? ""}
                className={inputClass}
                placeholder="Geico, State Farm…"
              />
            </Field>

            <SubmitButton>{config ? "Save changes" : "Set up reminders"}</SubmitButton>
          </form>
        </section>

        {/* ── Service email reminders ── */}
        <section className="border-t border-white/10 pt-8">
          <h2 className="mb-1 text-base font-semibold">Service email reminders</h2>
          <p className="mb-4 text-sm text-zinc-400">
            A daily check sends you an email when a scheduled service is coming due or overdue.
          </p>
          <div className="rounded-xl bg-zinc-900/60 px-4 py-4 text-sm ring-1 ring-white/5">
            {emailReady ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <span className="text-zinc-300">
                  Sending to <span className="font-medium">{notifyEmail}</span>
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">●</span>
                  <span className="text-zinc-500">Not configured</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Set <code className="text-zinc-500">RESEND_API_KEY</code> and{" "}
                  <code className="text-zinc-500">NOTIFY_EMAIL</code> in Vercel environment
                  variables to enable.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Backups ── */}
        <section className="border-t border-white/10 pt-8">
          <h2 className="mb-1 text-base font-semibold">Backups</h2>
          <p className="mb-4 text-sm text-zinc-400">
            A full copy of your data is saved daily and a copy is emailed weekly. You can
            also download a snapshot any time, or restore from one.
          </p>

          <div className="mb-5 rounded-xl bg-zinc-900/60 px-4 py-4 text-sm ring-1 ring-white/5">
            <div className="flex items-center gap-2">
              <span className={blobConfigured ? "text-green-400" : "text-zinc-500"}>●</span>
              <span className={blobConfigured ? "text-zinc-300" : "text-zinc-500"}>
                Daily backup to Vercel Blob{blobConfigured ? "" : " — not configured"}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={emailReady ? "text-green-400" : "text-zinc-500"}>●</span>
              <span className={emailReady ? "text-zinc-300" : "text-zinc-500"}>
                Weekly emailed copy{emailReady ? ` to ${notifyEmail}` : " — not configured"}
              </span>
            </div>
            {!blobConfigured && (
              <p className="mt-2 text-xs text-zinc-600">
                Provision a Vercel Blob store to enable scheduled backups — it sets{" "}
                <code className="text-zinc-500">BLOB_READ_WRITE_TOKEN</code> automatically.
              </p>
            )}
          </div>

          <a
            href="/api/backup/download"
            className="inline-block rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 ring-1 ring-white/10 active:bg-zinc-700"
          >
            ⬇️ Download backup now
          </a>

          {/* Restore */}
          <div className="mt-8">
            <h3 className="mb-1 text-sm font-semibold text-red-300">Restore from backup</h3>
            <p className="mb-3 text-xs text-zinc-500">
              Replaces <span className="font-medium">all</span> current data with the
              contents of the uploaded file. Intended for recovery. Type{" "}
              <code className="text-zinc-400">RESTORE</code> to confirm.
            </p>

            {restored != null && (
              <p className="mb-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300 ring-1 ring-green-500/20">
                Restored {restored} record{restored === "1" ? "" : "s"}.
              </p>
            )}
            {restoreError && (
              <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
                {restoreError}
              </p>
            )}

            <form
              action="/api/backup/restore"
              method="post"
              encType="multipart/form-data"
              className="space-y-3"
            >
              <input
                type="file"
                name="file"
                accept="application/json,.json"
                required
                className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-zinc-200"
              />
              <input
                name="confirm"
                autoComplete="off"
                placeholder="Type RESTORE"
                className={inputClass}
              />
              <button
                type="submit"
                className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white active:bg-red-500"
              >
                Restore data
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
