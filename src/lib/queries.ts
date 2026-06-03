import { eq, desc, asc } from "drizzle-orm";
import { db } from "./db";
import {
  cars,
  maintenance,
  maintenanceItems,
  fuel,
  insurance,
  serviceSchedules,
  type Maintenance,
  type MaintenanceItem,
  type Fuel,
  type Insurance,
} from "./schema";
import { computeReminder, num, type Reminder } from "./utils";

export interface MaintenanceWithItems extends Maintenance {
  items: MaintenanceItem[];
  total: number;
}

export interface ScheduleWithReminder {
  id: number;
  name: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastOdometer: number | null;
  lastDate: string | null;
  reminder: Reminder;
}

export interface FuelWithMpg extends Fuel {
  mpg: number | null;
  costPerMile: number | null;
}

export async function getCars() {
  const allCars = await db.select().from(cars).orderBy(asc(cars.name));

  // Enrich each car with current odometer, total spend, and reminder summary.
  const result = await Promise.all(
    allCars.map(async (car) => {
      const detail = await getCarSummary(car.id);
      return { ...car, ...detail };
    }),
  );
  return result;
}

// Lightweight summary used on the dashboard.
export async function getCarSummary(carId: number) {
  const [maint, fuelRows, insuranceRows, schedules] = await Promise.all([
    db.select().from(maintenance).where(eq(maintenance.carId, carId)),
    db.select().from(fuel).where(eq(fuel.carId, carId)),
    db.select().from(insurance).where(eq(insurance.carId, carId)),
    db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, carId)),
  ]);

  const items = maint.length
    ? await db.select().from(maintenanceItems)
    : [];
  const itemsByMaint = groupItems(items);

  const currentOdometer = computeCurrentOdometer(maint, fuelRows);

  let totalSpent = 0;
  for (const m of maint) totalSpent += maintenanceTotal(m, itemsByMaint[m.id] ?? []);
  for (const f of fuelRows) totalSpent += num(f.totalCost);
  for (const ins of insuranceRows) totalSpent += num(ins.amount);

  const reminders = schedules.map((s) =>
    buildScheduleReminder(s, maint, currentOdometer),
  );
  const overdue = reminders.filter((r) => r.reminder.status === "overdue").length;
  const soon = reminders.filter((r) => r.reminder.status === "soon").length;

  return {
    currentOdometer,
    totalSpent,
    maintenanceCount: maint.length,
    fuelCount: fuelRows.length,
    overdue,
    soon,
  };
}

export async function getCar(carId: number) {
  const rows = await db.select().from(cars).where(eq(cars.id, carId)).limit(1);
  return rows[0] ?? null;
}

export async function getCarDetail(carId: number) {
  const car = await getCar(carId);
  if (!car) return null;

  const [maint, fuelRows, insuranceRows, schedules, allItems] = await Promise.all([
    db.select().from(maintenance).where(eq(maintenance.carId, carId)).orderBy(desc(maintenance.date), desc(maintenance.odometer)),
    db.select().from(fuel).where(eq(fuel.carId, carId)).orderBy(desc(fuel.date), desc(fuel.odometer)),
    db.select().from(insurance).where(eq(insurance.carId, carId)).orderBy(desc(insurance.date)),
    db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, carId)).orderBy(asc(serviceSchedules.name)),
    db.select().from(maintenanceItems),
  ]);

  const itemsByMaint = groupItems(allItems);
  const currentOdometer = computeCurrentOdometer(maint, fuelRows);

  const maintenanceList: MaintenanceWithItems[] = maint.map((m) => ({
    ...m,
    items: itemsByMaint[m.id] ?? [],
    total: maintenanceTotal(m, itemsByMaint[m.id] ?? []),
  }));

  const fuelList = withMpg(fuelRows);

  const scheduleList = schedules.map((s) =>
    buildScheduleReminder(s, maint, currentOdometer),
  );

  const maintenanceSpent = maintenanceList.reduce((a, m) => a + m.total, 0);
  const fuelSpent = fuelRows.reduce((a, f) => a + num(f.totalCost), 0);
  const insuranceSpent = insuranceRows.reduce((a, i) => a + num(i.amount), 0);
  const totalSpent = maintenanceSpent + fuelSpent + insuranceSpent;

  return {
    car,
    currentOdometer,
    totalSpent,
    maintenanceSpent,
    fuelSpent,
    insuranceSpent,
    maintenance: maintenanceList,
    fuel: fuelList,
    insurance: insuranceRows,
    schedules: scheduleList,
  };
}

export interface MonthlySpend {
  month: string; // 'YYYY-MM'
  label: string; // 'Jun'
  maintenance: number;
  fuel: number;
  insurance: number;
  total: number;
}

// Total spending per month across all cars for the last `monthsBack` months.
// Insurance payments are spread evenly across the months they cover.
export async function getMonthlySpending(monthsBack = 12): Promise<MonthlySpend[]> {
  const [maint, fuelRows, insuranceRows, allItems] = await Promise.all([
    db.select().from(maintenance),
    db.select().from(fuel),
    db.select().from(insurance),
    db.select().from(maintenanceItems),
  ]);
  const itemsByMaint = groupItems(allItems);

  // Build the ordered list of month buckets ending with the current month.
  const now = new Date();
  const buckets: MonthlySpend[] = [];
  const index: Record<string, MonthlySpend> = {};
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const b: MonthlySpend = {
      month: key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      maintenance: 0,
      fuel: 0,
      insurance: 0,
      total: 0,
    };
    buckets.push(b);
    index[key] = b;
  }

  for (const m of maint) {
    const b = index[m.date.slice(0, 7)];
    if (b) b.maintenance += maintenanceTotal(m, itemsByMaint[m.id] ?? []);
  }
  for (const f of fuelRows) {
    const b = index[f.date.slice(0, 7)];
    if (b) b.fuel += num(f.totalCost);
  }
  // Spread each insurance payment across its coverage period.
  for (const ins of insuranceRows) {
    const months = Math.max(1, ins.periodMonths);
    const perMonth = num(ins.amount) / months;
    const start = new Date(ins.date.slice(0, 4) + "-" + ins.date.slice(5, 7) + "-01T00:00:00");
    for (let k = 0; k < months; k++) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      const b = index[monthKey(d)];
      if (b) b.insurance += perMonth;
    }
  }
  for (const b of buckets) b.total = b.maintenance + b.fuel + b.insurance;

  return buckets;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface DueService {
  scheduleId: number;
  carId: number;
  carName: string;
  name: string;
  status: "soon" | "overdue";
  label: string;
  notifiedStatus: string | null;
  notifiedAt: Date | null;
}

// All services currently due-soon or overdue across every car, with the
// dedup fields needed to decide whether to email about them.
export async function getDueServices(): Promise<DueService[]> {
  const allCars = await db.select().from(cars);
  const out: DueService[] = [];

  for (const car of allCars) {
    const [maint, fuelRows, schedules] = await Promise.all([
      db.select().from(maintenance).where(eq(maintenance.carId, car.id)),
      db.select().from(fuel).where(eq(fuel.carId, car.id)),
      db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, car.id)),
    ]);
    const currentOdometer = computeCurrentOdometer(maint, fuelRows);

    for (const s of schedules) {
      const r = buildScheduleReminder(s, maint, currentOdometer);
      if (r.reminder.status === "soon" || r.reminder.status === "overdue") {
        out.push({
          scheduleId: s.id,
          carId: car.id,
          carName: car.name,
          name: s.name,
          status: r.reminder.status,
          label: r.reminder.label,
          notifiedStatus: s.notifiedStatus,
          notifiedAt: s.notifiedAt,
        });
      }
    }
  }
  return out;
}

export async function getMaintenanceEntry(id: number): Promise<MaintenanceWithItems | null> {
  const rows = await db.select().from(maintenance).where(eq(maintenance.id, id)).limit(1);
  if (!rows[0]) return null;
  const items = await db.select().from(maintenanceItems).where(eq(maintenanceItems.maintenanceId, id));
  return { ...rows[0], items, total: maintenanceTotal(rows[0], items) };
}

export async function getFuelEntry(id: number): Promise<Fuel | null> {
  const rows = await db.select().from(fuel).where(eq(fuel.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getInsuranceEntry(id: number): Promise<Insurance | null> {
  const rows = await db.select().from(insurance).where(eq(insurance.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function markNotified(scheduleId: number, status: string) {
  await db
    .update(serviceSchedules)
    .set({ notifiedStatus: status, notifiedAt: new Date() })
    .where(eq(serviceSchedules.id, scheduleId));
}

// Clear the notified flag for any schedule that is no longer due, so a future
// due event triggers a fresh email.
export async function clearStaleNotifications(dueScheduleIds: number[]) {
  const all = await db.select({ id: serviceSchedules.id, notifiedStatus: serviceSchedules.notifiedStatus }).from(serviceSchedules);
  for (const s of all) {
    if (s.notifiedStatus && !dueScheduleIds.includes(s.id)) {
      await db
        .update(serviceSchedules)
        .set({ notifiedStatus: null, notifiedAt: null })
        .where(eq(serviceSchedules.id, s.id));
    }
  }
}

// --- helpers ---

function groupItems(items: MaintenanceItem[]): Record<number, MaintenanceItem[]> {
  const map: Record<number, MaintenanceItem[]> = {};
  for (const it of items) {
    (map[it.maintenanceId] ??= []).push(it);
  }
  return map;
}

function maintenanceTotal(m: Maintenance, items: MaintenanceItem[]): number {
  if (m.type === "dealer") return num(m.laborCost);
  // DIY: parts + optional labor.
  const parts = items.reduce((a, it) => a + num(it.cost) * (it.quantity || 1), 0);
  return parts + num(m.laborCost);
}

function computeCurrentOdometer(maint: Maintenance[], fuelRows: Fuel[]): number | null {
  let max: number | null = null;
  for (const m of maint) if (max == null || m.odometer > max) max = m.odometer;
  for (const f of fuelRows) if (max == null || f.odometer > max) max = f.odometer;
  return max;
}

function buildScheduleReminder(
  s: typeof serviceSchedules.$inferSelect,
  maint: Maintenance[],
  currentOdometer: number | null,
): ScheduleWithReminder {
  // Find the most recent maintenance entry linked to this schedule.
  const linked = maint
    .filter((m) => m.scheduleId === s.id)
    .sort((a, b) => b.odometer - a.odometer);

  let lastOdometer = s.lastServiceOdometer ?? null;
  let lastDate = s.lastServiceDate ?? null;
  if (linked.length) {
    const latest = linked[0];
    if (lastOdometer == null || latest.odometer > lastOdometer) lastOdometer = latest.odometer;
    // Use the date of the highest-odometer linked entry.
    if (!lastDate || latest.date > lastDate) lastDate = latest.date;
  }

  const reminder = computeReminder({
    currentOdometer,
    intervalMiles: s.intervalMiles,
    intervalMonths: s.intervalMonths,
    lastOdometer,
    lastDate,
  });

  return {
    id: s.id,
    name: s.name,
    intervalMiles: s.intervalMiles,
    intervalMonths: s.intervalMonths,
    lastOdometer,
    lastDate,
    reminder,
  };
}

// Compute MPG and cost/mile for each fill-up based on the previous (lower-odometer) fill-up.
function withMpg(fuelRows: Fuel[]): FuelWithMpg[] {
  // Sort ascending by odometer to compute deltas.
  const asc = [...fuelRows].sort((a, b) => a.odometer - b.odometer);
  const mpgById: Record<number, { mpg: number | null; cpm: number | null }> = {};
  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1];
    const cur = asc[i];
    const dist = cur.odometer - prev.odometer;
    const gals = num(cur.gallons);
    if (dist > 0 && gals > 0 && !cur.partialFill) {
      mpgById[cur.id] = {
        mpg: dist / gals,
        cpm: num(cur.totalCost) / dist,
      };
    } else if (dist > 0) {
      mpgById[cur.id] = { mpg: null, cpm: num(cur.totalCost) / dist };
    } else {
      mpgById[cur.id] = { mpg: null, cpm: null };
    }
  }
  return fuelRows.map((f) => ({
    ...f,
    mpg: mpgById[f.id]?.mpg ?? null,
    costPerMile: mpgById[f.id]?.cpm ?? null,
  }));
}
