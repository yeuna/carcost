import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { updateFuel } from "@/lib/actions";
import { getCar, getFuelEntry } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditFuelPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const carId = parseInt(id, 10);
  const entryIdNum = parseInt(entryId, 10);

  const [entry, car] = await Promise.all([getFuelEntry(entryIdNum), getCar(carId)]);

  if (!entry || !car || entry.carId !== carId) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Edit fill-up</h1>
        <form action={updateFuel} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />
          <input type="hidden" name="entryId" value={entry.id} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                name="date"
                defaultValue={entry.date}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Odometer">
              <input
                name="odometer"
                inputMode="numeric"
                required
                defaultValue={String(entry.odometer)}
                className={inputClass}
                placeholder="miles"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total cost">
              <input
                name="totalCost"
                inputMode="decimal"
                required
                defaultValue={String(entry.totalCost)}
                className={inputClass}
                placeholder="$0.00"
              />
            </Field>
            <Field label="Gallons" hint="Optional — enables MPG">
              <input
                name="gallons"
                inputMode="decimal"
                defaultValue={entry.gallons ?? ""}
                className={inputClass}
                placeholder="0.000"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
            <input
              type="checkbox"
              name="partialFill"
              defaultChecked={entry.partialFill}
              className="h-5 w-5 accent-blue-600"
            />
            <span className="text-sm text-zinc-300">Partial fill (don&apos;t use for MPG)</span>
          </label>

          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows={2}
              defaultValue={entry.notes ?? ""}
              className={inputClass}
              placeholder="Station, fuel grade, etc."
            />
          </Field>

          <SubmitButton>Save changes</SubmitButton>
        </form>
      </main>
    </>
  );
}
