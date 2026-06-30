import type { CostStats } from "@/lib/queries";
import { money, miles, perMile } from "@/lib/utils";

const COLORS = {
  maintenance: "#3b82f6", // blue
  fuel: "#f59e0b", // amber
  insurance: "#8b5cf6", // violet
};

// All-in cost analytics for a single car: cost per mile, average monthly spend,
// and a projected yearly cost based on the pace so far.
export function CostInsights({ stats }: { stats: CostStats }) {
  const { costPerMile, avgPerMonth, projectedAnnual, milesDriven, monthsTracked, breakdownPerMile } =
    stats;

  // Nothing to compute yet — no spend and no mileage span.
  if (costPerMile == null && avgPerMonth == null) {
    return (
      <div className="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold text-zinc-300">Cost insights</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Log a couple of fill-ups or services with odometer readings to see cost per mile and
          monthly trends.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
      <h2 className="text-sm font-semibold text-zinc-300">Cost insights</h2>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat
          value={costPerMile != null ? perMile(costPerMile) : "—"}
          label="all-in / mile"
        />
        <Stat value={avgPerMonth != null ? money(avgPerMonth) : "—"} label="avg / month" />
        <Stat
          value={projectedAnnual != null ? money(projectedAnnual) : "—"}
          label="≈ / year"
        />
      </div>

      {/* Cost-per-mile composition bar */}
      {breakdownPerMile && costPerMile != null && costPerMile > 0 && (
        <div className="mt-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <span
              style={{
                width: `${(breakdownPerMile.maintenance / costPerMile) * 100}%`,
                background: COLORS.maintenance,
              }}
            />
            <span
              style={{
                width: `${(breakdownPerMile.fuel / costPerMile) * 100}%`,
                background: COLORS.fuel,
              }}
            />
            <span
              style={{
                width: `${(breakdownPerMile.insurance / costPerMile) * 100}%`,
                background: COLORS.insurance,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
            <Legend color={COLORS.maintenance} label="Maint" value={perMile(breakdownPerMile.maintenance)} />
            <Legend color={COLORS.fuel} label="Fuel" value={perMile(breakdownPerMile.fuel)} />
            <Legend color={COLORS.insurance} label="Insurance" value={perMile(breakdownPerMile.insurance)} />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        {milesDriven != null ? `${miles(milesDriven)} driven` : "Mileage span unknown"}
        {` · over ${monthsTracked} ${monthsTracked === 1 ? "month" : "months"}`}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="truncate text-lg font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label} <span className="text-zinc-500">{value}</span>
    </span>
  );
}
