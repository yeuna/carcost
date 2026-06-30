import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  cars,
  maintenance,
  maintenanceItems,
  fuel,
  insurance,
  serviceSchedules,
  odometerReadings,
  recurringInsuranceConfig,
} from "./schema";

// A logical backup of every user table. `loginThrottle` is intentionally omitted —
// it is transient brute-force state, not user data worth restoring.
//
// Bump `version` if the shape of a table changes in a way a restore must handle.
export const BACKUP_VERSION = 1;

export interface Backup {
  app: "carcost";
  version: number;
  exportedAt: string; // ISO timestamp
  tables: Record<TableName, Record<string, unknown>[]>;
}

type TableName =
  | "cars"
  | "serviceSchedules"
  | "maintenance"
  | "maintenanceItems"
  | "fuel"
  | "insurance"
  | "odometerReadings"
  | "recurringInsuranceConfig";

// Ordered parent-before-child so inserts satisfy foreign keys on restore.
// Each entry lists the timestamp columns that must be revived from ISO strings
// back into Date objects before re-inserting (date/numeric columns stay strings).
const TABLES = [
  { name: "cars", table: cars, timestamps: ["createdAt", "deletedAt"] },
  { name: "serviceSchedules", table: serviceSchedules, timestamps: ["notifiedAt", "createdAt"] },
  { name: "maintenance", table: maintenance, timestamps: ["createdAt"] },
  { name: "maintenanceItems", table: maintenanceItems, timestamps: [] },
  { name: "fuel", table: fuel, timestamps: ["createdAt"] },
  { name: "insurance", table: insurance, timestamps: ["createdAt"] },
  { name: "odometerReadings", table: odometerReadings, timestamps: ["createdAt"] },
  { name: "recurringInsuranceConfig", table: recurringInsuranceConfig, timestamps: ["updatedAt"] },
] as const;

// Read every table verbatim (including soft-deleted cars) into one snapshot.
export async function exportAll(): Promise<Backup> {
  const results = await Promise.all(TABLES.map((t) => db.select().from(t.table)));
  const tables = {} as Backup["tables"];
  TABLES.forEach((t, i) => {
    tables[t.name] = results[i] as Record<string, unknown>[];
  });
  return {
    app: "carcost",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(date = new Date()): string {
  return `carcost-backup-${date.toISOString().slice(0, 10)}.json`;
}

export interface RestoreResult {
  restored: Record<string, number>;
  total: number;
}

// Replace all current data with the contents of a backup, preserving primary-key
// ids, then advance each serial sequence so future inserts don't collide.
//
// This is a recovery tool, not a merge: it deletes existing rows first. The HTTP
// driver has no transactions, so this is intended for restoring into an empty or
// broken database — not for routine use against live data.
export async function restoreAll(backup: Backup): Promise<RestoreResult> {
  if (backup?.app !== "carcost" || !backup.tables) {
    throw new Error("Not a CarCost backup file.");
  }

  // Delete child-before-parent (reverse of the insert order).
  for (const t of [...TABLES].reverse()) {
    await db.delete(t.table);
  }

  const restored: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = (backup.tables[t.name] ?? []).map((row) => reviveRow(row, t.timestamps));
    if (rows.length) {
      await db.insert(t.table).values(rows as never);
      // Advance the id sequence past the largest restored id.
      await db.execute(
        sql`select setval(pg_get_serial_sequence('${sql.raw(quotedTable(t.name))}', 'id'), (select max(id) from ${t.table}))`,
      );
    }
    restored[t.name] = rows.length;
  }

  const total = Object.values(restored).reduce((a, n) => a + n, 0);
  return { restored, total };
}

// Convert ISO-string timestamp fields back into Date objects for insertion.
function reviveRow(
  row: Record<string, unknown>,
  timestamps: readonly string[],
): Record<string, unknown> {
  const out = { ...row };
  for (const key of timestamps) {
    const v = out[key];
    if (typeof v === "string") out[key] = new Date(v);
  }
  return out;
}

// Map the camelCase table key to its actual (snake_case) Postgres table name for
// pg_get_serial_sequence, which needs the on-disk name.
function quotedTable(name: TableName): string {
  const map: Record<TableName, string> = {
    cars: "cars",
    serviceSchedules: "service_schedules",
    maintenance: "maintenance",
    maintenanceItems: "maintenance_items",
    fuel: "fuel",
    insurance: "insurance",
    odometerReadings: "odometer_readings",
    recurringInsuranceConfig: "recurring_insurance_config",
  };
  return map[name];
}
