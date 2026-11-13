CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `check_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`check_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`attempt` integer NOT NULL,
	`exit_code` integer NOT NULL,
	`timed_out` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`output_tail` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "check_runs_timed_out_boolean_ck" CHECK("check_runs"."timed_out" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `check_runs_step_commit_idx` ON `check_runs` (`step_id`,`commit_sha`);--> statement-breakpoint
CREATE INDEX `check_runs_check_id_idx` ON `check_runs` (`check_id`);--> statement-breakpoint
CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`cwd` text DEFAULT '.' NOT NULL,
	`timeout_seconds` integer NOT NULL,
	`expected_exit_code` integer DEFAULT 0 NOT NULL,
	`is_default` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "checks_name_format_ck" CHECK("checks"."name" glob '[a-z]*' and "checks"."name" not glob '*[^a-z0-9_-]*'),
	CONSTRAINT "checks_is_default_boolean_ck" CHECK("checks"."is_default" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `checks_project_position_idx` ON `checks` (`project_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `checks_project_name_uq` ON `checks` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`type` text NOT NULL,
	`actor` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_project_id_id_idx` ON `events` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	CONSTRAINT "notes_target_type_ck" CHECK("notes"."target_type" in ('ticket', 'step')),
	CONSTRAINT "notes_kind_ck" CHECK("notes"."kind" in ('note', 'question', 'answer', 'rejection', 'system'))
);
--> statement-breakpoint
CREATE INDEX `notes_target_created_at_idx` ON `notes` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`default_checks` text NOT NULL,
	`default_step_titles` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
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
	CONSTRAINT "projects_key_format_ck" CHECK(length("projects"."key") between 2 and 6
        and "projects"."key" glob '[A-Z]*'
        and "projects"."key" not glob '*[^A-Z0-9]*'),
	CONSTRAINT "projects_auto_export_boolean_ck" CHECK("projects"."auto_export" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_key_uq` ON `projects` (`key`);--> statement-breakpoint
CREATE INDEX `projects_type_id_idx` ON `projects` (`type_id`);--> statement-breakpoint
CREATE TABLE `step_checks` (
	`step_id` text NOT NULL,
	`check_id` text NOT NULL,
	PRIMARY KEY(`step_id`, `check_id`),
	FOREIGN KEY (`step_id`) REFERENCES `steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `step_checks_check_id_idx` ON `step_checks` (`check_id`);--> statement-breakpoint
CREATE TABLE `step_dependencies` (
	`project_id` text NOT NULL,
	`blocker_step_id` text NOT NULL,
	`blocked_step_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`blocker_step_id`, `blocked_step_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocker_step_id`,`project_id`) REFERENCES `steps`(`id`,`project_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_step_id`,`project_id`) REFERENCES `steps`(`id`,`project_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "step_dependencies_not_self_ck" CHECK("step_dependencies"."blocker_step_id" <> "step_dependencies"."blocked_step_id")
);
--> statement-breakpoint
CREATE INDEX `step_dependencies_project_blocked_idx` ON `step_dependencies` (`project_id`,`blocked_step_id`);--> statement-breakpoint
CREATE INDEX `step_dependencies_project_blocker_idx` ON `step_dependencies` (`project_id`,`blocker_step_id`);--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`acceptance_criteria` text NOT NULL,
	`status` text NOT NULL,
	`origin` text NOT NULL,
	`requires_review` integer NOT NULL,
	`position` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_by` text,
	`lease_expires_at` integer,
	`commit_sha` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ticket_id`,`project_id`) REFERENCES `tickets`(`id`,`project_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "steps_status_ck" CHECK("steps"."status" in ('proposed', 'todo', 'in_progress', 'needs_input', 'review', 'done', 'failed', 'cancelled')),
	CONSTRAINT "steps_origin_ck" CHECK("steps"."origin" in ('human', 'agent')),
	CONSTRAINT "steps_requires_review_boolean_ck" CHECK("steps"."requires_review" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `steps_key_uq` ON `steps` (`key`);--> statement-breakpoint
CREATE INDEX `steps_ticket_position_idx` ON `steps` (`ticket_id`,`position`);--> statement-breakpoint
CREATE INDEX `steps_project_status_idx` ON `steps` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `steps_claimed_by_idx` ON `steps` (`claimed_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `steps_ticket_number_uq` ON `steps` (`ticket_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `steps_id_project_uq` ON `steps` (`id`,`project_id`);--> statement-breakpoint
CREATE TABLE `ticket_dependencies` (
	`project_id` text NOT NULL,
	`blocker_ticket_id` text NOT NULL,
	`blocked_ticket_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`blocker_ticket_id`, `blocked_ticket_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocker_ticket_id`,`project_id`) REFERENCES `tickets`(`id`,`project_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_ticket_id`,`project_id`) REFERENCES `tickets`(`id`,`project_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ticket_dependencies_not_self_ck" CHECK("ticket_dependencies"."blocker_ticket_id" <> "ticket_dependencies"."blocked_ticket_id")
);
--> statement-breakpoint
CREATE INDEX `ticket_dependencies_project_blocked_idx` ON `ticket_dependencies` (`project_id`,`blocked_ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_dependencies_project_blocker_idx` ON `ticket_dependencies` (`project_id`,`blocker_ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`origin` text NOT NULL,
	`branch` text,
	`worktree_path` text,
	`position` integer NOT NULL,
	`next_step_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`validated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tickets_status_ck" CHECK("tickets"."status" in ('proposed', 'open', 'done', 'cancelled')),
	CONSTRAINT "tickets_origin_ck" CHECK("tickets"."origin" in ('human', 'agent'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_key_uq` ON `tickets` (`key`);--> statement-breakpoint
CREATE INDEX `tickets_project_position_idx` ON `tickets` (`project_id`,`position`);--> statement-breakpoint
CREATE INDEX `tickets_project_status_idx` ON `tickets` (`project_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_project_number_uq` ON `tickets` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_id_project_uq` ON `tickets` (`id`,`project_id`);