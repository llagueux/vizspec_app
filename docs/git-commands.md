# Git Commands for the Feature Workflow

This reference follows the Planner -> Dev -> Reviewer workflow described in
[`README.md`](../README.md). Run these commands yourself: the agents do not
push, merge, rebase, reset, delete branches, or apply database migrations.

## One-time setup

| Command | Purpose |
|---|---|
| `git config core.hooksPath .githooks` | Enables the repository's pre-commit protection against committing on protected branches. |
| `node .github/hooks/guard.test.cjs` | Verifies that the Copilot guard hook is configured correctly. |

## Before starting a feature

| Command | Purpose |
|---|---|
| `git status --short --branch` | Shows the current branch and uncommitted changes. Start only with a clean tree, except for the roadmap file when the workflow permits it. |
| `git fetch origin` | Downloads the latest remote references without changing local files. |
| `git switch main` | Switches to the default integration branch. Prefer `switch` over the deprecated `checkout` workflow used by this project. |
| `git pull --ff-only origin main` | Updates local `main` without creating a merge commit; run this after a feature is merged. |
| `git branch --show-current` | Confirms the checked-out branch. Use it before edits and commits. |

## Starting the branch specified in a roadmap

Replace `<branch>` with the branch listed for the selected feature, such as
`feat/budget-dashboard`.

| Command | Purpose |
|---|---|
| `git switch -c <branch>` | Creates and switches to a new feature branch from the current, updated `main`. |
| `git switch <branch>` | Switches to an existing feature branch to resume its implementation. |
| `git branch --show-current` | Verifies that the active branch is the roadmap branch, not `main`. |

Use only names matching `feat/`, `fix/`, `refactor/`, or `chore/` followed by a
kebab-case slug of at most 40 characters. Do not start a dependent feature
until its prerequisite has been merged and local `main` is updated.

## During implementation and review

| Command | Purpose |
|---|---|
| `git status --short` | Checks exactly which files will be included in the next commit. |
| `git diff` | Reviews unstaged changes before staging them. |
| `git diff --staged` | Reviews the exact content staged for the next commit. |
| `git add <path>...` | Stages only the files for the completed roadmap step. Avoid `git add .` unless every change is intentional. |
| `git commit -m "type(scope): summary"` | Creates the single commit for a roadmap step using a Conventional Commit message. |
| `git log main..HEAD --oneline` | Lists all commits delivered by the current feature branch. |
| `git diff main...HEAD` | Shows the complete feature diff against its base branch. Useful before requesting or performing a review. |

Typical commit types are `feat`, `fix`, `refactor`, `chore`, `test`, and
`docs`. Do not commit application code on `main`, `master`, `develop`, or
`production`.

## Publishing and merging a reviewed feature

Run these only after the feature has passed its checks and Reviewer review.

| Command | Purpose |
|---|---|
| `git push -u origin <branch>` | Publishes the branch and sets its upstream; use this for the first push. |
| `git push` | Pushes later commits to the configured upstream branch. |
| `gh pr create --base main --head <branch> --fill` | Creates a pull request using the commit history to prefill its title and body. Review the generated content before submitting. |
| `gh pr view --web` | Opens the current branch's pull request in the browser for review. |
| `gh pr merge --merge --delete-branch` | Merges the approved pull request with a merge commit and deletes the remote branch. Use only when the pull request is ready and branch protection allows it. |
| `git switch main && git pull --ff-only origin main` | Returns to an updated local `main` after merging, ready for the next eligible feature. |

## Commands intentionally avoided by agents

Agents are deliberately prohibited from running `git push`, `git merge`,
`git rebase`, `git reset`, `git checkout`, and branch-deletion commands. These
operations are reserved for you because they can rewrite history, remove work,
or change the integration branch. Use the pull-request workflow above instead
of applying these commands during normal feature delivery.
