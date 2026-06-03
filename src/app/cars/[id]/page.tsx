import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { getCarDetail } from "@/lib/queries";
import {
  deleteCar,
  deleteFuel,
  deleteInsurance,
  deleteMaintenance,
  deleteServiceSchedule,
} from "@/lib/actions";
import { money, miles, formatDate, num } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const data = await getCarDetail(carId);
  if (!data) notFound();

  const { car, currentOdometer, totalSpent, maintenanceSpent, fuelSpent, insuranceSpent, maintenance, fuel, insurance, schedules } = data;

  return (
    <>
      <Header back={{ href: "/", label: "Cars" }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {/* Heading + stats */}
        <h1 className="text-2xl font-bold">{car.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">Current odometer: {miles(currentOdometer)}</p>

        <div className="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
          <div className="text-center">
            <div className="text-2xl font-bold">{money(totalSpent)}</div>
            <div className="text-xs text-zinc-500">total spent</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
            <MiniStat label="Maintenance" value={money(maintenanceSpent)} />
            <MiniStat label="Fuel" value={money(fuelSpent)} />
            <MiniStat label="Insurance" value={money(insuranceSpent)} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <Action href={`/cars/${carId}/maintenance/new`} icon="🔧" label="Maintenance" />
          <Action href={`/cars/${carId}/fuel/new`} icon="⛽" label="Fuel" />
          <Action href={`/cars/${carId}/insurance/new`} icon="🛡️" label="Insurance" />
          <Action href={`/cars/${carId}/services/new`} icon="🗓️" label="Service" />
        </div>

        {/* Services due */}
        <Section title="Service schedule" action={{ href: `/cars/${carId}/services/new`, label: "+ Add" }}>
          {schedules.length === 0 ? (
            <Empty>No services tracked. Add one to get mileage reminders.</Empty>
          ) : (
            <ul className="space-y-2">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-white/10"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.name}</span>
                      <StatusBadge status={s.reminder.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {intervalText(s.intervalMiles, s.intervalMonths)} · {s.reminder.label}
                    </div>
                    {s.lastOdometer != null && (
                      <div className="text-xs text-zinc-500">
                        Last at {miles(s.lastOdometer)}
                        {s.reminder.dueOdometer != null && ` · next at ${miles(s.reminder.dueOdometer)}`}
                      </div>
                    )}
                  </div>
                  <DeleteButton action={deleteServiceSchedule} id={s.id} carId={carId} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Maintenance log */}
        <Section title="Maintenance log" action={{ href: `/cars/${carId}/maintenance/new`, label: "+ Add" }}>
          {maintenance.length === 0 ? (
            <Empty>No maintenance logged yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {maintenance.map((m) => (
                <li key={m.id} className="rounded-xl bg-zinc-900 p-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          {m.type}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {formatDate(m.date)} · {miles(m.odometer)}
                        {m.shop && ` · ${m.shop}`}
                      </div>
                      {m.items.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
                          {m.items.map((it) => (
                            <li key={it.id} className="flex justify-between gap-4">
                              <span className="truncate">
                                {it.quantity > 1 && `${it.quantity}× `}
                                {it.name}
                              </span>
                              <span>{money(num(it.cost) * (it.quantity || 1))}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.notes && <p className="mt-1 text-xs text-zinc-500">{m.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold">{money(m.total)}</div>
                      <DeleteButton
                        action={deleteMaintenance}
                        id={m.id}
                        carId={carId}
                        editHref={`/cars/${carId}/maintenance/${m.id}/edit`}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Fuel log */}
        <Section title="Fuel log" action={{ href: `/cars/${carId}/fuel/new`, label: "+ Add" }}>
          {fuel.length === 0 ? (
            <Empty>No fill-ups logged yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {fuel.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-white/10"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{money(f.totalCost)}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {formatDate(f.date)} · {miles(f.odometer)}
                      {num(f.gallons) > 0 && ` · ${num(f.gallons).toFixed(2)} gal`}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {f.mpg != null && `${f.mpg.toFixed(1)} mpg`}
                      {f.mpg != null && f.costPerMile != null && " · "}
                      {f.costPerMile != null && `${money(f.costPerMile)}/mi`}
                      {f.partialFill && " · partial"}
                    </div>
                  </div>
                  <DeleteButton
                    action={deleteFuel}
                    id={f.id}
                    carId={carId}
                    editHref={`/cars/${carId}/fuel/${f.id}/edit`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Insurance log */}
        <Section title="Insurance" action={{ href: `/cars/${carId}/insurance/new`, label: "+ Add" }}>
          {insurance.length === 0 ? (
            <Empty>No insurance payments logged yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {insurance.map((ins) => (
                <li
                  key={ins.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-white/10"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{money(ins.amount)}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {formatDate(ins.date)}
                      {ins.provider && ` · ${ins.provider}`}
                    </div>
                    {ins.periodMonths > 1 && (
                      <div className="text-xs text-zinc-500">
                        {ins.periodMonths}-month policy · ≈{money(num(ins.amount) / ins.periodMonths)}/mo
                      </div>
                    )}
                    {ins.notes && <p className="mt-1 text-xs text-zinc-500">{ins.notes}</p>}
                  </div>
                  <DeleteButton
                    action={deleteInsurance}
                    id={ins.id}
                    carId={carId}
                    editHref={`/cars/${carId}/insurance/${ins.id}/edit`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Danger zone */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <form action={deleteCar}>
            <input type="hidden" name="id" value={carId} />
            <button className="text-sm text-red-400/80 active:text-red-400">Delete this car</button>
          </form>
        </div>
      </main>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="truncate text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Action({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 rounded-xl bg-zinc-900 py-3 ring-1 ring-white/10 active:bg-zinc-800"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-zinc-300">{label}</span>
    </Link>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm text-blue-400 active:text-blue-300">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-zinc-900/50 p-4 text-sm text-zinc-500 ring-1 ring-white/5">
      {children}
    </p>
  );
}

function DeleteButton({
  action,
  id,
  carId,
  editHref,
}: {
  action: (form: FormData) => void;
  id: number;
  carId: number;
  editHref?: string;
}) {
  return (
    <div className="mt-1 flex flex-col items-end gap-1">
      {editHref && (
        <Link href={editHref} className="text-xs text-zinc-500 active:text-blue-300">
          Edit
        </Link>
      )}
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="carId" value={carId} />
        <button className="text-xs text-zinc-600 active:text-red-400" aria-label="Delete">
          Delete
        </button>
      </form>
    </div>
  );
}

function intervalText(mi: number | null, mo: number | null): string {
  const parts: string[] = [];
  if (mi) parts.push(`every ${miles(mi)}`);
  if (mo) parts.push(`every ${mo} mo`);
  return parts.length ? parts.join(" / ") : "no interval";
}
