import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createMigratedDatabase } from "./helpers";

describe("initial database migration", () => {
  it("migrates a blank database and creates every F1 table", () => {
    const database = createMigratedDatabase();

    try {
      const tables = database.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toEqual(
        expect.arrayContaining([
          "app_settings",
          "check_runs",
          "checks",
          "events",
          "notes",
          "project_types",
          "projects",
          "step_checks",
          "step_dependencies",
          "steps",
          "ticket_dependencies",
          "tickets",
        ]),
      );
    } finally {
      database.dispose();
    }
  });

  it("seeds exactly the project type templates idempotently", () => {
    const database = createMigratedDatabase();

    try {
      execFileSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "src/db/seed.ts"],
        {
          cwd: process.cwd(),
          env: { ...process.env, PLAN_DB_PATH: database.path },
        },
      );
      execFileSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "src/db/seed.ts"],
        {
          cwd: process.cwd(),
          env: { ...process.env, PLAN_DB_PATH: database.path },
        },
      );

      const projectTypes = database.sqlite
        .prepare("SELECT id FROM project_types ORDER BY id")
        .all()
        .map((row) => (row as { id: string }).id);

      expect(projectTypes).toEqual([
        "data-pipeline",
        "library",
        "micro-saas",
        "other",
        "web-app",
      ]);
      expect(existsSync(database.path)).toBe(true);
    } finally {
      database.dispose();
    }
  });
});
