import "server-only";

import { db, sqlite } from "@/db/client";

/**
 * Runs a short, synchronous write unit of work while holding SQLite's immediate
 * write lock. Do not execute external work from the callback.
 */
export function withImmediateTransaction<T>(callback: (database: typeof db) => T): T {
  sqlite.exec("BEGIN IMMEDIATE");

  try {
    const result = callback(db);

    if (result instanceof Promise) {
      throw new TypeError("withImmediateTransaction callbacks must be synchronous");
    }

    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    if (sqlite.inTransaction) {
      sqlite.exec("ROLLBACK");
    }
    throw error;
  }
}
