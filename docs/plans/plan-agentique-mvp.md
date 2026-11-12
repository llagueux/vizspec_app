# Plan agentique MVP roadmap

Status: Ready

## Goal

Deliver a local, single-user application for planning and supervising AI development agents. It manages projects, features, steps, dependencies, validated checks, human review, MCP workflows, and deterministic `PLAN.md` exports while keeping git write operations outside the application.

## Context

The repository currently contains product documentation and agent conventions, but no application source code. The normative requirements are in:

- `README.md` - product overview and MVP scope
- `docs/specs/SPECS.md` - normative implementation specification and delivery milestones
- `docs/specs/ARCHITECTURE.md` - module boundaries, data model, concurrency, security, and scenarios
- `docs/specs/DESIGN_SYSTEM_geist.md` - mandatory Next.js UI foundation and visual rules
- `.github/copilot-instructions.md` - repository conventions and delivery workflow

## Decisions and assumptions

- Decision: `docs/specs/SPECS.md` is the authoritative behavior specification when it differs from `README.md`.
- Decision: Deliver the existing M0--M7 milestones as eight ordered, independently mergeable features.
- Decision: Use the specified shared core and adapter boundaries: `src/core`, `src/db`, `src/runner`, `src/export`, `src/mcp`, and `src/app`.
- Decision: Implement all default values only in the settings registry; services resolve effective settings at use time.
- Decision: Use SQLite with Drizzle and `better-sqlite3`, WAL, foreign keys, `busy_timeout`, and short `BEGIN IMMEDIATE` transactions.
- Decision: Use the documented `earthy-editorial-geist` foundation unchanged for the UI, with server components by default and server actions validated by Zod.
- Assumption: The application is bootstrapped from an otherwise empty source tree and may add the dependencies mandated by `SPECS.md` and the design-system foundation.
- Assumption: The developer reviews generated Drizzle migrations and applies them locally; agents only generate migration files.
- Rejected: Building UI pages before the core services. It would duplicate business rules and make MCP behavior harder to verify.
- Rejected: Persisting ready state or ticket phase. Both are explicitly derived and must remain calculation-only.
- Rejected: Running checks inside a database transaction. This would block concurrent SQLite writers and violates the architecture.
- Rejected: Adding a CLI or import workflow in the MVP. Both are explicitly post-MVP scope.

## Out of scope

- Multi-user support, authentication, remote hosting, and network access beyond `127.0.0.1`
- Git write operations performed by the application
- Cross-project dependencies, additional hierarchy levels, estimates, sprints, and attachments
- Importing `SPECS.md` or `PLAN.md`
- Dependency graph and critical-path UI
- A thin CLI beyond the required `export-plan` script

## Feature sequence

- F1 - Bootstrap and persistence foundation - depends on: none
- F2 - Domain core and planning workflow - depends on: F1
- F3 - Safe check runner - depends on: F2
- F4 - MCP agent interface - depends on: F3
- F5 - Project management interface - depends on: F4
- F6 - Feature review workflow - depends on: F5
- F7 - Deterministic plan export - depends on: F6
- F8 - Operational hardening and documentation - depends on: F7

## Features

### F1 - Bootstrap and persistence foundation

Status: Ready
Type: feat
Branch: feat/app-foundation
Base: main
Depends on: none

#### Goal

Initialize the Next.js application and the local persistence layer. The result provides the mandatory design-system foundation, strict tooling, a complete initial Drizzle schema, migrations, seeds, and safe SQLite connection primitives.

#### Data model

Add the complete initial schema: `project_types`, `projects`, `checks`, `tickets`, `steps`, `step_checks`, `ticket_dependencies`, `step_dependencies`, `notes`, `check_runs`, `events`, and `app_settings`.

Enforce enum `CHECK` constraints; immutable readable-key uniqueness; non-reusable ticket and step numbering; check-name uniqueness per project; composite foreign keys that constrain dependencies to one project; self-dependency checks; cascading deletion only for children whose lifetime belongs to their parent. Add indexes for foreign keys, key lookup, ordered tickets and steps, ready-state queries, dependencies, events, and check runs.

#### Impacted files

- `package.json` - project scripts and pinned runtime/development dependencies
- `pnpm-lock.yaml` - locked dependency graph
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts` - strict application and test tooling
- `components.json` - shadcn configuration
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` - App Router and mandatory design-system foundation
- `src/lib/fonts.ts`, `src/lib/utils.ts`, `src/components/theme-provider.tsx` - shared UI setup
- `src/components/ui/*` - generated shadcn primitives required by the foundation
- `src/db/schema.ts`, `src/db/client.ts`, `src/db/transactions.ts`, `src/db/seed.ts` - schema, SQLite setup, transaction helper, project-type seeds
- `drizzle.config.ts`, `drizzle/*` - Drizzle configuration and generated initial migration
- `tests/db/*` - database setup, migration, and constraint tests

#### Steps

- [ ] F1-S1 - owner: dev - Initialize the App Router project, strict TypeScript, Tailwind v4, ESLint, Vitest, path aliases, and `typecheck`, `lint`, `test`, `build`, and `db:seed` scripts; add only the pinned packages mandated by the specifications and UI foundation. - files: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `next.config.ts` - verify: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` - commit: `chore(setup): initialize application tooling`
- [ ] F1-S2 - owner: dev - Install and configure the required shadcn primitives, Geist fonts, theme provider, toaster, semantic tokens, and the minimal application shell exactly as required by the design system. - files: `components.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/fonts.ts`, `src/lib/utils.ts`, `src/components/theme-provider.tsx`, `src/components/ui/*` - verify: `pnpm build` - commit: `feat(ui): add design system foundation`
- [ ] F1-S3 - owner: db - Define the complete Drizzle schema and SQLite client initialization with WAL, foreign keys, normal synchronous mode, and a 5-second busy timeout; expose an explicit `BEGIN IMMEDIATE` unit-of-work helper and seed the five specified project types. - files: `src/db/schema.ts`, `src/db/client.ts`, `src/db/transactions.ts`, `src/db/seed.ts`, `drizzle.config.ts` - verify: `pnpm typecheck && pnpm test -- tests/db` - commit: `feat(db): add plan domain schema`
- [ ] F1-S4 - owner: db - Generate the initial Drizzle migration and add integration tests proving a blank database migrates, seeds project types, enables foreign keys, and rejects cross-project composite dependency references. - files: `drizzle/0000_initial_plan_schema.sql`, `drizzle/meta/*`, `tests/db/migrations.test.ts`, `tests/db/constraints.test.ts` - verify: `pnpm drizzle-kit generate && pnpm test -- tests/db` - commit: `test(db): verify initial schema constraints`

#### Test plan

- Run migrations against an empty temporary database and seed exactly `web-app`, `micro-saas`, `data-pipeline`, `library`, and `other`.
- Verify unique project keys, ticket numbers within a project, step numbers within a ticket, and check names within a project.
- Verify composite foreign keys reject a dependency whose endpoints belong to different projects.
- Verify the build renders the root route with the configured theme and font setup.

#### Configuration and rollout

New environment variables: `PLAN_DB_PATH`.

Generate and review `drizzle/0000_initial_plan_schema.sql` with `pnpm drizzle-kit generate`; the user applies it to the local database before using the application. No migration contains environment values.

#### Risks and watch points

- Schema corrections after this feature require additive migrations; the complete MVP data model must be reviewed carefully before applying the first migration.
- `better-sqlite3` is a native dependency; confirm the selected Node.js LTS version builds it in the target environment.
- The application must never open the database from client components.

#### Acceptance criteria

- [ ] The project has passing typecheck, lint, test, and production build scripts.
- [ ] The UI foundation follows `DESIGN_SYSTEM_geist.md`, including system theme support and semantic tokens.
- [ ] A new database receives the full schema and project-type seeds.
- [ ] SQLite connections apply all specified pragmas and support short immediate transactions.
- [ ] Database constraints reject cross-project dependency references.

#### Open questions


### F2 - Domain core and planning workflow

Status: Planned
Type: feat
Branch: feat/domain-core
Base: main
Depends on: F1

#### Goal

Implement the framework-independent business core for projects, checks, tickets, steps, dependencies, settings, events, notes, proposals, and human workflow transitions. Every mutation is transactional, validated, and auditable.

#### Data model

No schema change. Use all F1 tables. The settings registry maps the documented project-overridable settings to nullable project columns and stores global values in `app_settings`.

#### Impacted files

- `src/core/types.ts`, `src/core/errors.ts`, `src/core/clock.ts` - shared contracts, domain errors, and injectable time
- `src/core/settings.ts`, `src/core/settings-service.ts` - settings registry, validation, inheritance, and audit events
- `src/core/project-service.ts`, `src/core/ticket-service.ts` - project, check, ticket, and step lifecycle
- `src/core/dependency-service.ts`, `src/core/ready-calculator.ts` - graph validation, cycle paths, readiness, and ticket phases
- `src/core/step-service.ts`, `src/core/review-service.ts`, `src/core/plan-proposal-service.ts` - state transitions, review cascade, and atomic proposals
- `src/core/core-api.ts` - facade consumed by future adapters
- `tests/core/*` - unit and SQLite integration coverage

#### Steps

- [ ] F2-S1 - owner: dev - Add core types, typed domain errors, ULID/key allocation, an injectable clock, event and note writers, and `CoreApi` dependency contracts without importing Next.js or MCP modules. - files: `src/core/types.ts`, `src/core/errors.ts`, `src/core/clock.ts`, `src/core/core-api.ts`, `tests/core/factories.ts` - verify: `pnpm test -- tests/core && pnpm typecheck` - commit: `feat(core): add shared domain contracts`
- [ ] F2-S2 - owner: dev - Implement the settings registry and service with all section-15 keys, Zod schemas, bounds, placeholder validation, inheritance order, sensitive-setting metadata, no caching, and `settings.changed` events. - files: `src/core/settings.ts`, `src/core/settings-service.ts`, `tests/core/settings-service.test.ts` - verify: `pnpm test -- tests/core/settings-service.test.ts` - commit: `feat(core): add settings resolution`
- [ ] F2-S3 - owner: dev - Implement project/check/ticket/step creation and editing, immutable readable-key allocation, default-check copying, events, notes, derived ticket phase, and ready calculation. - files: `src/core/project-service.ts`, `src/core/ticket-service.ts`, `src/core/ready-calculator.ts`, `tests/core/ticket-service.test.ts`, `tests/core/ready-calculator.test.ts` - verify: `pnpm test -- tests/core/ticket-service.test.ts tests/core/ready-calculator.test.ts` - commit: `feat(core): add project ticket and step services`
- [ ] F2-S4 - owner: dev - Implement ticket and same-ticket step dependency creation/removal with transactional depth-first cycle detection that returns the cycle path and rejects invalid scope. - files: `src/core/dependency-service.ts`, `tests/core/dependency-service.test.ts` - verify: `pnpm test -- tests/core/dependency-service.test.ts` - commit: `feat(core): add dependency validation`
- [ ] F2-S5 - owner: dev - Implement every specified human and agent-independent state transition, proposal acceptance/rejection, targeted reopening cascade, forced completion justification, and feature validation guards. - files: `src/core/step-service.ts`, `src/core/review-service.ts`, `src/core/plan-proposal-service.ts`, `tests/core/step-service.test.ts`, `tests/core/review-service.test.ts`, `tests/core/plan-proposal-service.test.ts` - verify: `pnpm test -- tests/core` - commit: `feat(core): add workflow state services`

#### Test plan

- Cover every allowed and forbidden step transition, including `review`, `needs_input`, forced completion, expiry behavior inputs, and attempt limits.
- Cover ticket phase precedence and ready calculation on chains, diamonds, ticket dependencies, proposed items, and cancelled items.
- Verify cycle rejection includes the path and leaves the database unchanged.
- Verify proposal creation is all-or-nothing and proposed items never become ready before acceptance.
- Verify settings precedence is project override, then global value, then built-in value; validate all numeric bounds and placeholders.
- Verify each mutation writes an event in the same transaction.

#### Configuration and rollout

No new environment variables or migrations. This feature consumes the F1 migration. All default values are defined in `src/core/settings.ts`, not repeated in services.

#### Risks and watch points

- This feature defines all application rules; later UI and MCP code must remain thin adapters.
- Preserve `BEGIN IMMEDIATE` only around short mutation work; do not introduce check execution here.
- Verify cascade reopening does not interrupt in-progress dependent steps.

#### Acceptance criteria

- [ ] The core has no dependency on `src/app` or `src/mcp`.
- [ ] All specified lifecycle, dependency, proposal, review, settings, note, and event rules are covered by passing tests.
- [ ] Ready state and ticket phase are derived, never persisted.
- [ ] Every mutation is atomic and recorded in `events`.

#### Open questions


### F3 - Safe check runner

Status: Planned
Type: feat
Branch: feat/check-runner
Base: main
Depends on: F2

#### Goal

Add the local check-execution adapter and integrate it with step completion. It verifies worktree ownership and commit SHA, runs only human-defined named checks safely and sequentially, records results, and preserves idempotence.

#### Data model

No schema change. Persist executions in `check_runs`; update existing step claim, lease, attempt, commit, and completion fields through the core.

#### Impacted files

- `src/runner/check-runner.ts`, `src/runner/git-reader.ts`, `src/runner/paths.ts` - process execution, read-only git access, and realpath confinement
- `src/core/ports.ts`, `src/core/step-service.ts` - runner ports and three-stage `completeStep` orchestration
- `tests/runner/*`, `tests/core/complete-step.test.ts` - temporary repository and completion integration tests

#### Steps

- [ ] F3-S1 - owner: dev - Define runner and git-reader ports, validate absolute worktree paths, allowed roots, git common directory, branch/SHA syntax, and HEAD equality using argument-array git invocations only. - files: `src/core/ports.ts`, `src/runner/paths.ts`, `src/runner/git-reader.ts`, `tests/runner/git-reader.test.ts` - verify: `pnpm test -- tests/runner/git-reader.test.ts` - commit: `feat(runner): validate worktree identity`
- [ ] F3-S2 - owner: dev - Implement sequential shell check execution with sanitized environment allowlist, relative check cwd validation, configurable timeouts, process-group termination, fail-fast handling, output-tail truncation, and per-worktree locking. - files: `src/runner/check-runner.ts`, `tests/runner/check-runner.test.ts` - verify: `pnpm test -- tests/runner/check-runner.test.ts` - commit: `feat(runner): execute named checks safely`
- [ ] F3-S3 - owner: dev - Integrate `completeStep` as short transaction validation, external execution, and short transaction conclusion; persist each run, make same step/SHA completion idempotent, update attempts and statuses, and retain the correct lease semantics. - files: `src/core/step-service.ts`, `tests/core/complete-step.test.ts` - verify: `pnpm test -- tests/core/complete-step.test.ts` - commit: `feat(core): complete steps with check results`

#### Test plan

- Use a temporary git repository to test valid worktree/SHA, SHA mismatch, non-worktree path, wrong repository, and path outside allowed roots.
- Test successful checks, expected nonzero exit codes, fail-fast behavior, timeout with termination, sanitized environment, output truncation, and per-worktree exclusion.
- Test no checks produces `needs_input`; successful checks produce `done` or `review`; failures increment attempts and eventually produce `failed`.
- Test repeated completion with the same step and SHA returns stored results without rerunning commands.

#### Configuration and rollout

No new environment variables or migrations. Use existing `PLAN_DB_PATH` and settings keys `checks.*` and `git.*`. Do not add executable commands through MCP.

#### Risks and watch points

- Check commands are intentionally shell-executed, so paths and environment boundaries must be exact.
- Never keep a write transaction open while a subprocess runs.
- Process-group termination requires platform-aware implementation and tests on the supported local environment.

#### Acceptance criteria

- [ ] Only checks stored by a human can execute.
- [ ] Invalid path or SHA rejects before executing a check.
- [ ] Runs are sequential, timeout-bounded, recorded, and output-truncated.
- [ ] `completeStep` is idempotent by `(step, commit_sha)`.
- [ ] Runner tests cover all M2 acceptance cases.

#### Open questions


### F4 - MCP agent interface

Status: Planned
Type: feat
Branch: feat/mcp-agent-interface
Base: main
Depends on: F3

#### Goal

Expose the core through a standard-stdio MCP server with separate planner and executor tool profiles. Agents can plan, claim, pause, complete, and annotate work without direct database or configuration access.

#### Data model

No schema change. MCP calls consume F1 storage through F2 services and create the events, notes, leases, and check runs already defined there.

#### Impacted files

- `src/mcp/server.ts`, `src/mcp/config.ts`, `src/mcp/schemas.ts` - stdio bootstrapping, environment validation, and Zod inputs
- `src/mcp/tools/*`, `src/mcp/responses.ts` - six tool adapters, profile registration, compact response formatting, and error mapping
- `src/core/step-service.ts`, `src/core/core-api.ts` - claim, pause, implicit lease renewal, and overview entry points where absent
- `tests/mcp/*` - SDK contract, profile, workflow, and concurrency tests

#### Steps

- [ ] F4-S1 - owner: dev - Add the MCP stdio server bootstrap, parse `--profile`, validate required executor agent identity and optional project default, and register only the allowed tool subset per profile. - files: `src/mcp/server.ts`, `src/mcp/config.ts`, `src/mcp/schemas.ts`, `tests/mcp/profiles.test.ts` - verify: `pnpm test -- tests/mcp/profiles.test.ts` - commit: `feat(mcp): add profile-based stdio server`
- [ ] F4-S2 - owner: dev - Implement compact `get_overview`, `propose_plan`, and `add_note` planner adapters with Zod validation, readable-key resolution, proposal limits, compact truncation, next actions, and stable error responses. - files: `src/mcp/tools/planner.ts`, `src/mcp/tools/add-note.ts`, `src/mcp/responses.ts`, `tests/mcp/planner-tools.test.ts` - verify: `pnpm test -- tests/mcp/planner-tools.test.ts` - commit: `feat(mcp): add planning tools`
- [ ] F4-S3 - owner: dev - Implement `claim_step`, `complete_step`, `pause_step`, and executor `add_note`, including complete claim context packets, ownership checks, lease renewal, lazy expiry, and runner response summaries. - files: `src/mcp/tools/executor.ts`, `src/core/step-service.ts`, `tests/mcp/executor-tools.test.ts` - verify: `pnpm test -- tests/mcp/executor-tools.test.ts` - commit: `feat(mcp): add execution tools`
- [ ] F4-S4 - owner: dev - Add MCP SDK integration tests for both profiles, a complete claim-to-completion workflow, error contracts, and simultaneous claims against one ready step. - files: `tests/mcp/server.contract.test.ts`, `tests/mcp/concurrency.test.ts` - verify: `pnpm test -- tests/mcp` - commit: `test(mcp): cover agent workflow contracts`

#### Test plan

- Verify executor lists only `claim_step`, `complete_step`, `pause_step`, and `add_note`; planner lists only `get_overview`, `propose_plan`, and `add_note`.
- Verify all tool inputs reject malformed values before core calls.
- Verify `claim_step` returns ticket, step, dependency, notes, checks, conventions, lease expiry, and a next action.
- Verify two concurrent agents never claim the same only-ready step and one agent cannot hold more than the configured maximum.
- Verify error responses have `ok: false`, a known error code, concise message, and hint.

#### Configuration and rollout

New environment variables: `PLAN_AGENT_NAME`, `PLAN_PROJECT`.

Add an MCP launch script that compiles or invokes the built server with `--profile executor|planner`. The user configures clients with the local executable path; no network listener is added.

#### Risks and watch points

- The six-tool surface and exact profile separation are security boundaries.
- Do not leak sensitive settings or raw command definitions in MCP responses.
- Use the core transaction path rather than direct database calls in all tools.

#### Acceptance criteria

- [ ] The server uses stdio and exposes exactly the specified profile-specific tools.
- [ ] All tools validate inputs with Zod and use compact documented response envelopes.
- [ ] Agents cannot create checks or change settings through MCP.
- [ ] Claim, completion, pause, planning, and note workflows pass MCP SDK contract tests.
- [ ] Concurrent claim tests prove exclusive ownership.

#### Open questions


### F5 - Project management interface

Status: Planned
Type: feat
Branch: feat/project-management-ui
Base: main
Depends on: F4

#### Goal

Provide the human-facing application for project setup, global and per-project settings, checks, manual planning, proposal review, project tracking, and ticket/step detail.

#### Data model

No schema change. All UI mutations use validated server actions and core services; client components never access the database.

#### Impacted files

- `src/app/layout.tsx`, `src/app/(app)/*` - application shell and pages
- `src/app/actions/*` - Zod-validated server actions
- `src/components/app/*` - reusable project, ticket, step, settings, and status presentation
- `src/components/ui/*` - additional generated shadcn primitives only when needed
- `tests/app/*` - server-action and component behavior tests

#### Steps

- [ ] F5-S1 - owner: dev - Add the authenticated-free local application shell, navigation, project list, project-creation form, and project overview query layer using Server Components and validated server actions. - files: `src/app/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/projects/new/page.tsx`, `src/app/actions/projects.ts`, `src/components/app/app-shell.tsx`, `src/components/app/project-form.tsx`, `tests/app/projects.test.ts` - verify: `pnpm test -- tests/app/projects.test.ts && pnpm build` - commit: `feat(ui): add project setup screens`
- [ ] F5-S2 - owner: dev - Add global settings and project override screens generated from registry metadata, including validation, reset-to-built-in/inheritance actions, sensitive-change confirmation, and effective-value display. - files: `src/app/(app)/settings/page.tsx`, `src/app/(app)/projects/[projectKey]/settings/page.tsx`, `src/app/actions/settings.ts`, `src/components/app/settings-form.tsx`, `tests/app/settings-actions.test.ts` - verify: `pnpm test -- tests/app/settings-actions.test.ts` - commit: `feat(ui): add settings management`
- [ ] F5-S3 - owner: dev - Add project check CRUD, keyboard-first manual ticket and step creation, derived status tree, filters, ready and attention queues, notes, events, check runs, and dependency management with cycle-path feedback. - files: `src/app/(app)/projects/[projectKey]/page.tsx`, `src/app/(app)/tickets/[ticketKey]/page.tsx`, `src/app/actions/tickets.ts`, `src/app/actions/steps.ts`, `src/app/actions/checks.ts`, `src/components/app/*`, `tests/app/project-workflow.test.ts` - verify: `pnpm test -- tests/app/project-workflow.test.ts && pnpm typecheck` - commit: `feat(ui): add project planning workflow`
- [ ] F5-S4 - owner: dev - Add proposed-plan review UI for ticket and step acceptance, editing, rejection, and dependency visibility; poll at the effective interval without duplicating core rules. - files: `src/app/(app)/projects/[projectKey]/proposals/page.tsx`, `src/app/actions/proposals.ts`, `src/components/app/proposal-review.tsx`, `tests/app/proposals.test.ts` - verify: `pnpm test -- tests/app/proposals.test.ts` - commit: `feat(ui): add proposed plan review`

#### Test plan

- Create a project and named checks, then create a ticket and chained steps through server actions.
- Verify a global setting affects the next core/MCP operation and project override takes precedence.
- Verify invalid settings display field-level errors and sensitive changes require confirmation.
- Verify the UI surfaces a dependency cycle rejection with its path.
- Verify proposed items are visible for humans but unavailable to execution until accepted.
- Verify pages comply with semantic-token, action-hierarchy, accessibility, and responsive design-system rules.

#### Configuration and rollout

No new environment variables or migrations. Add only shadcn components needed by the specified screens. The local Next.js server must bind to `127.0.0.1`.

#### Risks and watch points

- Keep client components limited to browser events, polling, drag-and-drop, and interactive dialogs.
- Do not expose command strings or sensitive setting values where not needed.
- Avoid duplicating derived phase/readiness logic in React; request it from the core query layer.

#### Acceptance criteria

- [ ] A human can create a project, checks, ticket, and steps entirely from the interface.
- [ ] Global settings and project overrides show effective values and validate server-side.
- [ ] The project view exposes statuses, phases, ready work, attention items, notes, events, and check runs.
- [ ] A human can accept, edit, or reject an agent proposal in the interface.
- [ ] The UI follows the mandatory design system and is accessible in light and dark themes.

#### Open questions


### F6 - Feature review workflow

Status: Planned
Type: feat
Branch: feat/feature-review
Base: main
Depends on: F5

#### Goal

Add the human feature-review screen with read-only branch and per-step diffs, check evidence, history, validation, and targeted or bulk reopening.

#### Data model

No schema change. Use ticket branch/worktree data, step commits, check runs, notes, and events from the existing schema.

#### Impacted files

- `src/runner/git-reader.ts` - bounded read-only diff operations
- `src/core/review-service.ts`, `src/core/core-api.ts` - review snapshot and mutations
- `src/app/(app)/tickets/[ticketKey]/review/page.tsx`, `src/app/actions/review.ts` - review route and server actions
- `src/components/app/feature-review.tsx`, `src/components/app/diff-view.tsx` - review presentation
- `tests/core/review-service.test.ts`, `tests/runner/diff-reader.test.ts`, `tests/app/feature-review.test.ts` - behavior tests

#### Steps

- [ ] F6-S1 - owner: dev - Add bounded, validated, read-only git diff methods for the ticket branch and commit-by-commit step ranges, including truncation metadata. - files: `src/runner/git-reader.ts`, `tests/runner/diff-reader.test.ts` - verify: `pnpm test -- tests/runner/diff-reader.test.ts` - commit: `feat(runner): read bounded feature diffs`
- [ ] F6-S2 - owner: dev - Extend review queries and mutations to return complete feature evidence, validate only review-phase tickets, validate tickets, and reopen selected/all steps using the documented dependent-step cascade. - files: `src/core/review-service.ts`, `src/core/core-api.ts`, `tests/core/review-service.test.ts` - verify: `pnpm test -- tests/core/review-service.test.ts` - commit: `feat(core): add feature review actions`
- [ ] F6-S3 - owner: dev - Implement the feature-review screen with check results, global and per-step diffs, event timeline, validation, targeted rejection with required comment, and bulk rejection confirmation. - files: `src/app/(app)/tickets/[ticketKey]/review/page.tsx`, `src/app/actions/review.ts`, `src/components/app/feature-review.tsx`, `src/components/app/diff-view.tsx`, `tests/app/feature-review.test.ts` - verify: `pnpm test -- tests/app/feature-review.test.ts && pnpm build` - commit: `feat(ui): add feature review screen`

#### Test plan

- Verify diff commands validate all branch and SHA inputs and never write to git.
- Verify missing/invalid branch data yields an explicit review error rather than a silent empty diff.
- Verify successful feature validation requires derived phase `review`.
- Verify targeted reopening resets selected and transitive done dependents, preserves in-progress dependents, and records the human comment as rejection notes.
- Verify bulk rejection acts as reopening all eligible steps.

#### Configuration and rollout

No new environment variables or migrations. Diff output remains bounded by `git.diff_max_bytes`; update the setting through the existing settings UI where needed.

#### Risks and watch points

- Diffs can contain untrusted repository content; render strictly as escaped text.
- The application displays review information only and never merges or mutates a git worktree.

#### Acceptance criteria

- [ ] Review pages show feature summary, check results, read-only diffs, and event history.
- [ ] A ticket can be validated only from derived phase `review`.
- [ ] Targeted and bulk rejection reopen the correct steps with traceable notes and events.
- [ ] Invalid diff inputs cannot cause shell injection or git writes.

#### Open questions


### F7 - Deterministic plan export

Status: Planned
Type: feat
Branch: feat/plan-export
Base: main
Depends on: F6

#### Goal

Generate deterministic, human- and agent-readable `PLAN.md` files from database snapshots. Provide preview and export in the UI, an explicit local script, and optional debounced automatic export.

#### Data model

No schema change. Read existing project, ticket, step, dependency, note, check, and event data; use the highest project event identifier as the export revision.

#### Impacted files

- `src/export/render-plan.ts`, `src/export/export-writer.ts`, `src/export/export-service.ts` - pure rendering, atomic writes, and snapshot orchestration
- `scripts/export-plan.ts` - explicit command-line entry point
- `src/app/(app)/projects/[projectKey]/export/page.tsx`, `src/app/actions/export.ts` - preview and export controls
- `src/app/auto-export.ts` - event-revision polling and debounce lifecycle
- `tests/export/*` - renderer snapshot, options, Mermaid, and atomic writer tests

#### Steps

- [ ] F7-S1 - owner: dev - Implement `renderPlan(snapshot, options): string` as a pure renderer with stable ticket, step, and dependency ordering; revision header; status markers; optional graph, notes, ticket scope, and status filtering. - files: `src/export/render-plan.ts`, `tests/export/render-plan.test.ts`, `tests/export/__snapshots__/*` - verify: `pnpm test -- tests/export/render-plan.test.ts` - commit: `feat(export): render deterministic plan markdown`
- [ ] F7-S2 - owner: dev - Implement snapshot loading, effective export-directory resolution, explicit repository-destination validation, and temporary-file-plus-rename atomic output. - files: `src/export/export-service.ts`, `src/export/export-writer.ts`, `tests/export/export-writer.test.ts` - verify: `pnpm test -- tests/export/export-writer.test.ts` - commit: `feat(export): write plan files atomically`
- [ ] F7-S3 - owner: dev - Add the `export-plan` script and the project export preview/action UI with all supported options and explicit result or error feedback. - files: `scripts/export-plan.ts`, `package.json`, `src/app/(app)/projects/[projectKey]/export/page.tsx`, `src/app/actions/export.ts`, `tests/export/export-command.test.ts` - verify: `pnpm test -- tests/export/export-command.test.ts && pnpm build` - commit: `feat(export): add plan export controls`
- [ ] F7-S4 - owner: dev - Add debounced automatic export driven by changed project event revisions and effective `export.auto_export` settings, without relying on process-local mutation notifications. - files: `src/app/auto-export.ts`, `src/app/layout.tsx`, `tests/export/auto-export.test.ts` - verify: `pnpm test -- tests/export/auto-export.test.ts` - commit: `feat(export): add automatic plan export`

#### Test plan

- Snapshot identical input twice and assert byte-for-byte identical output.
- Cover project and ticket scope, status filtering, notes inclusion, and Mermaid node-ID escaping.
- Verify proposed content remains included and clearly marked.
- Verify writer leaves no partial destination file on failure and replaces output atomically on success.
- Verify auto-export reacts to persisted event revision changes and coalesces updates by debounce interval.

#### Configuration and rollout

No new environment variables or migrations. The user configures `export.dir` and optionally `export.auto_export`; export to a repository path requires explicit configuration and remains uncommitted by the application.

#### Risks and watch points

- Never include a current timestamp or other nondeterministic value in rendered output.
- Avoid allowing arbitrary destinations; enforce the configured effective export directory and explicit repository-write policy.

#### Acceptance criteria

- [ ] Exported plans are deterministic and include the documented overview and feature format.
- [ ] Optional notes, graph, scope, and status filters work correctly.
- [ ] UI and `pnpm export-plan -- <KEY>` produce the same output.
- [ ] Exports use atomic file replacement and automatic export is debounced.

#### Open questions


### F8 - Operational hardening and documentation

Status: Planned
Type: feat
Branch: feat/operational-hardening
Base: main
Depends on: F7

#### Goal

Complete MVP operational safeguards: lease sweeping, backups, size limits, useful recovery messages, and installation/usage documentation. Validate all specified end-to-end acceptance scenarios.

#### Data model

No schema change. Retention uses filesystem backups only; all runtime configuration remains in `app_settings` and existing project override columns.

#### Impacted files

- `src/core/step-service.ts`, `src/core/errors.ts` - lease sweep and actionable error detail
- `src/app/maintenance.ts`, `src/app/layout.tsx` - timer lifecycle and startup maintenance
- `src/db/backup.ts` - timestamped local backup and retention
- `src/mcp/responses.ts`, `src/export/*`, `src/runner/*` - consistent size limits and recovery hints
- `README.md`, `docs/installation.md`, `docs/mcp-setup.md` - local installation, migration, MCP, backup, and operation documentation
- `tests/acceptance/*`, `tests/db/backup.test.ts` - all documented acceptance scenarios

#### Steps

- [ ] F8-S1 - owner: dev - Add startup database backup with configured retention, safe copy semantics, explicit failures, and tests for enabled, disabled, and retention behavior. - files: `src/db/backup.ts`, `src/app/maintenance.ts`, `tests/db/backup.test.ts` - verify: `pnpm test -- tests/db/backup.test.ts` - commit: `feat(ops): add local database backups`
- [ ] F8-S2 - owner: dev - Add the configurable lease-sweep timer to the Next.js process, preserve lazy expiry in core calls, and ensure lease-expiry transitions, notes, and events are race-safe. - files: `src/core/step-service.ts`, `src/app/maintenance.ts`, `src/app/layout.tsx`, `tests/core/lease-expiry.test.ts` - verify: `pnpm test -- tests/core/lease-expiry.test.ts` - commit: `feat(core): add lease expiration maintenance`
- [ ] F8-S3 - owner: dev - Apply documented response, diff, output, and input-size limits consistently and improve all user/MCP errors with a recovery hint while preserving typed error codes. - files: `src/core/errors.ts`, `src/mcp/responses.ts`, `src/runner/check-runner.ts`, `src/runner/git-reader.ts`, `src/export/export-service.ts`, `tests/core/limits.test.ts` - verify: `pnpm test -- tests/core/limits.test.ts tests/mcp` - commit: `feat(ops): harden limits and error guidance`
- [ ] F8-S4 - owner: dev - Add installation, migration, local-only runtime, MCP client configuration, backup, export, and agent-operation documentation; add automated acceptance scenarios for all 18 specified cases. - files: `README.md`, `docs/installation.md`, `docs/mcp-setup.md`, `tests/acceptance/*` - verify: `pnpm test -- tests/acceptance && pnpm typecheck && pnpm lint && pnpm build` - commit: `docs: document local operation`

#### Test plan

- Execute all 18 `SPECS.md` section-12 scenarios through core, runner, MCP, and UI-facing integration boundaries.
- Verify the lease sweep works while the UI process is running and lazy expiry works when it is not.
- Verify backup retention never deletes unrelated files and reports copy errors explicitly.
- Verify all public MCP errors have a valid code, concise message, and actionable hint.
- Run the full repository validation suite after the final feature.

#### Configuration and rollout

No new environment variables or migrations. Document `PLAN_DB_PATH`, `PLAN_AGENT_NAME`, and `PLAN_PROJECT`; users review and apply the F1 migration before first launch and retain ownership of backups, git operations, MCP client setup, and local process startup.

#### Risks and watch points

- Timers must not be duplicated during Next.js development reloads.
- Backup code must target only the configured database and dedicated backup directory.
- This feature must not broaden the MVP into remote service management or a general CLI.

#### Acceptance criteria

- [ ] Lease expiry, automatic export, backup, limits, and error messages satisfy M7 requirements.
- [ ] All 18 documented acceptance scenarios pass.
- [ ] Documentation is sufficient to install, migrate, run locally, configure MCP, export plans, and recover from common failures.
- [ ] Full typecheck, lint, test, and production build pass.

#### Open questions


## Open questions

