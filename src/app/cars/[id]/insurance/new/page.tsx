import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createInsurance } from "@/lib/actions";
import { getCar } from "@/lib/queries";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewInsurancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Add insurance payment</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Log what you paid. If it covers multiple months (e.g. a 6-month policy), set the period and
          the monthly chart will spread it out.
        </p>
        <form action={createInsurance} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount paid">
              <input name="amount" inputMode="decimal" required autoFocus className={inputClass} placeholder="$0.00" />
            </Field>
            <Field label="Date">
              <input type="date" name="date" defaultValue={today()} required className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Covers (months)" hint="1 = monthly, 6 = 6-month policy">
              <input name="periodMonths" inputMode="numeric" defaultValue="1" className={inputClass} />
            </Field>
            <Field label="Provider">
              <input name="provider" className={inputClass} placeholder="Geico" />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea name="notes" rows={2} className={inputClass} placeholder="Policy #, coverage, etc." />
          </Field>

          <SubmitButton>Save payment</SubmitButton>
        </form>
      </main>
    </>
  );
}
