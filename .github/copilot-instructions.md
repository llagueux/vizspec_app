# Project context

Full-stack web application built and maintained by a solo developer. Priorities: simplicity, maintainability, small and verifiable changes.

## Stack
- Next.js (App Router), strict TypeScript, TailwindCSS, shadcn/ui
- Drizzle ORM

## Commands (replace `pnpm` if you use another package manager)
- `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`
- `pnpm drizzle-kit generate` creates migrations. Migrations are applied by the user, never by an agent.

## Code conventions
- Server Components by default; add `"use client"` only for state, effects or browser events.
- Mutations go through Server Actions or Route Handlers; validate every input with Zod.
- Database access only in `src/db/` and `src/server/`, never from client components.
- Reuse shadcn/ui components before creating new ones.
- No new dependency unless the plan justifies it.

## Language
- Code, identifiers, commit messages, plans and documentation: **English**.
- Chat replies to the user: **French**.

## Agent workflow (one roadmap, one feature at a time)
1. `Planner` creates one complete app roadmap in `docs/plans/<slug>.md`, split into ordered, independently deliverable features (dependencies, acceptance criteria and a branch name for each).
2. The user reviews the roadmap and asks `Dev` to implement one feature by its ID. `Dev` works on that feature only, commits each step, and delegates schema steps to `DB`.
3. `Dev` asks `Reviewer` to review that feature's branch against its roadmap section and base branch before reporting.
4. The user pushes, opens the pull request and merges the feature. Only then can `Dev` start the next eligible feature, on a new branch based on the updated `main`.
5. Repeat until all features are done. The user handles all pushes, pull requests, merges and migrations.

## Git rules (all agents)
- Never edit code or commit on `main`, `master`, `develop` or `production`.
- Branch names: `feat/<slug>`, `fix/<slug>`, `refactor/<slug>` or `chore/<slug>` (kebab-case, 40 characters max).
- Commit messages follow Conventional Commits.
- Never run `git push`, `git merge`, `git rebase`, `git reset`, `git checkout` or delete branches. The user does these. Use `git switch` to change branches.
- Never read or write `.env*` files, except `.env.example`.
