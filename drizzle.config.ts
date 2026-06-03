import { readFileSync } from "node:fs";
import type { Config } from "drizzle-kit";

// Load env from .env.local (falling back to .env) without adding a dependency.
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {
      // file not present — ignore
    }
  }
}
loadEnv();

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
