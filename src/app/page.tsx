import Link from "next/link";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { getCars } from "@/lib/queries";
import { money, miles } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const cars = await getCars();

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
