PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	CONSTRAINT "app_settings_value_json_ck" CHECK(json_valid("__new_app_settings"."value"))
);
--> statement-breakpoint
INSERT INTO `__new_app_settings`("key", "value", "updated_at") SELECT "key", "value", "updated_at" FROM `app_settings`;--> statement-breakpoint
DROP TABLE `app_settings`;--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`type` text NOT NULL,
	`actor` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "events_payload_json_ck" CHECK(json_valid("__new_events"."payload"))
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "project_id", "entity_type", "entity_id", "type", "actor", "payload", "created_at") SELECT "id", "project_id", "entity_type", "entity_id", "type", "actor", "payload", "created_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
CREATE INDEX `events_project_id_id_idx` ON `events` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_project_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`default_checks` text NOT NULL,
	`default_step_titles` text NOT NULL,
	CONSTRAINT "project_types_default_checks_json_ck" CHECK(json_valid("__new_project_types"."default_checks")),
	CONSTRAINT "project_types_default_step_titles_json_ck" CHECK(json_valid("__new_project_types"."default_step_titles"))
);
--> statement-breakpoint
INSERT INTO `__new_project_types`("id", "name", "description", "default_checks", "default_step_titles") SELECT "id", "name", "description", "default_checks", "default_step_titles" FROM `project_types`;--> statement-breakpoint
DROP TABLE `project_types`;--> statement-breakpoint
ALTER TABLE `__new_project_types` RENAME TO `project_types`;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`type_id` text NOT NULL,
	`repo_path` text NOT NULL,
	`main_branch` text,
	`worktree_roots` text,
	`branch_convention` text,
	`commit_convention` text,
	`lease_minutes` integer,
	`max_attempts` integer,
	`auto_export` integer,
	`export_dir` text,
	`next_ticket_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`type_id`) REFERENCES `project_types`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "projects_key_format_ck" CHECK(length("__new_projects"."key") between 2 and 6
        and "__new_projects"."key" glob '[A-Z]*'
        and "__new_projects"."key" not glob '*[^A-Z0-9]*'),
	CONSTRAINT "projects_auto_export_boolean_ck" CHECK("__new_projects"."auto_export" in (0, 1)),
	CONSTRAINT "projects_worktree_roots_json_ck" CHECK("__new_projects"."worktree_roots" is null or json_valid("__new_projects"."worktree_roots"))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "key", "name", "type_id", "repo_path", "main_branch", "worktree_roots", "branch_convention", "commit_convention", "lease_minutes", "max_attempts", "auto_export", "export_dir", "next_ticket_number", "created_at", "updated_at", "archived_at") SELECT "id", "key", "name", "type_id", "repo_path", "main_branch", "worktree_roots", "branch_convention", "commit_convention", "lease_minutes", "max_attempts", "auto_export", "export_dir", "next_ticket_number", "created_at", "updated_at", "archived_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_key_uq` ON `projects` (`key`);--> statement-breakpoint
CREATE INDEX `projects_type_id_idx` ON `projects` (`type_id`);--> statement-breakpoint
CREATE TRIGGER `projects_key_immutable`
BEFORE UPDATE OF `key` ON `projects`
BEGIN
  SELECT RAISE(ABORT, 'project key is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `tickets_key_immutable`
BEFORE UPDATE OF `key` ON `tickets`
BEGIN
  SELECT RAISE(ABORT, 'ticket key is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `steps_key_immutable`
BEFORE UPDATE OF `key` ON `steps`
BEGIN
  SELECT RAISE(ABORT, 'step key is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `tickets_number_sequence`
BEFORE INSERT ON `tickets`
WHEN NEW.`number` <> (SELECT `next_ticket_number` FROM `projects` WHERE `id` = NEW.`project_id`)
BEGIN
  SELECT RAISE(ABORT, 'ticket number must be the next project number');
END;--> statement-breakpoint
CREATE TRIGGER `tickets_advance_number`
AFTER INSERT ON `tickets`
BEGIN
  UPDATE `projects`
  SET `next_ticket_number` = NEW.`number` + 1
  WHERE `id` = NEW.`project_id`;
END;--> statement-breakpoint
CREATE TRIGGER `steps_number_sequence`
BEFORE INSERT ON `steps`
WHEN NEW.`number` <> (SELECT `next_step_number` FROM `tickets` WHERE `id` = NEW.`ticket_id`)
BEGIN
  SELECT RAISE(ABORT, 'step number must be the next ticket number');
END;--> statement-breakpoint
CREATE TRIGGER `steps_advance_number`
AFTER INSERT ON `steps`
BEGIN
  UPDATE `tickets`
  SET `next_step_number` = NEW.`number` + 1
  WHERE `id` = NEW.`ticket_id`;
END;--> statement-breakpoint
CREATE TRIGGER `tickets_number_immutable`
BEFORE UPDATE OF `number`, `project_id` ON `tickets`
BEGIN
  SELECT RAISE(ABORT, 'ticket number and project are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `steps_number_immutable`
BEFORE UPDATE OF `number`, `ticket_id`, `project_id` ON `steps`
BEGIN
  SELECT RAISE(ABORT, 'step number, ticket, and project are immutable');
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;