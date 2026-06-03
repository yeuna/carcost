import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { updateInsurance } from "@/lib/actions";
import { getCar, getInsuranceEntry } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditInsurancePage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const carId = parseInt(id, 10);
  const entryIdNum = parseInt(entryId, 10);

  const [entry, car] = await Promise.all([getInsuranceEntry(entryIdNum), getCar(carId)]);

  if (!entry || !car || entry.carId !== carId) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Edit insurance payment</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Log what you paid. If it covers multiple months (e.g. a 6-month policy), set the period
          and the monthly chart will spread it out.
        </p>
        <form action={updateInsurance} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />
          <input type="hidden" name="entryId" value={entry.id} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount paid">
              <input
                name="amount"
                inputMode="decimal"
                required
                autoFocus
                defaultValue={String(entry.amount)}
                className={inputClass}
                placeholder="$0.00"
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                name="date"
                defaultValue={entry.date}
                required
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Covers (months)" hint="1 = monthly, 6 = 6-month policy">
              <input
                name="periodMonths"
                inputMode="numeric"
                defaultValue={String(entry.periodMonths)}
                className={inputClass}
              />
            </Field>
            <Field label="Provider">
              <input
                name="provider"
                defaultValue={entry.provider ?? ""}
                className={inputClass}
                placeholder="Geico"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows={2}
              defaultValue={entry.notes ?? ""}
              className={inputClass}
              placeholder="Policy #, coverage, etc."
            />
          </Field>

          <SubmitButton>Save changes</SubmitButton>
        </form>
      </main>
    </>
  );
}
