import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createFuel } from "@/lib/actions";
import { getCar } from "@/lib/queries";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewFuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Add fill-up</h1>
        <form action={createFuel} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" name="date" defaultValue={today()} required className={inputClass} />
            </Field>
            <Field label="Odometer">
              <input name="odometer" inputMode="numeric" required className={inputClass} placeholder="miles" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total cost">
              <input name="totalCost" inputMode="decimal" required className={inputClass} placeholder="$0.00" />
            </Field>
            <Field label="Gallons" hint="Optional — enables MPG">
              <input name="gallons" inputMode="decimal" className={inputClass} placeholder="0.000" />
            </Field>
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
            <input type="checkbox" name="partialFill" className="h-5 w-5 accent-blue-600" />
            <span className="text-sm text-zinc-300">
              Partial fill — didn’t fill the tank (still counts toward the next full fill’s MPG)
            </span>
          </label>

          <Field label="Notes (optional)">
            <textarea name="notes" rows={2} className={inputClass} placeholder="Station, fuel grade, etc." />
          </Field>

          <details className="rounded-xl bg-zinc-900/50 p-4 text-sm ring-1 ring-white/5">
            <summary className="cursor-pointer text-zinc-300">How MPG is calculated</summary>
            <div className="mt-2 space-y-2 text-xs text-zinc-400">
              <p>
                MPG is measured between <span className="text-zinc-200">full</span> fill-ups. Filling
                until the pump clicks off puts the tank at a known level, so every gallon added after
                that must be replacing fuel you burned.
              </p>
              <p>
                Your first full fill-up just sets the starting point. From the second full fill-up on,
                each one gets an MPG: miles driven since the last full fill ÷ all gallons added since
                then. It doesn&apos;t matter how much gas is in the tank when you start, and you never
                need to run it low.
              </p>
              <p>
                Partial fill-ups (didn&apos;t fill the tank) can&apos;t get their own MPG, but their
                gallons still count toward the next full fill-up&apos;s number — so log them too.
              </p>
            </div>
          </details>

          <SubmitButton>Save fill-up</SubmitButton>
        </form>
      </main>
    </>
  );
}
