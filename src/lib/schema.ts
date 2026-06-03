import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  date,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// A vehicle you own.
export const cars = pgTable("cars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "2015 Honda Accord"
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A maintenance event: either DIY (with line-item parts) or a dealer/shop visit (lump sum).
export const maintenance = pgTable("maintenance", {
  id: serial("id").primaryKey(),
  carId: integer("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  odometer: integer("odometer").notNull(),
  type: text("type").notNull().default("diy"), // 'diy' | 'dealer'
  title: text("title").notNull(), // e.g. "Oil change"
  shop: text("shop"), // for dealer/shop visits
  laborCost: numeric("labor_cost", { precision: 10, scale: 2 }), // dealer labor or lump sum
  notes: text("notes"),
  // Optional link to a service schedule this entry satisfies (resets the interval).
  scheduleId: integer("schedule_id").references(() => serviceSchedules.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Parts/items purchased for a DIY maintenance entry.
export const maintenanceItems = pgTable("maintenance_items", {
  id: serial("id").primaryKey(),
  maintenanceId: integer("maintenance_id")
    .notNull()
    .references(() => maintenance.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Oil filter"
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
});

// A gas fill-up.
export const fuel = pgTable("fuel", {
  id: serial("id").primaryKey(),
  carId: integer("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  odometer: integer("odometer").notNull(),
  gallons: numeric("gallons", { precision: 8, scale: 3 }),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  partialFill: boolean("partial_fill").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// An insurance payment. `periodMonths` lets a multi-month premium (e.g. a
// 6-month policy) be spread evenly across months in reports.
export const insurance = pgTable("insurance", {
  id: serial("id").primaryKey(),
  carId: integer("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  periodMonths: integer("period_months").notNull().default(1),
  provider: text("provider"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A recurring service with a mileage and/or time interval (drives reminders).
export const serviceSchedules = pgTable("service_schedules", {
  id: serial("id").primaryKey(),
  carId: integer("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Oil change"
  intervalMiles: integer("interval_miles"), // e.g. 5000
  intervalMonths: integer("interval_months"), // e.g. 6
  // Manual baseline for when this service was last performed, used until a
  // linked maintenance entry exists.
  lastServiceOdometer: integer("last_service_odometer"),
  lastServiceDate: date("last_service_date"),
  // Email-reminder de-duplication: the status we last emailed about and when.
  notifiedStatus: text("notified_status"), // 'soon' | 'overdue' | null
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A standalone odometer reading — lets the current mileage be tracked without
// needing a maintenance or fuel entry.
export const odometerReadings = pgTable("odometer_readings", {
  id: serial("id").primaryKey(),
  carId: integer("car_id")
    .notNull()
    .references(() => cars.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  odometer: integer("odometer").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Brute-force protection: failed-login tracking per client IP.
export const loginThrottle = pgTable("login_throttle", {
  ip: text("ip").primaryKey(),
  fails: integer("fails").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Car = typeof cars.$inferSelect;
export type Maintenance = typeof maintenance.$inferSelect;
export type MaintenanceItem = typeof maintenanceItems.$inferSelect;
export type Fuel = typeof fuel.$inferSelect;
export type Insurance = typeof insurance.$inferSelect;
export type ServiceSchedule = typeof serviceSchedules.$inferSelect;
export type OdometerReading = typeof odometerReadings.$inferSelect;
