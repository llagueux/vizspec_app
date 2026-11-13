import Database from "better-sqlite3";
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
  it("enables WAL, foreign keys, normal synchronous mode, and a five-second timeout", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("synchronous = NORMAL");

    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(sqlite.pragma("synchronous", { simple: true })).toBe(1);
    sqlite.close();
  });
});

describe("initial schema constraints", () => {
  it("enforces project, ticket, step, and check uniqueness", () => {
    const sqlite = migratedDatabase();
    insertProject(sqlite, "project-1", "APP");
    expect(() => insertProject(sqlite, "project-2", "APP")).toThrow(/UNIQUE constraint failed/);

    insertTicket(sqlite, "ticket-1", "project-1", 1, "APP-1");
    expect(() => insertTicket(sqlite, "ticket-2", "project-1", 1, "APP-2")).toThrow(
      /UNIQUE constraint failed/,
    );

    insertStep(sqlite, "step-1", "ticket-1", "project-1", 1, "APP-1.1");
    expect(() => insertStep(sqlite, "step-2", "ticket-1", "project-1", 1, "APP-1.2")).toThrow(
      /UNIQUE constraint failed/,
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
