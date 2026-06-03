import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { updateCar } from "@/lib/actions";
import { getCar } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const car = await getCar(carId);
  if (!car) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Edit car</h1>
        <form action={updateCar} className="space-y-4">
          <input type="hidden" name="id" value={carId} />
          <Field label="Name" hint='Shown everywhere — e.g. "2015 Honda Accord"'>
            <input
              name="name"
              required
              autoFocus
              defaultValue={car.name}
              className={inputClass}
              placeholder="2015 Honda Accord"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input
                name="year"
                inputMode="numeric"
                defaultValue={car.year ?? ""}
                className={inputClass}
                placeholder="2015"
              />
            </Field>
            <Field label="Color">
              <input
                name="color"
                defaultValue={car.color ?? ""}
                className={inputClass}
                placeholder="Silver"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make">
              <input
                name="make"
                defaultValue={car.make ?? ""}
                className={inputClass}
                placeholder="Honda"
              />
            </Field>
            <Field label="Model">
              <input
                name="model"
                defaultValue={car.model ?? ""}
                className={inputClass}
                placeholder="Accord"
              />
            </Field>
          </div>
          <SubmitButton>Save changes</SubmitButton>
        </form>
      </main>
    </>
  );
}
