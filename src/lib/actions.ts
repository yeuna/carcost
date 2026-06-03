"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { cars, maintenance, maintenanceItems, fuel, insurance, serviceSchedules } from "./schema";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
function optStr(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === "" ? null : v;
}
function optInt(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === "") return null;
  const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? null : n;
}
function optNum(form: FormData, key: string): string | null {
  const v = str(form, key);
  if (v === "") return null;
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n.toFixed(2);
}

// --- Cars ---

export async function createCar(form: FormData) {
  const name = str(form, "name");
  if (!name) throw new Error("Name is required");
  const rows = await db
    .insert(cars)
    .values({
      name,
      make: optStr(form, "make"),
      model: optStr(form, "model"),
      year: optInt(form, "year"),
      color: optStr(form, "color"),
    })
    .returning({ id: cars.id });
  revalidatePath("/");
  redirect(`/cars/${rows[0].id}`);
}

export async function deleteCar(form: FormData) {
  const id = optInt(form, "id");
  if (id == null) return;
  await db.delete(cars).where(eq(cars.id, id));
  revalidatePath("/");
  redirect("/");
}

// --- Maintenance ---

export async function createMaintenance(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  const type = str(form, "type") === "dealer" ? "dealer" : "diy";

  const rows = await db
    .insert(maintenance)
    .values({
      carId,
      date: str(form, "date"),
      odometer: optInt(form, "odometer") ?? 0,
      type,
      title: str(form, "title") || "Service",
      shop: type === "dealer" ? optStr(form, "shop") : null,
      laborCost: optNum(form, "laborCost"),
      notes: optStr(form, "notes"),
      scheduleId: optInt(form, "scheduleId"),
    })
    .returning({ id: maintenance.id });

  const maintenanceId = rows[0].id;

  if (type === "diy") {
    const names = form.getAll("itemName").map((v) => String(v).trim());
    const costs = form.getAll("itemCost").map((v) => String(v).trim());
    const qtys = form.getAll("itemQty").map((v) => String(v).trim());
    const toInsert = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const costRaw = costs[i] ?? "";
      if (!name && !costRaw) continue; // skip empty rows
      const cost = parseFloat(costRaw.replace(/[^0-9.-]/g, ""));
      const qty = parseInt((qtys[i] ?? "1").replace(/[^0-9]/g, ""), 10);
      toInsert.push({
        maintenanceId,
        name: name || "Item",
        cost: (isNaN(cost) ? 0 : cost).toFixed(2),
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
      });
    }
    if (toInsert.length) await db.insert(maintenanceItems).values(toInsert);
  }

  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function updateMaintenance(form: FormData) {
  const id = optInt(form, "entryId");
  const carId = optInt(form, "carId");
  if (id == null || carId == null) throw new Error("Missing id");
  const type = str(form, "type") === "dealer" ? "dealer" : "diy";

  await db
    .update(maintenance)
    .set({
      date: str(form, "date"),
      odometer: optInt(form, "odometer") ?? 0,
      type,
      title: str(form, "title") || "Service",
      shop: type === "dealer" ? optStr(form, "shop") : null,
      laborCost: optNum(form, "laborCost"),
      notes: optStr(form, "notes"),
      scheduleId: optInt(form, "scheduleId"),
    })
    .where(eq(maintenance.id, id));

  if (type === "diy") {
    await db.delete(maintenanceItems).where(eq(maintenanceItems.maintenanceId, id));
    const names = form.getAll("itemName").map((v) => String(v).trim());
    const costs = form.getAll("itemCost").map((v) => String(v).trim());
    const qtys = form.getAll("itemQty").map((v) => String(v).trim());
    const toInsert = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const costRaw = costs[i] ?? "";
      if (!name && !costRaw) continue;
      const cost = parseFloat(costRaw.replace(/[^0-9.-]/g, ""));
      const qty = parseInt((qtys[i] ?? "1").replace(/[^0-9]/g, ""), 10);
      toInsert.push({
        maintenanceId: id,
        name: name || "Item",
        cost: (isNaN(cost) ? 0 : cost).toFixed(2),
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
      });
    }
    if (toInsert.length) await db.insert(maintenanceItems).values(toInsert);
  }

  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteMaintenance(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(maintenance).where(eq(maintenance.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

// --- Fuel ---

export async function createFuel(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  await db.insert(fuel).values({
    carId,
    date: str(form, "date"),
    odometer: optInt(form, "odometer") ?? 0,
    gallons: optNum(form, "gallons"),
    totalCost: optNum(form, "totalCost") ?? "0.00",
    partialFill: str(form, "partialFill") === "on",
    notes: optStr(form, "notes"),
  });
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function updateFuel(form: FormData) {
  const id = optInt(form, "entryId");
  const carId = optInt(form, "carId");
  if (id == null || carId == null) throw new Error("Missing id");
  await db
    .update(fuel)
    .set({
      date: str(form, "date"),
      odometer: optInt(form, "odometer") ?? 0,
      gallons: optNum(form, "gallons"),
      totalCost: optNum(form, "totalCost") ?? "0.00",
      partialFill: str(form, "partialFill") === "on",
      notes: optStr(form, "notes"),
    })
    .where(eq(fuel.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteFuel(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(fuel).where(eq(fuel.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

// --- Insurance ---

export async function createInsurance(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  await db.insert(insurance).values({
    carId,
    date: str(form, "date"),
    amount: optNum(form, "amount") ?? "0.00",
    periodMonths: optInt(form, "periodMonths") ?? 1,
    provider: optStr(form, "provider"),
    notes: optStr(form, "notes"),
  });
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function updateInsurance(form: FormData) {
  const id = optInt(form, "entryId");
  const carId = optInt(form, "carId");
  if (id == null || carId == null) throw new Error("Missing id");
  await db
    .update(insurance)
    .set({
      date: str(form, "date"),
      amount: optNum(form, "amount") ?? "0.00",
      periodMonths: optInt(form, "periodMonths") ?? 1,
      provider: optStr(form, "provider"),
      notes: optStr(form, "notes"),
    })
    .where(eq(insurance.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteInsurance(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(insurance).where(eq(insurance.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

// --- Service schedules ---

export async function createServiceSchedule(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  await db.insert(serviceSchedules).values({
    carId,
    name: str(form, "name") || "Service",
    intervalMiles: optInt(form, "intervalMiles"),
    intervalMonths: optInt(form, "intervalMonths"),
    lastServiceOdometer: optInt(form, "lastServiceOdometer"),
    lastServiceDate: optStr(form, "lastServiceDate"),
  });
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteServiceSchedule(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(serviceSchedules).where(eq(serviceSchedules.id, id));
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}
