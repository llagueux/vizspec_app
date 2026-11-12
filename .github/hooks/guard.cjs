#!/usr/bin/env node
'use strict';
/**
 * preToolUse guard for the planner -> dev -> reviewer/db agent chain.
 *
 * Reads one hook event as JSON on stdin and prints exactly one JSON object on stdout:
 *   {}                                                    -> no decision (normal permission flow)
 *   {"permissionDecision":"deny","permissionDecisionReason":"..."} -> block the tool call
 *
 * Usage: node .github/hooks/guard.cjs [--mode=default|planner|reviewer|db]
 *   default  : global rules only (repository-wide hook, applies to every agent)
 *   planner  : may edit only docs/plans/*.md, no terminal
 *   reviewer : no edits, terminal limited to read-only git commands
 *   db       : may edit only src/db/** and drizzle/*.sql, terminal limited to drizzle-kit generate/check, typecheck, git read-only
 *
 * Failure policy: if the event cannot be parsed, or a file path cannot be extracted from an
 * edit call, the guard allows the call and warns on stderr (fail-open) so a payload change
 * never blocks all work. Run `node .github/hooks/guard.test.cjs` to check the rules.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'production']);
const modeArg = process.argv.find((a) => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'default';

const warn = (m) => process.stderr.write(`[guard] ${m}\n`);

function readEvent() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    warn(`cannot parse hook input (${e.message}); allowing`);
    return null;
  }
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function toRel(p, cwd) {
  let q = String(p).replace(/^file:\/\//, '').replace(/\\/g, '/');
  if (path.isAbsolute(q) || /^[A-Za-z]:\//.test(q)) q = path.relative(cwd, q).replace(/\\/g, '/');
  return q.replace(/^\.\//, '');
}

function pathsFrom(args) {
  const out = new Set();
  const keyRe = /^(file_?path|path|file|filename|target|uri|old_?path|new_?path)$/i;
  const visit = (v, key = '') => {
    if (typeof v === 'string') {
      if (keyRe.test(key)) out.add(v);
      for (const m of v.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) out.add(m[1].trim());
      for (const m of v.matchAll(/^\+\+\+ b\/(.+)$/gm)) out.add(m[1].trim());
    } else if (Array.isArray(v)) {
      v.forEach((x) => visit(x, key));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) visit(x, k);
    }
  };
  visit(args);
  return [...out];
}

const ENV_FILE = /(^|\/)\.env(\.[A-Za-z0-9_-]+)*$/;
const ENV_SAFE = /\.env\.(example|sample|template)$/;
const isEnvFile = (p) => ENV_FILE.test(p) && !ENV_SAFE.test(p);
// A .env reference inside a shell command: preceded by start/space/slash/quote/=, not by a word char (so process.env is ignored).
const ENV_IN_CMD = /(^|[\s/"'=])\.env(\.[A-Za-z0-9_-]+)*(?![\w.-])/;

const PLAN_FILE = /^docs\/plans\/[^/]+\.md$/;

const GLOBAL_SHELL_DENY = [
  [/\bgit\s+(?:-C\s+\S+\s+)?push\b/, 'git push is reserved for the user.'],
  [/\bgit\s+(?:-C\s+\S+\s+)?(merge|rebase|reset|checkout|clean)\b/, 'This git command is reserved for the user (use `git switch` to change branches).'],
  [/\bgit\s+(?:-C\s+\S+\s+)?branch\s+(-D|-d|--delete|-m|-M)\b/, 'Deleting or renaming branches is reserved for the user.'],
  [/--no-verify\b/, 'Bypassing git hooks is not allowed.'],
  [/\brm\s+-[a-zA-Z]*(rf|fr)[a-zA-Z]*\b/, 'Recursive forced deletion is not allowed.'],
  [/\bdrizzle-kit\s+(push|drop|migrate)\b/, 'Applying or dropping migrations is reserved for the user.'],
  [/(^|[;&|(]\s*)gh\s/, 'The GitHub CLI is reserved for the user.'],
];

const READONLY_GIT = [
  /^\s*git\s+(diff|log|status|show)\b/,
  /^\s*git\s+branch\s+--show-current\s*$/,
];
const SHELL_ALLOWLISTS = {
  planner: [],
  reviewer: READONLY_GIT,
  db: [/^\s*pnpm\s+drizzle-kit\s+(generate|check)\b/, /^\s*pnpm\s+typecheck\b/, ...READONLY_GIT],
};
const CHAINING = /[;&|<>`]|\$\(/;

function decide(event) {
  const toolName = String(event.toolName ?? event.tool_name ?? '').toLowerCase();
  let args = event.toolArgs ?? event.tool_input ?? {};
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      if (parsed && typeof parsed === 'object') args = parsed;
    } catch {
      /* keep raw string (e.g. an apply_patch body) */
    }
  }
  const cwd = event.cwd || process.cwd();

  const isShell = /bash|powershell|shell|terminal|execute/.test(toolName);
  const isEdit = !isShell && /edit|create|write|patch|replace|insert/.test(toolName);
  const isRead = !isShell && !isEdit && /^(view|read|read_file|cat)$|read_file/.test(toolName);

  if (isShell) {
    const cmd = String(
      (args && (args.command ?? args.cmd)) ?? (typeof args === 'string' ? args : JSON.stringify(args)),
    );
    for (const [re, why] of GLOBAL_SHELL_DENY) if (re.test(cmd)) return why;
    if (ENV_IN_CMD.test(cmd) && !ENV_SAFE.test(cmd)) return 'Environment files (.env*) must not be accessed.';
    if (MODE === 'planner') return 'The planner has no terminal access.';
    if (SHELL_ALLOWLISTS[MODE]) {
      const ok = SHELL_ALLOWLISTS[MODE].some((re) => re.test(cmd)) && !CHAINING.test(cmd);
      if (!ok) return `The ${MODE} agent may only run its allowed read-only/generation commands (no chaining or redirection).`;
    }
    if (/\bgit\s+(commit|add)\b/.test(cmd)) {
      const b = currentBranch(cwd);
      if (PROTECTED_BRANCHES.has(b)) return `Commits on protected branch '${b}' are blocked. Create the feature branch from the plan first (git switch -c <branch>).`;
    }
    return null;
  }

  if (isEdit || isRead) {
    const raw = pathsFrom(args);
    const paths = raw.map((p) => toRel(p, cwd));
    for (const p of paths) if (isEnvFile(p)) return 'Environment files (.env*) must not be read or written.';
    if (isRead) return null;

    if (MODE === 'reviewer') return 'The reviewer is read-only.';
    if (paths.length === 0) {
      warn(`no file path found in ${toolName} call; allowing`);
      return null;
    }
    for (const p of paths) {
      if (p.startsWith('..')) return 'Edits outside the workspace are not allowed.';
      if (MODE === 'planner' && !PLAN_FILE.test(p)) return `The planner may only write docs/plans/*.md (got '${p}').`;
      if (MODE === 'db' && !(/^src\/db\//.test(p) || /^drizzle\/[^/]+\.sql$/.test(p))) return `The db agent may only edit src/db/** and drizzle/*.sql (got '${p}').`;
      if (/^drizzle\/meta\//.test(p)) return 'drizzle/meta is generated by drizzle-kit; do not edit it by hand.';
    }
    const b = currentBranch(cwd);
    if (PROTECTED_BRANCHES.has(b) && paths.some((p) => !PLAN_FILE.test(p))) {
      return `You are on protected branch '${b}'. Create the feature branch named in the plan first (git switch -c <branch>).`;
    }
  }
  return null;
}

function main() {
  const event = readEvent();
  if (!event) return {};
  try {
    const reason = decide(event);
    return reason ? { permissionDecision: 'deny', permissionDecisionReason: reason } : {};
  } catch (e) {
    warn(`internal error (${e.message}); allowing`);
    return {};
  }
}

process.stdout.write(JSON.stringify(main()));
