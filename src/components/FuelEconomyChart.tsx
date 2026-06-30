import type { FuelWithMpg } from "@/lib/queries";
import { money, num } from "@/lib/utils";

const BAR_MAX_PX = 96;
const MAX_BARS = 24; // keep bars legible on a phone

// MPG over time, drawn from the per-fill-up figures already computed in queries.
// Only full fill-ups produce an MPG value, so partials are skipped here.
export function FuelEconomyChart({ fuel }: { fuel: FuelWithMpg[] }) {
  // Oldest → newest so the trend reads left-to-right.
  const withMpg = fuel
    .filter((f) => f.mpg != null && f.mpg > 0)
    .sort((a, b) => a.odometer - b.odometer);

  // Average cost per gallon across every fill-up that recorded gallons.
  let gallons = 0;
  let fuelCost = 0;
  for (const f of fuel) {
    const g = num(f.gallons);
    if (g > 0) {
      gallons += g;
      fuelCost += num(f.totalCost);
    }
  }
  const avgCostPerGal = gallons > 0 ? fuelCost / gallons : null;

  if (withMpg.length < 2) {
    return (
      <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold text-zinc-300">Fuel economy</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Log at least two full fill-ups with gallons and odometer to chart your MPG.
        </p>
      </div>
    );
  }

  const shown = withMpg.slice(-MAX_BARS);
  const mpgValues = withMpg.map((f) => f.mpg as number);
  const avgMpg = mpgValues.reduce((a, v) => a + v, 0) / mpgValues.length;
  const bestMpg = Math.max(...mpgValues);
  const max = Math.max(...shown.map((f) => f.mpg as number), 1);

  return (
    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/10">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Fuel economy</h2>
        <span className="text-xs text-zinc-500">{avgMpg.toFixed(1)} mpg avg</span>
      </div>

      {/* Bars */}
      <div
        className="mt-3 flex items-end justify-between gap-1"
        style={{ height: BAR_MAX_PX + 18 }}
      >
        {shown.map((f) => {
          const mpg = f.mpg as number;
          const h = Math.max(2, Math.round((mpg / max) * BAR_MAX_PX));
          // Tint above-average fills green, below-average amber.
          const color = mpg >= avgMpg ? "#10b981" : "#f59e0b";
          return (
            <div key={f.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full max-w-[26px] items-end"
                style={{ height: BAR_MAX_PX }}
                title={`${shortDate(f.date)}: ${mpg.toFixed(1)} mpg`}
              >
                <div className="w-full rounded-md" style={{ height: h, background: color }} />
              </div>
              <span className="text-[9px] text-zinc-600">{shortDate(f.date)}</span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
        <Stat value={`${avgMpg.toFixed(1)}`} label="avg mpg" />
        <Stat value={`${bestMpg.toFixed(1)}`} label="best mpg" />
        <Stat value={avgCostPerGal != null ? `${money(avgCostPerGal)}` : "—"} label="avg / gal" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="truncate text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

// "YYYY-MM-DD" → "M/D" for compact axis labels.
function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
}
