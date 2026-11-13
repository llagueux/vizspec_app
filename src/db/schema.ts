import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestampMs = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch('subsec') * 1000)`);

export const projectTypes = sqliteTable("project_types", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  defaultChecks: text("default_checks").notNull(),
  defaultStepTitles: text("default_step_titles").notNull(),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text().primaryKey(),
    key: text().notNull(),
    name: text().notNull(),
    typeId: text("type_id").notNull().references(() => projectTypes.id, { onDelete: "restrict" }),
    repoPath: text("repo_path").notNull(),
    mainBranch: text("main_branch"),
    worktreeRoots: text("worktree_roots"),
    branchConvention: text("branch_convention"),
    commitConvention: text("commit_convention"),
    leaseMinutes: integer("lease_minutes"),
    maxAttempts: integer("max_attempts"),
    autoExport: integer("auto_export", { mode: "boolean" }),
    exportDir: text("export_dir"),
    nextTicketNumber: integer("next_ticket_number").notNull().default(1),
    createdAt: timestampMs("created_at"),
    updatedAt: timestampMs("updated_at"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("projects_key_uq").on(table.key),
    index("projects_type_id_idx").on(table.typeId),
    check(
      "projects_key_format_ck",
      sql`length(${table.key}) between 2 and 6
        and ${table.key} glob '[A-Z]*'
        and ${table.key} not glob '*[^A-Z0-9]*'`,
    ),
    check("projects_auto_export_boolean_ck", sql`${table.autoExport} in (0, 1)`),
  ],
);

export const checks = sqliteTable(
  "checks",
  {
    id: text().primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    command: text().notNull(),
    cwd: text().notNull().default("."),
    timeoutSeconds: integer("timeout_seconds").notNull(),
    expectedExitCode: integer("expected_exit_code").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" }).notNull(),
    position: integer().notNull(),
  },
  (table) => [
    unique("checks_project_name_uq").on(table.projectId, table.name),
    index("checks_project_position_idx").on(table.projectId, table.position),
    check(
      "checks_name_format_ck",
      sql`${table.name} glob '[a-z]*' and ${table.name} not glob '*[^a-z0-9_-]*'`,
    ),
    check("checks_is_default_boolean_ck", sql`${table.isDefault} in (0, 1)`),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text().primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    number: integer().notNull(),
    key: text().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    status: text().notNull(),
    origin: text().notNull(),
    branch: text(),
    worktreePath: text("worktree_path"),
    position: integer().notNull(),
    nextStepNumber: integer("next_step_number").notNull().default(1),
    createdAt: timestampMs("created_at"),
    updatedAt: timestampMs("updated_at"),
    validatedAt: integer("validated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("tickets_key_uq").on(table.key),
    unique("tickets_project_number_uq").on(table.projectId, table.number),
    unique("tickets_id_project_uq").on(table.id, table.projectId),
    index("tickets_project_position_idx").on(table.projectId, table.position),
    index("tickets_project_status_idx").on(table.projectId, table.status),
    check("tickets_status_ck", sql`${table.status} in ('proposed', 'open', 'done', 'cancelled')`),
    check("tickets_origin_ck", sql`${table.origin} in ('human', 'agent')`),
  ],
);

export const steps = sqliteTable(
  "steps",
  {
    id: text().primaryKey(),
    ticketId: text("ticket_id").notNull(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
    number: integer().notNull(),
    key: text().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    acceptanceCriteria: text("acceptance_criteria").notNull(),
    status: text().notNull(),
    origin: text().notNull(),
    requiresReview: integer("requires_review", { mode: "boolean" }).notNull(),
    position: integer().notNull(),
    attempts: integer().notNull().default(0),
    claimedBy: text("claimed_by"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    commitSha: text("commit_sha"),
    createdAt: timestampMs("created_at"),
    updatedAt: timestampMs("updated_at"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    foreignKey({
      columns: [table.ticketId, table.projectId],
      foreignColumns: [tickets.id, tickets.projectId],
      name: "steps_ticket_project_fk",
    }).onDelete("cascade"),
    uniqueIndex("steps_key_uq").on(table.key),
    unique("steps_ticket_number_uq").on(table.ticketId, table.number),
    unique("steps_id_project_uq").on(table.id, table.projectId),
    index("steps_ticket_position_idx").on(table.ticketId, table.position),
    index("steps_project_status_idx").on(table.projectId, table.status),
    index("steps_claimed_by_idx").on(table.claimedBy),
    check(
      "steps_status_ck",
      sql`${table.status} in ('proposed', 'todo', 'in_progress', 'needs_input', 'review', 'done', 'failed', 'cancelled')`,
    ),
    check("steps_origin_ck", sql`${table.origin} in ('human', 'agent')`),
    check("steps_requires_review_boolean_ck", sql`${table.requiresReview} in (0, 1)`),
  ],
);

export const stepChecks = sqliteTable(
  "step_checks",
  {
    stepId: text("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
    checkId: text("check_id").notNull().references(() => checks.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.stepId, table.checkId] }),
    index("step_checks_check_id_idx").on(table.checkId),
  ],
);

export const ticketDependencies = sqliteTable(
  "ticket_dependencies",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    blockerTicketId: text("blocker_ticket_id").notNull(),
    blockedTicketId: text("blocked_ticket_id").notNull(),
    createdAt: timestampMs("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.blockerTicketId, table.blockedTicketId] }),
    foreignKey({
      columns: [table.blockerTicketId, table.projectId],
      foreignColumns: [tickets.id, tickets.projectId],
      name: "ticket_dependencies_blocker_project_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.blockedTicketId, table.projectId],
      foreignColumns: [tickets.id, tickets.projectId],
      name: "ticket_dependencies_blocked_project_fk",
    }).onDelete("cascade"),
    index("ticket_dependencies_project_blocked_idx").on(table.projectId, table.blockedTicketId),
    index("ticket_dependencies_project_blocker_idx").on(table.projectId, table.blockerTicketId),
    check("ticket_dependencies_not_self_ck", sql`${table.blockerTicketId} <> ${table.blockedTicketId}`),
  ],
);

export const stepDependencies = sqliteTable(
  "step_dependencies",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    blockerStepId: text("blocker_step_id").notNull(),
    blockedStepId: text("blocked_step_id").notNull(),
    createdAt: timestampMs("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.blockerStepId, table.blockedStepId] }),
    foreignKey({
      columns: [table.blockerStepId, table.projectId],
      foreignColumns: [steps.id, steps.projectId],
      name: "step_dependencies_blocker_project_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.blockedStepId, table.projectId],
      foreignColumns: [steps.id, steps.projectId],
      name: "step_dependencies_blocked_project_fk",
    }).onDelete("cascade"),
    index("step_dependencies_project_blocked_idx").on(table.projectId, table.blockedStepId),
    index("step_dependencies_project_blocker_idx").on(table.projectId, table.blockerStepId),
    check("step_dependencies_not_self_ck", sql`${table.blockerStepId} <> ${table.blockedStepId}`),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    kind: text().notNull(),
    author: text().notNull(),
    body: text().notNull(),
    createdAt: timestampMs("created_at"),
  },
  (table) => [
    index("notes_target_created_at_idx").on(table.targetType, table.targetId, table.createdAt),
    check("notes_target_type_ck", sql`${table.targetType} in ('ticket', 'step')`),
    check("notes_kind_ck", sql`${table.kind} in ('note', 'question', 'answer', 'rejection', 'system')`),
  ],
);

export const checkRuns = sqliteTable(
  "check_runs",
  {
    id: text().primaryKey(),
    stepId: text("step_id").notNull().references(() => steps.id, { onDelete: "cascade" }),
    checkId: text("check_id").notNull().references(() => checks.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    attempt: integer().notNull(),
    exitCode: integer("exit_code").notNull(),
    timedOut: integer("timed_out", { mode: "boolean" }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    outputTail: text("output_tail").notNull(),
    startedAt: timestampMs("started_at"),
  },
  (table) => [
    index("check_runs_step_commit_idx").on(table.stepId, table.commitSha),
    index("check_runs_check_id_idx").on(table.checkId),
    check("check_runs_timed_out_boolean_ck", sql`${table.timedOut} in (0, 1)`),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    type: text().notNull(),
    actor: text().notNull(),
    payload: text().notNull(),
    createdAt: timestampMs("created_at"),
  },
  (table) => [index("events_project_id_id_idx").on(table.projectId, table.id)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestampMs("updated_at"),
});
