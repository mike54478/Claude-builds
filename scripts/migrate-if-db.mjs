// Runs drizzle migrations only when a database is configured.
// Lets the same build work in demo mode (no DATABASE_URL) and full mode.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL set — skipping migrations (demo mode).");
  process.exit(0);
}

const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
