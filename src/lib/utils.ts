export function money(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(isNaN(n) ? 0 : n);
}

export function num(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return isNaN(n) ? 0 : n;
}

export function miles(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US").format(value) + " mi";
}

// Cost per mile is usually under a dollar, so show cents (e.g. "43.2¢/mi"),
// falling back to dollars for higher figures.
export function perMile(value: number): string {
  if (value < 1) return `${(value * 100).toFixed(1)}¢/mi`;
  return `${money(value)}/mi`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + "T00:00:00") : value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export type ReminderStatus = "overdue" | "soon" | "ok" | "unknown";

export interface Reminder {
  status: ReminderStatus;
  // Mileage-based
  milesRemaining: number | null; // negative = overdue
  dueOdometer: number | null;
  // Time-based
  daysRemaining: number | null; // negative = overdue
  dueDate: Date | null;
  label: string; // short human summary
}

const SOON_MILES = 500;
const SOON_DAYS = 14;

export function computeReminder(opts: {
  currentOdometer: number | null;
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastOdometer: number | null;
  lastDate: string | null;
}): Reminder {
  const { currentOdometer, intervalMiles, intervalMonths, lastOdometer, lastDate } = opts;

  let milesRemaining: number | null = null;
  let dueOdometer: number | null = null;
  if (intervalMiles && lastOdometer != null && currentOdometer != null) {
    dueOdometer = lastOdometer + intervalMiles;
    milesRemaining = dueOdometer - currentOdometer;
  }

  let daysRemaining: number | null = null;
  let dueDate: Date | null = null;
  if (intervalMonths && lastDate) {
    dueDate = addMonths(lastDate, intervalMonths);
    const ms = dueDate.getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
    daysRemaining = Math.round(ms / (1000 * 60 * 60 * 24));
  }

  // Status is the worst of the two dimensions.
  let status: ReminderStatus = "unknown";
  const considered: ReminderStatus[] = [];
  if (milesRemaining != null) {
    considered.push(milesRemaining <= 0 ? "overdue" : milesRemaining <= SOON_MILES ? "soon" : "ok");
  }
  if (daysRemaining != null) {
    considered.push(daysRemaining <= 0 ? "overdue" : daysRemaining <= SOON_DAYS ? "soon" : "ok");
  }
  if (considered.includes("overdue")) status = "overdue";
  else if (considered.includes("soon")) status = "soon";
  else if (considered.includes("ok")) status = "ok";

  // Build a short label.
  let label = "Set a baseline to track";
  const parts: string[] = [];
  if (milesRemaining != null) {
    parts.push(milesRemaining <= 0 ? `${miles(-milesRemaining)} overdue` : `${miles(milesRemaining)} left`);
  }
  if (daysRemaining != null) {
    if (daysRemaining <= 0) parts.push(`${-daysRemaining}d overdue`);
    else parts.push(`${daysRemaining}d left`);
  }
  if (parts.length) label = parts.join(" · ");

  return { status, milesRemaining, dueOdometer, daysRemaining, dueDate, label };
}
