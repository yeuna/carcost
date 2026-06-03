import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazily initialise so that `next build` doesn't require DATABASE_URL to be
// present at build time — the connection is only created on first query.
let _db: NeonHttpDatabase<typeof schema> | null = null;

function init(): NeonHttpDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) _db = init();
    return Reflect.get(_db, prop, receiver);
  },
});
