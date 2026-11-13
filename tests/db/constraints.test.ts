import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { createMigratedDatabase, insertProject, insertStep, insertTicket } from "./helpers";

const databases: ReturnType<typeof createMigratedDatabase>[] = [];

afterEach(() => {
  databases.splice(0).forEach((database) => database.dispose());
});

function migratedDatabase() {
  const database = createMigratedDatabase();
  databases.push(database);
  database.sqlite
    .prepare(
      "INSERT INTO project_types (id, name, description, default_checks, default_step_titles) VALUES ('other', 'Other', '', '[]', '[]')",
    )
    .run();
  return database.sqlite;
}

describe("SQLite connection pragmas", () => {
  it("applies the required pragmas when the application client opens a database", () => {
    const database = createMigratedDatabase();
    databases.push(database);
    const output = execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "-e",
        `import { sqlite } from "./src/db/client";
         console.log(JSON.stringify({
           journalMode: sqlite.pragma("journal_mode", { simple: true }),
           foreignKeys: sqlite.pragma("foreign_keys", { simple: true }),
           busyTimeout: sqlite.pragma("busy_timeout", { simple: true }),
           synchronous: sqlite.pragma("synchronous", { simple: true })
         }));
         sqlite.close();`,
      ],
      { cwd: process.cwd(), env: { ...process.env, PLAN_DB_PATH: database.path } },
    )
      .toString()
      .trim();

    expect(JSON.parse(output)).toEqual({
      journalMode: "wal",
      foreignKeys: 1,
      busyTimeout: 5000,
      synchronous: 1,
    });
  });
});

describe("initial schema constraints", () => {
  it("enforces project, ticket, step, and check uniqueness", () => {
    const sqlite = migratedDatabase();
    insertProject(sqlite, "project-1", "APP");
    expect(() => insertProject(sqlite, "project-2", "APP")).toThrow(/UNIQUE constraint failed/);

    insertTicket(sqlite, "ticket-1", "project-1", 1, "APP-1");
    expect(() => insertTicket(sqlite, "ticket-2", "project-1", 1, "APP-2")).toThrow(
      /ticket number must be the next project number/,
    );

    insertStep(sqlite, "step-1", "ticket-1", "project-1", 1, "APP-1.1");
    expect(() => insertStep(sqlite, "step-2", "ticket-1", "project-1", 1, "APP-1.2")).toThrow(
      /step number must be the next ticket number/,
    );

    sqlite
      .prepare(
        "INSERT INTO checks (id, project_id, name, command, timeout_seconds, is_default, position) VALUES ('check-1', 'project-1', 'test', 'pnpm test', 30, 1, 1)",
      )
      .run();
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO checks (id, project_id, name, command, timeout_seconds, is_default, position) VALUES ('check-2', 'project-1', 'test', 'pnpm test', 30, 1, 2)",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("rejects readable-key updates, reused numbers, and invalid JSON", () => {
    const sqlite = migratedDatabase();
    insertProject(sqlite, "project-1", "APP");
    insertTicket(sqlite, "ticket-1", "project-1", 1, "APP-1");
    insertStep(sqlite, "step-1", "ticket-1", "project-1", 1, "APP-1.1");

    expect(() => sqlite.prepare("UPDATE projects SET key = 'NEW' WHERE id = 'project-1'").run()).toThrow(
      /project key is immutable/,
    );
    expect(() => sqlite.prepare("UPDATE tickets SET key = 'APP-9' WHERE id = 'ticket-1'").run()).toThrow(
      /ticket key is immutable/,
    );
    expect(() => sqlite.prepare("UPDATE steps SET key = 'APP-1.9' WHERE id = 'step-1'").run()).toThrow(
      /step key is immutable/,
    );
    expect(() => insertTicket(sqlite, "ticket-2", "project-1", 1, "APP-2")).toThrow(
      /ticket number must be the next project number/,
    );
    expect(() => insertStep(sqlite, "step-2", "ticket-1", "project-1", 1, "APP-1.2")).toThrow(
      /step number must be the next ticket number/,
    );
    expect(() =>
      sqlite
        .prepare("INSERT INTO app_settings (key, value) VALUES ('invalid-json', 'not json')")
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects cross-project ticket and step dependencies through composite foreign keys", () => {
    const sqlite = migratedDatabase();
    insertProject(sqlite, "project-1", "APP");
    insertProject(sqlite, "project-2", "WEB");
    insertTicket(sqlite, "ticket-1", "project-1", 1, "APP-1");
    insertTicket(sqlite, "ticket-2", "project-2", 1, "WEB-1");
    insertStep(sqlite, "step-1", "ticket-1", "project-1", 1, "APP-1.1");
    insertStep(sqlite, "step-2", "ticket-2", "project-2", 1, "WEB-1.1");

    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO ticket_dependencies (project_id, blocker_ticket_id, blocked_ticket_id) VALUES ('project-1', 'ticket-1', 'ticket-2')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO step_dependencies (project_id, blocker_step_id, blocked_step_id) VALUES ('project-1', 'step-1', 'step-2')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});
