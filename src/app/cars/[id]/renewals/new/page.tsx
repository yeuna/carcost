import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createRenewal } from "@/lib/actions";
import { getCar } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewRenewalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Add a renewal</h1>
        <p className="mb-6 text-sm text-zinc-400">
          For date-based renewals like registration, inspection, or road tax. CarCost reminds you
          as the due date approaches and rolls it forward when you mark it renewed.
        </p>
        <form action={createRenewal} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />

          <Field label="What is it?">
            <input
              name="name"
              required
              autoFocus
              list="renewal-suggestions"
              className={inputClass}
              placeholder="Registration"
            />
            <datalist id="renewal-suggestions">
              <option value="Registration" />
              <option value="Emissions / smog check" />
              <option value="Safety inspection" />
              <option value="Road tax" />
              <option value="Toll transponder" />
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Next due date">
              <input type="date" name="dueDate" required className={inputClass} />
            </Field>
            <Field label="Repeats every (months)" hint="e.g. 12 yearly, 24 every 2 yrs. Blank = one-time.">
              <input
                name="intervalMonths"
                inputMode="numeric"
                defaultValue="12"
                className={inputClass}
                placeholder="12"
              />
            </Field>
          </div>

          <Field label="Expected cost (optional)" hint="Shown for reference; not added to spend totals.">
            <input name="cost" inputMode="decimal" className={inputClass} placeholder="0.00" />
          </Field>

          <Field label="Notes (optional)">
            <input name="notes" className={inputClass} placeholder="Plate ABC-123, county office…" />
          </Field>

          <SubmitButton>Save renewal</SubmitButton>
        </form>
      </main>
    </>
  );
}
