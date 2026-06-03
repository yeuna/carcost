import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MaintenanceForm } from "@/components/MaintenanceForm";
import { getCarDetail } from "@/lib/queries";
import { today } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carId = parseInt(id, 10);
  const data = await getCarDetail(carId);
  if (!data) notFound();

  return (
    <>
      <Header back={{ href: `/cars/${carId}`, label: data.car.name }} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="mb-6 text-2xl font-bold">Log maintenance</h1>
        <MaintenanceForm
          carId={carId}
          today={today()}
          schedules={data.schedules.map((s) => ({ id: s.id, name: s.name }))}
        />
      </main>
    </>
  );
}
