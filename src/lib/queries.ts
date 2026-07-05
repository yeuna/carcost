import { eq, desc, asc, isNull, and } from "drizzle-orm";
import { db } from "./db";
import {
  cars,
  maintenance,
  maintenanceItems,
  fuel,
  insurance,
  serviceSchedules,
  odometerReadings,
  renewals,
  recurringInsuranceConfig,
  type Maintenance,
  type MaintenanceItem,
  type Fuel,
  type Insurance,
  type OdometerReading,
  type Renewal,
  type RecurringInsuranceConfig,
} from "./schema";
import {
  computeReminder,
  computeRenewalReminder,
  num,
  type Reminder,
  type RenewalReminder,
} from "./utils";

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

export interface RenewalWithReminder extends Renewal {
  reminder: RenewalReminder;
}

// All-in cost analytics for a car (every category, not just fuel).
export interface CostStats {
  milesDriven: number | null; // observed span of odometer readings
  costPerMile: number | null; // total spend ÷ miles driven
  monthsTracked: number; // calendar months from first record to today (min 1)
  avgPerMonth: number | null; // total spend ÷ months tracked
  projectedAnnual: number | null; // avgPerMonth × 12
  breakdownPerMile: { maintenance: number; fuel: number; insurance: number } | null;
}

// Derive all-in cost metrics from a car's raw cost events. Miles driven is the
// span between the lowest and highest odometer we've seen; months tracked runs
// from the earliest dated record to today so $/mo reflects the full ownership
// window rather than only months with activity.
function computeCostStats(opts: {
  totalSpent: number;
  maintenanceSpent: number;
  fuelSpent: number;
  insuranceSpent: number;
  odometers: number[];
  dates: string[];
}): CostStats {
  const { totalSpent, maintenanceSpent, fuelSpent, insuranceSpent, odometers, dates } = opts;

  let milesDriven: number | null = null;
  if (odometers.length >= 2) {
    const min = Math.min(...odometers);
    const max = Math.max(...odometers);
    if (max > min) milesDriven = max - min;
  }
  const costPerMile = milesDriven ? totalSpent / milesDriven : null;
  const breakdownPerMile = milesDriven
    ? {
        maintenance: maintenanceSpent / milesDriven,
        fuel: fuelSpent / milesDriven,
        insurance: insuranceSpent / milesDriven,
      }
    : null;

  let monthsTracked = 1;
  if (dates.length) {
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    const a = new Date(earliest + "T00:00:00");
    const b = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
    monthsTracked = Math.max(
      1,
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1,
    );
  }
  const avgPerMonth = totalSpent > 0 ? totalSpent / monthsTracked : null;
  const projectedAnnual = avgPerMonth != null ? avgPerMonth * 12 : null;

  return { milesDriven, costPerMile, monthsTracked, avgPerMonth, projectedAnnual, breakdownPerMile };
}

// Returns the account-level recurring insurance config (single row) with an
// isDue flag indicating whether this month's payment needs to be recorded.
export async function getRecurringInsuranceConfig(): Promise<
  (RecurringInsuranceConfig & { isDue: boolean }) | null
> {
  const rows = await db.select().from(recurringInsuranceConfig).limit(1);
  if (!rows[0]) return null;
  const cfg = rows[0];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = parseInt(todayStr.slice(8, 10), 10);
  const thisMonth = todayStr.slice(0, 7);
  const isDue = todayDay >= cfg.dayOfMonth && cfg.lastPaidMonth !== thisMonth;
  return { ...cfg, isDue };
}

export async function getCars() {
  const allCars = await db
    .select()
    .from(cars)
    .where(isNull(cars.deletedAt))
    .orderBy(asc(cars.name));

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
  const [maint, fuelRows, insuranceRows, schedules, odometerRows, renewalRows] = await Promise.all([
    db.select().from(maintenance).where(eq(maintenance.carId, carId)),
    db.select().from(fuel).where(eq(fuel.carId, carId)),
    db.select().from(insurance).where(eq(insurance.carId, carId)),
    db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, carId)),
    db.select().from(odometerReadings).where(eq(odometerReadings.carId, carId)),
    db.select().from(renewals).where(eq(renewals.carId, carId)),
  ]);

  const items = maint.length
    ? await db.select().from(maintenanceItems)
    : [];
  const itemsByMaint = groupItems(items);

  const currentOdometer = computeCurrentOdometer(maint, fuelRows, odometerRows);

  let maintenanceSpent = 0;
  for (const m of maint) maintenanceSpent += maintenanceTotal(m, itemsByMaint[m.id] ?? []);
  const fuelSpent = fuelRows.reduce((a, f) => a + num(f.totalCost), 0);
  const insuranceSpent = insuranceRows.reduce((a, i) => a + num(i.amount), 0);
  const totalSpent = maintenanceSpent + fuelSpent + insuranceSpent;

  const stats = computeCostStats({
    totalSpent,
    maintenanceSpent,
    fuelSpent,
    insuranceSpent,
    odometers: [
      ...maint.map((m) => m.odometer),
      ...fuelRows.map((f) => f.odometer),
      ...odometerRows.map((o) => o.odometer),
    ],
    dates: [
      ...maint.map((m) => m.date),
      ...fuelRows.map((f) => f.date),
      ...insuranceRows.map((i) => i.date),
      ...odometerRows.map((o) => o.date),
    ],
  });

  const reminders = schedules.map((s) =>
    buildScheduleReminder(s, maint, currentOdometer),
  );
  const renewalReminders = renewalRows.map((r) => computeRenewalReminder(r.dueDate));
  const statuses = [
    ...reminders.map((r) => r.reminder.status),
    ...renewalReminders.map((r) => r.status),
  ];
  const overdue = statuses.filter((s) => s === "overdue").length;
  const soon = statuses.filter((s) => s === "soon").length;

  return {
    currentOdometer,
    totalSpent,
    maintenanceCount: maint.length,
    fuelCount: fuelRows.length,
    costPerMile: stats.costPerMile,
    avgPerMonth: stats.avgPerMonth,
    milesDriven: stats.milesDriven,
    overdue,
    soon,
  };
}

export async function getCar(carId: number) {
  const rows = await db
    .select()
    .from(cars)
    .where(and(eq(cars.id, carId), isNull(cars.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCarDetail(carId: number) {
  const car = await getCar(carId);
  if (!car) return null;

  const [maint, fuelRows, insuranceRows, schedules, allItems, odometerRows, renewalRows] = await Promise.all([
    db.select().from(maintenance).where(eq(maintenance.carId, carId)).orderBy(desc(maintenance.date), desc(maintenance.odometer)),
    db.select().from(fuel).where(eq(fuel.carId, carId)).orderBy(desc(fuel.date), desc(fuel.odometer)),
    db.select().from(insurance).where(eq(insurance.carId, carId)).orderBy(desc(insurance.date)),
    db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, carId)).orderBy(asc(serviceSchedules.name)),
    db.select().from(maintenanceItems),
    db.select().from(odometerReadings).where(eq(odometerReadings.carId, carId)).orderBy(desc(odometerReadings.date), desc(odometerReadings.odometer)),
    db.select().from(renewals).where(eq(renewals.carId, carId)).orderBy(asc(renewals.dueDate)),
  ]);

  const itemsByMaint = groupItems(allItems);
  const currentOdometer = computeCurrentOdometer(maint, fuelRows, odometerRows);

  const maintenanceList: MaintenanceWithItems[] = maint.map((m) => ({
    ...m,
    items: itemsByMaint[m.id] ?? [],
    total: maintenanceTotal(m, itemsByMaint[m.id] ?? []),
  }));

  const { list: fuelList, avgMpg } = withMpg(fuelRows);

  const scheduleList = schedules.map((s) =>
    buildScheduleReminder(s, maint, currentOdometer),
  );

  const renewalList: RenewalWithReminder[] = renewalRows.map((r) => ({
    ...r,
    reminder: computeRenewalReminder(r.dueDate),
  }));

  const maintenanceSpent = maintenanceList.reduce((a, m) => a + m.total, 0);
  const fuelSpent = fuelRows.reduce((a, f) => a + num(f.totalCost), 0);
  const insuranceSpent = insuranceRows.reduce((a, i) => a + num(i.amount), 0);
  const totalSpent = maintenanceSpent + fuelSpent + insuranceSpent;

  const stats = computeCostStats({
    totalSpent,
    maintenanceSpent,
    fuelSpent,
    insuranceSpent,
    odometers: [
      ...maint.map((m) => m.odometer),
      ...fuelRows.map((f) => f.odometer),
      ...odometerRows.map((o) => o.odometer),
    ],
    dates: [
      ...maint.map((m) => m.date),
      ...fuelRows.map((f) => f.date),
      ...insuranceRows.map((i) => i.date),
      ...odometerRows.map((o) => o.date),
    ],
  });

  return {
    car,
    currentOdometer,
    totalSpent,
    maintenanceSpent,
    fuelSpent,
    insuranceSpent,
    stats,
    avgMpg,
    maintenance: maintenanceList,
    fuel: fuelList,
    insurance: insuranceRows,
    schedules: scheduleList,
    renewals: renewalList,
    odometerReadings: odometerRows,
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

// The minimal shape the reminder email renders. Both due services and due
// renewals satisfy it, so the email digest can mix them.
export interface DueItem {
  carName: string;
  name: string;
  status: "soon" | "overdue";
  label: string;
}

export interface DueService extends DueItem {
  scheduleId: number;
  carId: number;
  notifiedStatus: string | null;
  notifiedAt: Date | null;
}

export interface DueRenewal extends DueItem {
  renewalId: number;
  carId: number;
  notifiedStatus: string | null;
  notifiedAt: Date | null;
}

// All services currently due-soon or overdue across every car, with the
// dedup fields needed to decide whether to email about them.
export async function getDueServices(): Promise<DueService[]> {
  const allCars = await db.select().from(cars).where(isNull(cars.deletedAt));
  const out: DueService[] = [];

  for (const car of allCars) {
    const [maint, fuelRows, schedules, odometerRows] = await Promise.all([
      db.select().from(maintenance).where(eq(maintenance.carId, car.id)),
      db.select().from(fuel).where(eq(fuel.carId, car.id)),
      db.select().from(serviceSchedules).where(eq(serviceSchedules.carId, car.id)),
      db.select().from(odometerReadings).where(eq(odometerReadings.carId, car.id)),
    ]);
    const currentOdometer = computeCurrentOdometer(maint, fuelRows, odometerRows);

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

// All renewals currently due-soon or overdue across every car, with the dedup
// fields needed to decide whether to email about them.
export async function getDueRenewals(): Promise<DueRenewal[]> {
  const allCars = await db.select().from(cars).where(isNull(cars.deletedAt));
  const carName: Record<number, string> = {};
  for (const c of allCars) carName[c.id] = c.name;

  const rows = await db.select().from(renewals);
  const out: DueRenewal[] = [];
  for (const r of rows) {
    if (!(r.carId in carName)) continue; // skip soft-deleted cars
    const reminder = computeRenewalReminder(r.dueDate);
    if (reminder.status === "soon" || reminder.status === "overdue") {
      out.push({
        renewalId: r.id,
        carId: r.carId,
        carName: carName[r.carId],
        name: r.name,
        status: reminder.status,
        label: reminder.label,
        notifiedStatus: r.notifiedStatus,
        notifiedAt: r.notifiedAt,
      });
    }
  }
  return out;
}

export async function markRenewalNotified(renewalId: number, status: string) {
  await db
    .update(renewals)
    .set({ notifiedStatus: status, notifiedAt: new Date() })
    .where(eq(renewals.id, renewalId));
}

// Clear the notified flag for any renewal that is no longer due, so a future
// due event triggers a fresh email.
export async function clearStaleRenewalNotifications(dueRenewalIds: number[]) {
  const all = await db
    .select({ id: renewals.id, notifiedStatus: renewals.notifiedStatus })
    .from(renewals);
  for (const r of all) {
    if (r.notifiedStatus && !dueRenewalIds.includes(r.id)) {
      await db
        .update(renewals)
        .set({ notifiedStatus: null, notifiedAt: null })
        .where(eq(renewals.id, r.id));
    }
  }
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

function computeCurrentOdometer(
  maint: Maintenance[],
  fuelRows: Fuel[],
  odometerRows: OdometerReading[] = [],
): number | null {
  let max: number | null = null;
  for (const m of maint) if (max == null || m.odometer > max) max = m.odometer;
  for (const f of fuelRows) if (max == null || f.odometer > max) max = f.odometer;
  for (const o of odometerRows) if (max == null || o.odometer > max) max = o.odometer;
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

// Compute MPG and cost/mile using windows between full fill-ups (the tank
// method). A full tank is the only fuel level you can reliably reproduce, so
// full fills act as anchors: every gallon added between one full fill and the
// next — partial fills included — was burned over that distance. Partials
// therefore no longer break the calculation; they just fold into the next
// full fill's number. avgMpg is total window distance / total window gallons.
function withMpg(fuelRows: Fuel[]): { list: FuelWithMpg[]; avgMpg: number | null } {
  const sorted = [...fuelRows].sort(
    (a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date),
  );
  const statsById: Record<number, { mpg: number; cpm: number }> = {};

  let anchor: Fuel | null = null; // last full fill (tank level known)
  let windowGallons = 0;
  let windowCost = 0;
  let windowValid = true; // false once a fill in the window is missing gallons
  let totalDist = 0;
  let totalGallons = 0;

  for (const cur of sorted) {
    if (anchor) {
      const gals = num(cur.gallons);
      if (gals > 0) {
        windowGallons += gals;
        windowCost += num(cur.totalCost);
      } else {
        windowValid = false;
      }
      const dist = cur.odometer - anchor.odometer;
      if (!cur.partialFill && windowValid && dist > 0 && windowGallons > 0) {
        statsById[cur.id] = {
          mpg: dist / windowGallons,
          cpm: windowCost / dist,
        };
        totalDist += dist;
        totalGallons += windowGallons;
      }
    }
    if (!cur.partialFill) {
      // Full fill: tank level is known again, so a new window starts here
      // even if this one couldn't be scored (e.g. missing gallons).
      anchor = cur;
      windowGallons = 0;
      windowCost = 0;
      windowValid = true;
    }
  }

  const list = fuelRows.map((f) => ({
    ...f,
    mpg: statsById[f.id]?.mpg ?? null,
    costPerMile: statsById[f.id]?.cpm ?? null,
  }));
  return { list, avgMpg: totalGallons > 0 ? totalDist / totalGallons : null };
}
