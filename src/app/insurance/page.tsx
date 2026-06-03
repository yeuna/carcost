import Link from "next/link";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { saveRecurringConfig } from "@/lib/actions";
import { getRecurringInsuranceConfig } from "@/lib/queries";
import { money, ordinal } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InsuranceSettingsPage() {
  const config = await getRecurringInsuranceConfig();

  return (
    <>
      <Header back={{ href: "/", label: "Dashboard" }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Insurance reminders</h1>
        <p className="mb-6 text-sm text-zinc-400">
          One bill, all cars. Set the amount and due day and the app will prompt
          you each month to record it.
        </p>

        {config && (
          <div className="mb-6 rounded-xl bg-zinc-900/60 px-4 py-3 text-sm ring-1 ring-white/5">
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
                autoFocus
                defaultValue={config ? String(config.amount) : ""}
                className={inputClass}
                placeholder="0.00"
              />
            </Field>
            <Field label="Due day of month">
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

        {config && (
          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-zinc-600 active:text-zinc-400">
              Cancel
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
