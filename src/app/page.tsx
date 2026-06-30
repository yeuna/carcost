import Link from "next/link";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthlySpendChart } from "@/components/MonthlySpendChart";
import { getCars, getMonthlySpending, getRecurringInsuranceConfig } from "@/lib/queries";
import { money, miles, ordinal, perMile } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [cars, monthly, insurance] = await Promise.all([
    getCars(),
    getMonthlySpending(12),
    getRecurringInsuranceConfig(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="mb-4 flex items-end justify-between">
          <h1 className="text-2xl font-bold">Your cars</h1>
          <Link
            href="/cars/new"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium active:bg-blue-700"
          >
            + Add car
          </Link>
        </div>

        {/* Insurance due — single account-level banner */}
        {insurance?.isDue && (
          <div className="mb-3 rounded-2xl bg-amber-950 ring-1 ring-amber-500/30">
            <Link
              href="/insurance/record"
              className="flex items-center justify-between px-4 py-4 active:bg-amber-900/60"
            >
              <div className="min-w-0">
                <div className="font-semibold text-amber-100">Insurance due</div>
                <div className="mt-0.5 text-sm text-amber-300/80">
                  {money(insurance.amount)} · due the {ordinal(insurance.dayOfMonth)}
                  {insurance.provider && ` · ${insurance.provider}`}
                </div>
              </div>
              <span className="ml-3 shrink-0 text-amber-400">Record →</span>
            </Link>
            <div className="border-t border-amber-500/10 px-4 py-2 text-right">
              <Link href="/settings" className="text-xs text-amber-700 active:text-amber-500">
                Edit settings
              </Link>
            </div>
          </div>
        )}

        {/* Setup nudge when no recurring config exists */}
        {!insurance && (
          <Link
            href="/settings"
            className="mb-3 block rounded-2xl bg-zinc-900/60 px-4 py-3 text-sm text-zinc-500 ring-1 ring-white/5 active:bg-zinc-900"
          >
            Set up monthly insurance reminders →
          </Link>
        )}

        {cars.length > 0 && (
          <div className="mb-5">
            <MonthlySpendChart data={monthly} />
          </div>
        )}

        {cars.length === 0 ? (
          <div className="mt-16 text-center text-zinc-400">
            <div className="text-5xl">🚙</div>
            <p className="mt-4">No cars yet.</p>
            <Link
              href="/cars/new"
              className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 font-medium active:bg-blue-700"
            >
              Add your first car
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {cars.map((car) => (
              <li key={car.id}>
                <Link
                  href={`/cars/${car.id}`}
                  className="block rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10 active:bg-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{car.name}</h2>
                      <p className="mt-0.5 text-sm text-zinc-400">
                        {miles(car.currentOdometer)}
                      </p>
                      {(car.costPerMile != null || car.avgPerMonth != null) && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {car.costPerMile != null && perMile(car.costPerMile)}
                          {car.costPerMile != null && car.avgPerMonth != null && " · "}
                          {car.avgPerMonth != null && `${money(car.avgPerMonth)}/mo`}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold">{money(car.totalSpent)}</div>
                      <div className="text-xs text-zinc-500">total spent</div>
                    </div>
                  </div>
                  {(car.overdue > 0 || car.soon > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {car.overdue > 0 && (
                        <StatusBadge status="overdue">
                          {car.overdue} overdue
                        </StatusBadge>
                      )}
                      {car.soon > 0 && (
                        <StatusBadge status="soon">{car.soon} due soon</StatusBadge>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
