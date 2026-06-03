import { Header } from "@/components/Header";
import { Field, inputClass, SubmitButton } from "@/components/Form";
import { createCar } from "@/lib/actions";

export default function NewCarPage() {
  return (
    <>
      <Header back={{ href: "/", label: "Cars" }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Add a car</h1>
        <form action={createCar} className="space-y-4">
          <Field label="Name" hint="Shown everywhere — e.g. “2015 Honda Accord”">
            <input name="name" required autoFocus className={inputClass} placeholder="2015 Honda Accord" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input name="year" inputMode="numeric" className={inputClass} placeholder="2015" />
            </Field>
            <Field label="Color">
              <input name="color" className={inputClass} placeholder="Silver" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make">
              <input name="make" className={inputClass} placeholder="Honda" />
            </Field>
            <Field label="Model">
              <input name="model" className={inputClass} placeholder="Accord" />
            </Field>
          </div>
          <SubmitButton>Save car</SubmitButton>
        </form>
      </main>
    </>
  );
}
