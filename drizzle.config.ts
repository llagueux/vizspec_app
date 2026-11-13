import { homedir } from "node:os";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const databasePath = process.env.PLAN_DB_PATH
  ? resolve(process.env.PLAN_DB_PATH)
  : resolve(homedir(), ".plan-agentique", "plan.db");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databasePath,
  },
});
