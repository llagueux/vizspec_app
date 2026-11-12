#!/usr/bin/env node
'use strict';
// Self-test for guard.cjs. Run: node .github/hooks/guard.test.cjs
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const guard = path.join(__dirname, 'guard.cjs');
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-test-'));
const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
git('init', '-q', '-b', 'main');
git('config', 'user.email', 't@example.com');
git('config', 'user.name', 'test');
git('commit', '-q', '--allow-empty', '-m', 'init');

function run(mode, event) {
  const r = spawnSync('node', [guard, `--mode=${mode}`], {
    input: JSON.stringify({ cwd: repo, ...event }),
    encoding: 'utf8',
  });
  try { return JSON.parse(r.stdout).permissionDecision === 'deny' ? 'deny' : 'allow'; } catch { return 'invalid-output'; }
}
const sh = (command) => ({ toolName: 'bash', toolArgs: { command } });
const ed = (file, tool = 'edit') => ({ toolName: tool, toolArgs: { path: path.join(repo, file) } });
const edSnake = (file) => ({ tool_name: 'Edit', tool_input: { file_path: file } });

let failed = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${got}, want ${want})`);
};

// --- on main (protected) ---
check('main: edit src file', run('default', ed('src/a.ts')), 'deny');
check('main: edit plan file', run('default', ed('docs/plans/x.md')), 'allow');
check('main: git commit', run('default', sh('git commit -m "x"')), 'deny');
check('main: git switch -c', run('default', sh('git switch -c feat/x')), 'allow');
check('main: planner writes plan', run('planner', ed('docs/plans/x.md')), 'allow');

git('switch', '-q', '-c', 'feat/x');
// --- on feature branch, default mode ---
check('feat: edit src file', run('default', ed('src/a.ts')), 'allow');
check('feat: edit src file (snake_case payload)', run('default', edSnake(path.join(repo, 'src/a.ts'))), 'allow');
check('feat: edit .env.local', run('default', ed('.env.local')), 'deny');
check('feat: edit .env.example', run('default', ed('.env.example')), 'allow');
check('feat: edit drizzle/meta', run('default', ed('drizzle/meta/_journal.json')), 'deny');
check('feat: edit outside workspace', run('default', { toolName: 'edit', toolArgs: { path: '/etc/hosts' } }), 'deny');
check('feat: git commit', run('default', sh('git commit -m "feat: x"')), 'allow');
check('feat: git push', run('default', sh('git push origin feat/x')), 'deny');
check('feat: chained git push', run('default', sh('pnpm test && git push')), 'deny');
check('feat: git checkout', run('default', sh('git checkout main')), 'deny');
check('feat: git reset --hard', run('default', sh('git reset --hard HEAD~1')), 'deny');
check('feat: commit --no-verify', run('default', sh('git commit --no-verify -m x')), 'deny');
check('feat: rm -rf', run('default', sh('rm -rf node_modules')), 'deny');
check('feat: drizzle-kit push', run('default', sh('pnpm drizzle-kit push')), 'deny');
check('feat: gh pr create', run('default', sh('gh pr create')), 'deny');
check('feat: cat .env', run('default', sh('cat .env')), 'deny');
check('feat: grep process.env', run('default', sh('grep -rn process.env src')), 'allow');
check('feat: pnpm typecheck', run('default', sh('pnpm typecheck')), 'allow');
check('feat: read .env', run('default', { toolName: 'view', toolArgs: { path: path.join(repo, '.env') } }), 'deny');

// --- planner ---
check('planner: edit src file', run('planner', ed('src/a.ts')), 'deny');
check('planner: edit plan', run('planner', ed('docs/plans/x.md')), 'allow');
check('planner: shell', run('planner', sh('ls')), 'deny');
check('planner: apply_patch outside plans', run('planner', { toolName: 'apply_patch', toolArgs: '*** Begin Patch\n*** Update File: src/a.ts\n@@\n-a\n+b\n*** End Patch' }), 'deny');
check('planner: apply_patch plan', run('planner', { toolName: 'apply_patch', toolArgs: '*** Begin Patch\n*** Add File: docs/plans/y.md\n+x\n*** End Patch' }), 'allow');

// --- reviewer ---
check('reviewer: edit', run('reviewer', ed('docs/plans/x.md')), 'deny');
check('reviewer: git diff', run('reviewer', sh('git diff main...HEAD')), 'allow');
check('reviewer: git diff > file', run('reviewer', sh('git diff > out.txt')), 'deny');
check('reviewer: cat file', run('reviewer', sh('cat src/a.ts')), 'deny');
check('reviewer: show-current', run('reviewer', sh('git branch --show-current')), 'allow');

// --- db ---
check('db: edit schema', run('db', ed('src/db/schema.ts')), 'allow');
check('db: edit sql', run('db', ed('drizzle/0001_x.sql')), 'allow');
check('db: edit app code', run('db', ed('src/app/page.tsx')), 'deny');
check('db: drizzle-kit generate', run('db', sh('pnpm drizzle-kit generate')), 'allow');
check('db: drizzle-kit push', run('db', sh('pnpm drizzle-kit push')), 'deny');
check('db: arbitrary command', run('db', sh('node script.js')), 'deny');

// --- robustness ---
const bad = spawnSync('node', [guard], { input: 'not json', encoding: 'utf8' });
check('malformed input -> {}', bad.stdout.trim(), '{}');

fs.rmSync(repo, { recursive: true, force: true });
console.log(failed ? `\n${failed} test(s) failed` : '\nAll guard tests passed');
process.exit(failed ? 1 : 0);
