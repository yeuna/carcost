import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SubmitButton } from "@/components/Form";
import { recordInsurancePayment } from "@/lib/actions";
import { getRecurringInsuranceConfig, getCars } from "@/lib/queries";
import { money, formatDate, today, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RecordInsurancePage() {
  const [config, cars] = await Promise.all([
    getRecurringInsuranceConfig(),
    getCars(),
  ]);

  if (!config || !config.isDue) redirect("/");

  const dateStr = today();
  const monthLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Compute split preview
  const totalCents = Math.round(num(config.amount) * 100);
  const n = cars.length;
  const perCarAmount = n > 0 ? (Math.floor(totalCents / n) / 100) : num(config.amount);
  const remainderCents = n > 0 ? totalCents - Math.floor(totalCents / n) * n : 0;

  return (
    <>
      <Header back={{ href: "/", label: "Dashboard" }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
          Insurance due
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">{monthLabel}</h1>
        {config.provider && (
          <p className="mt-1 text-zinc-400">{config.provider}</p>
        )}

        {/* Payment summary */}
        <div className="mt-8 rounded-2xl bg-zinc-900 ring-1 ring-white/10">
          <div className="flex items-center justify-between px-5 py-5">
            <span className="text-zinc-400">Total amount</span>
            <span className="text-2xl font-bold">{money(config.amount)}</span>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 px-5 py-4">
            <span className="text-zinc-400">Date</span>
            <span className="font-medium">{formatDate(dateStr)}</span>
          </div>

          {n > 1 && (
            <div className="border-t border-white/5 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Split across {n} cars</span>
                <span className="font-medium text-zinc-300">
                  {remainderCents > 0
                    ? `${money(perCarAmount + remainderCents / 100)} + ${n - 1}×${money(perCarAmount)}`
                    : `${money(perCarAmount)} each`}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5">
                {cars.map((car, i) => (
                  <li key={car.id} className="flex justify-between text-xs text-zinc-500">
                    <span className="truncate">{car.name}</span>
                    <span>
                      {money(
                        (perCarCents(totalCents, n, i)) / 100
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {n === 1 && (
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-4">
              <span className="text-zinc-400">Car</span>
              <span className="font-medium">{cars[0].name}</span>
            </div>
          )}
        </div>

        {n === 0 && (
          <p className="mt-4 text-sm text-zinc-500">
            Add a car first — the payment will be split across all your cars.
          </p>
        )}

        {/* Confirm */}
        <form action={recordInsurancePayment} className="mt-6">
          <SubmitButton>Record payment</SubmitButton>
        </form>

        <div className="mt-5 text-center">
          <Link href="/" className="text-base text-zinc-500 active:text-zinc-300">
            Cancel
          </Link>
        </div>
      </main>
    </>
  );
}

function perCarCents(totalCents: number, n: number, i: number): number {
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return base + (i === 0 ? remainder : 0);
}
