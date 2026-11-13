import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

const drizzleDirectory = resolve(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(resolve(drizzleDirectory, "meta/_journal.json"), "utf8")) as {
  entries: Array<{ tag: string }>;
};
export function createMigratedDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "plan-agentique-db-"));
  const path = join(directory, "plan.db");
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");

  for (const { tag } of journal.entries) {
    const migration = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        sqlite.exec(statement);
      }
    }
  }

  return {
    directory,
    path,
    sqlite,
    dispose() {
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function insertProject(sqlite: Database.Database, id: string, key: string) {
  sqlite
    .prepare(
      "INSERT INTO projects (id, key, name, type_id, repo_path) VALUES (?, ?, ?, 'other', ?)",
    )
    .run(id, key, key, `/tmp/${key.toLowerCase()}`);
}

export function insertTicket(
  sqlite: Database.Database,
  id: string,
  projectId: string,
  number: number,
  key: string,
) {
  sqlite
    .prepare(
      `INSERT INTO tickets
        (id, project_id, number, key, title, description, status, origin, position)
       VALUES (?, ?, ?, ?, 'Ticket', '', 'open', 'human', 1)`,
    )
    .run(id, projectId, number, key);
}

export function insertStep(
  sqlite: Database.Database,
  id: string,
  ticketId: string,
  projectId: string,
  number: number,
  key: string,
) {
  sqlite
    .prepare(
      `INSERT INTO steps
        (id, ticket_id, project_id, number, key, title, description, acceptance_criteria,
         status, origin, requires_review, position)
       VALUES (?, ?, ?, ?, ?, 'Step', '', '', 'todo', 'human', 0, 1)`,
    )
    .run(id, ticketId, projectId, number, key);
}
