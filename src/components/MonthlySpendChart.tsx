import type { MonthlySpend } from "@/lib/queries";
import { money } from "@/lib/utils";

const COLORS = {
  maintenance: "#3b82f6", // blue
  fuel: "#f59e0b", // amber
  insurance: "#8b5cf6", // violet
};

const BAR_MAX_PX = 120;

export function MonthlySpendChart({ data }: { data: MonthlySpend[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const grandTotal = data.reduce((a, d) => a + d.total, 0);
  const monthsWithSpend = data.filter((d) => d.total > 0).length;
  const avg = monthsWithSpend > 0 ? grandTotal / monthsWithSpend : 0;

  if (grandTotal === 0) {
    return (
      <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold text-zinc-300">Monthly spending</h2>
        <p className="mt-3 text-sm text-zinc-500">
          No spending logged yet. Add maintenance, fuel, or insurance to see the chart.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Monthly spending</h2>
        <span className="text-xs text-zinc-500">~{money(avg)}/mo avg</span>
      </div>

      {/* Bars */}
      <div className="mt-3 flex items-end justify-between gap-1" style={{ height: BAR_MAX_PX + 24 }}>
        {data.map((d) => {
          const h = (v: number) => Math.round((v / max) * BAR_MAX_PX);
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full max-w-[26px] flex-col-reverse overflow-hidden rounded-md"
                style={{ height: BAR_MAX_PX }}
                title={`${d.label}: ${money(d.total)}`}
              >
                {d.insurance > 0 && (
                  <div style={{ height: h(d.insurance), background: COLORS.insurance }} />
                )}
                {d.fuel > 0 && <div style={{ height: h(d.fuel), background: COLORS.fuel }} />}
                {d.maintenance > 0 && (
                  <div style={{ height: h(d.maintenance), background: COLORS.maintenance }} />
                )}
              </div>
              <span className="text-[10px] text-zinc-500">{d.label}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        <Legend color={COLORS.maintenance} label="Maintenance" />
        <Legend color={COLORS.fuel} label="Fuel" />
        <Legend color={COLORS.insurance} label="Insurance" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
