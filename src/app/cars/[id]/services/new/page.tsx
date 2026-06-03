import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createServiceSchedule } from "@/lib/actions";
import { getCar } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-2 text-2xl font-bold">Add a service</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Set a mileage and/or time interval. CarCost will remind you when it’s due based on your
          latest odometer reading.
        </p>
        <form action={createServiceSchedule} className="space-y-4">
          <input type="hidden" name="carId" value={carId} />

          <Field label="Service name">
            <input name="name" required autoFocus className={inputClass} placeholder="Oil change" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Every (miles)">
              <input name="intervalMiles" inputMode="numeric" className={inputClass} placeholder="5000" />
            </Field>
            <Field label="Every (months)">
              <input name="intervalMonths" inputMode="numeric" className={inputClass} placeholder="6" />
            </Field>
          </div>

          <div className="rounded-xl bg-zinc-900/50 p-4 ring-1 ring-white/5">
            <p className="mb-3 text-sm font-medium text-zinc-300">Last done (optional baseline)</p>
            <p className="mb-3 text-xs text-zinc-500">
              If you know when it was last done, enter it here to start tracking. Otherwise, link a
              maintenance entry to this service later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="At odometer">
                <input name="lastServiceOdometer" inputMode="numeric" className={inputClass} placeholder="miles" />
              </Field>
              <Field label="On date">
                <input type="date" name="lastServiceDate" className={inputClass} />
              </Field>
            </div>
          </div>

          <SubmitButton>Save service</SubmitButton>
        </form>
      </main>
    </>
  );
}
