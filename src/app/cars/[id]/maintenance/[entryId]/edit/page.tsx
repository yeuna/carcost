import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MaintenanceForm } from "@/components/MaintenanceForm";
import { updateMaintenance } from "@/lib/actions";
import { getCar, getMaintenanceEntry, getCarDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditMaintenancePage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const carId = parseInt(id, 10);
  const entryIdNum = parseInt(entryId, 10);

  const [entry, car, detail] = await Promise.all([
    getMaintenanceEntry(entryIdNum),
    getCar(carId),
    getCarDetail(carId),
  ]);

  if (!entry || !car || !detail || entry.carId !== carId) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Edit maintenance</h1>
        <MaintenanceForm
          action={updateMaintenance}
          carId={carId}
          schedules={detail.schedules.map((s) => ({ id: s.id, name: s.name }))}
          entry={entry}
        />
      </main>
    </>
  );
}
