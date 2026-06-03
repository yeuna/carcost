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
            <span className="text-sm text-zinc-300">Partial fill (don’t use for MPG)</span>
          </label>

          <Field label="Notes (optional)">
            <textarea name="notes" rows={2} className={inputClass} placeholder="Station, fuel grade, etc." />
          </Field>

          <SubmitButton>Save fill-up</SubmitButton>
        </form>
      </main>
    </>
  );
}
