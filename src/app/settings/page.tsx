import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { saveRecurringConfig } from "@/lib/actions";
import { getRecurringInsuranceConfig } from "@/lib/queries";
import { money, ordinal } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await getRecurringInsuranceConfig();

  const notifyEmail = process.env.NOTIFY_EMAIL;
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const emailReady = !!(notifyEmail && resendConfigured);

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
      </main>
    </>
  );
}
