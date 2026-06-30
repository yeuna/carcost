"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { num, addMonthsStr } from "./utils";
import { cars, maintenance, maintenanceItems, fuel, insurance, serviceSchedules, odometerReadings, renewals, recurringInsuranceConfig } from "./schema";

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

// --- Account-level recurring insurance ---

export async function saveRecurringConfig(form: FormData) {
  const amount = optNum(form, "amount");
  const rawDay = optInt(form, "dayOfMonth");
  if (!amount || !rawDay) throw new Error("Amount and day are required");
  // Clamp to 1–28: days 29-31 silently skip months shorter than that day.
  const dayOfMonth = Math.min(28, Math.max(1, rawDay));
  const provider = optStr(form, "provider");

  const existing = await db
    .select({ id: recurringInsuranceConfig.id })
    .from(recurringInsuranceConfig)
    .limit(1);

  if (existing[0]) {
    await db
      .update(recurringInsuranceConfig)
      .set({ amount, dayOfMonth, provider, updatedAt: new Date() })
      .where(eq(recurringInsuranceConfig.id, existing[0].id));
  } else {
    await db.insert(recurringInsuranceConfig).values({ amount, dayOfMonth, provider });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function recordInsurancePayment(_form: FormData) {
  const [configs, allCars] = await Promise.all([
    db.select().from(recurringInsuranceConfig).limit(1),
    db.select().from(cars).where(isNull(cars.deletedAt)),
  ]);
  const cfg = configs[0];
  if (!cfg || !allCars.length) redirect("/");

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonth = todayStr.slice(0, 7);

  // Split amount evenly; remainder cents go on the first car.
  const totalCents = Math.round(num(cfg.amount) * 100);
  const n = allCars.length;
  const perCarCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - perCarCents * n;

  await db.insert(insurance).values(
    allCars.map((car, i) => ({
      carId: car.id,
      date: todayStr,
      amount: ((perCarCents + (i === 0 ? remainderCents : 0)) / 100).toFixed(2),
      periodMonths: 1,
      provider: cfg.provider,
    })),
  );

  await db
    .update(recurringInsuranceConfig)
    .set({ lastPaidMonth: thisMonth })
    .where(eq(recurringInsuranceConfig.id, cfg.id));

  const paths = ["/", ...allCars.map((c) => `/cars/${c.id}`)];
  for (const p of paths) revalidatePath(p);
  redirect("/");
}

export async function updateCar(form: FormData) {
  const id = optInt(form, "id");
  const name = str(form, "name");
  if (id == null) throw new Error("Missing id");
  if (!name) throw new Error("Name is required");
  await db
    .update(cars)
    .set({
      name,
      make: optStr(form, "make"),
      model: optStr(form, "model"),
      year: optInt(form, "year"),
      color: optStr(form, "color"),
    })
    .where(eq(cars.id, id));
  revalidatePath("/");
  revalidatePath(`/cars/${id}`);
  redirect(`/cars/${id}`);
}

export async function deleteCar(form: FormData) {
  const id = optInt(form, "id");
  if (id == null) return;
  // Soft delete: mark the row instead of cascading away all its history. The car
  // disappears from the app but its data is preserved (and recoverable / in backups).
  await db.update(cars).set({ deletedAt: new Date() }).where(eq(cars.id, id));
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
    // Fetch existing item IDs so we can target the delete precisely.
    // Insert new items first: if the insert fails, old items are still intact.
    // If the delete fails after a successful insert, the user sees duplicate
    // items (correctable by re-editing) rather than losing all items.
    // The HTTP driver does not support transactions, so this is the safest ordering.
    const existing = await db
      .select({ id: maintenanceItems.id })
      .from(maintenanceItems)
      .where(eq(maintenanceItems.maintenanceId, id));
    if (toInsert.length) await db.insert(maintenanceItems).values(toInsert);
    if (existing.length) {
      await db
        .delete(maintenanceItems)
        .where(inArray(maintenanceItems.id, existing.map((r) => r.id)));
    }
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

// --- Service schedule: mark done ---

export async function markServiceDone(form: FormData) {
  const carId = optInt(form, "carId");
  const scheduleId = optInt(form, "scheduleId");
  const odometer = optInt(form, "odometer") ?? 0;
  const title = str(form, "title") || "Service";
  if (carId == null || scheduleId == null) throw new Error("Missing data");
  await db.insert(maintenance).values({
    carId,
    date: new Date().toISOString().slice(0, 10),
    odometer,
    type: "diy",
    title,
    scheduleId,
  });
  revalidatePath("/");
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

// --- Odometer readings ---

export async function createOdometerReading(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  await db.insert(odometerReadings).values({
    carId,
    date: str(form, "date"),
    odometer: optInt(form, "odometer") ?? 0,
    notes: optStr(form, "notes"),
  });
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteOdometerReading(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(odometerReadings).where(eq(odometerReadings.id, id));
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

// --- Renewals (registration / inspection / tax) ---

export async function createRenewal(form: FormData) {
  const carId = optInt(form, "carId");
  if (carId == null) throw new Error("Missing car");
  const dueDate = str(form, "dueDate");
  if (!dueDate) throw new Error("Due date is required");
  await db.insert(renewals).values({
    carId,
    name: str(form, "name") || "Renewal",
    dueDate,
    intervalMonths: optInt(form, "intervalMonths"),
    cost: optNum(form, "cost"),
    notes: optStr(form, "notes"),
  });
  revalidatePath("/");
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

// Mark a renewal as just renewed. Recurring renewals advance their due date by
// the interval (skipping any missed periods so the next date is in the future);
// one-time renewals are removed once done.
export async function markRenewalDone(form: FormData) {
  const carId = optInt(form, "carId");
  const id = optInt(form, "id");
  if (carId == null || id == null) throw new Error("Missing data");

  const rows = await db.select().from(renewals).where(eq(renewals.id, id)).limit(1);
  const r = rows[0];
  if (!r) redirect(`/cars/${carId}`);

  if (r.intervalMonths && r.intervalMonths > 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    let next = r.dueDate;
    do {
      next = addMonthsStr(next, r.intervalMonths);
    } while (next <= todayStr);
    await db
      .update(renewals)
      .set({ dueDate: next, notifiedStatus: null, notifiedAt: null })
      .where(eq(renewals.id, id));
  } else {
    await db.delete(renewals).where(eq(renewals.id, id));
  }

  revalidatePath("/");
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}

export async function deleteRenewal(form: FormData) {
  const id = optInt(form, "id");
  const carId = optInt(form, "carId");
  if (id == null) return;
  await db.delete(renewals).where(eq(renewals.id, id));
  revalidatePath("/");
  revalidatePath(`/cars/${carId}`);
  redirect(`/cars/${carId}`);
}
