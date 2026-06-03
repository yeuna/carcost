import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createOdometerReading } from "@/lib/actions";
import { getCar } from "@/lib/queries";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewOdometerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Log odometer reading</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Record the current mileage without logging fuel or maintenance.
        </p>
        <form action={createOdometerReading} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                name="date"
                defaultValue={today()}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Odometer">
              <input
                name="odometer"
                inputMode="numeric"
                required
                autoFocus
                className={inputClass}
                placeholder="miles"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows={2}
              className={inputClass}
              placeholder="Pre-trip, inspection, etc."
            />
          </Field>

          <SubmitButton>Save reading</SubmitButton>
        </form>
      </main>
    </>
  );
}
