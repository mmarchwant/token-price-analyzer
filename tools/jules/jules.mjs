#!/usr/bin/env node
// Maintainer CLI for driving Google Jules through its REST API, one task from JULES_PROMPTS.md at a time.
// Zero dependencies (Node 22+). The API key is read ONLY from the JULES_API_KEY environment variable
// and is never printed or written to disk. Local session state lives in tools/jules/.state.json (gitignored).
//
// Usage: node tools/jules/jules.mjs <command> [args] [options]   (run with --help for details)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const PROMPTS_FILE = join(REPO_ROOT, 'JULES_PROMPTS.md');
const STATE_FILE = join(HERE, '.state.json');

// Mirrors the dependency table in JULES_PROMPTS.md (section "Kolejność i zależności").
const DEPENDENCIES = {
  '01': [],
  '02': ['01'],
  '03': ['02'],
  '04': ['02'],
  '05': ['03', '04'],
  '06': ['05'],
  '07': ['06'],
  '08': ['07'],
  '09': ['08'],
  '10': ['08'],
  '11': ['08'],
  '12': ['09', '10', '11'],
  '13': ['12'],
  '14': ['13'],
  '15': ['12'],
  '16': ['12'],
  '17': ['13', '14', '15', '16'],
  M1: ['17'],
  M2: ['17'],
  M3: ['17'],
};

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED']);
const ATTENTION_STATES = new Set(['AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'PAUSED']);

const HELP = `Jules CLI for token-price-analyzer

Setup (PowerShell):  $env:JULES_API_KEY = "<your key>"
Setup (bash):        export JULES_API_KEY="<your key>"

Commands:
  tasks                         List tasks parsed from JULES_PROMPTS.md with local status
  next                          Show tasks whose dependencies are merged and that were not started
  prompt <id>                   Print a task prompt (e.g. to fill M2/M3 placeholders: prompt M3 > m3.md)
  sources                       List GitHub repos connected to Jules
  start <id>                    Create a Jules session for a task (e.g. 01, 13, M1)
        --source <name>         Jules source (default: derived from git remote "origin")
        --branch <name>         Starting branch (default: main)
        --auto-approve          Let Jules auto-approve its plan (default: you approve with "approve")
        --note <text>           Append a note to the prompt (e.g. why a previous attempt failed)
        --prompt-file <path>    Use this file as the prompt instead (required for M2/M3 placeholders)
        --force                 Start even if dependencies are not merged / a session already exists
        --dry-run               Print what would be sent, do not call the API
  status [id]                   Show session state and PR link (all started tasks if no id)
  plan <id>                     Show the latest plan Jules generated
  approve <id>                  Approve the latest plan
  message <id> <text>           Send a message to the session
  activities <id> [--limit n]   Show the most recent activities (default 15)
  watch <id> [--interval s]     Poll until the session needs you or finishes (default 30s)
  mark-merged <id>              Record that the task's PR is merged (when gh CLI is unavailable)
  forget <id>                   Remove the task from local state (to start over)

Notes:
  - Each "start" consumes one of your daily Jules tasks and opens a PR (AUTO_CREATE_PR).
  - Dependency checks use "gh pr view" when the GitHub CLI is installed, otherwise "mark-merged".
`;

// ---------- prompts ----------

function loadTasks() {
  if (!existsSync(PROMPTS_FILE)) fail(`Cannot find ${PROMPTS_FILE}`);
  const text = readFileSync(PROMPTS_FILE, 'utf8').replace(/\r\n/g, '\n');
  const tasks = new Map();
  for (const match of text.matchAll(/^````text\n([\s\S]*?)\n````$/gm)) {
    const body = match[1];
    const firstLine = body.split('\n', 1)[0] ?? '';
    const header = /^# (?:Task (\d{2})|Maintenance (M\d+)) — (.+)$/.exec(firstLine);
    if (!header) continue;
    const id = header[1] ?? header[2];
    tasks.set(id, { id, title: firstLine.replace(/^# /, ''), prompt: body });
  }
  if (tasks.size === 0) fail('No task prompts found in JULES_PROMPTS.md');
  return tasks;
}

function getTask(tasks, rawId) {
  const id = normalizeId(rawId);
  const task = tasks.get(id);
  if (!task) fail(`Unknown task "${rawId}". Known: ${[...tasks.keys()].join(', ')}`);
  return task;
}

function normalizeId(raw) {
  if (!raw) fail('Missing task id (e.g. 01, 7, M1)');
  const s = String(raw).trim().toUpperCase();
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
  return s;
}

// ---------- local state ----------

function loadState() {
  if (!existsSync(STATE_FILE)) return { tasks: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    fail(`Corrupted state file ${STATE_FILE}; fix or delete it.`);
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function taskState(state, id) {
  return state.tasks[id];
}

// ---------- API ----------

function apiKey() {
  const key = process.env.JULES_API_KEY;
  if (!key) fail('JULES_API_KEY is not set. See --help for setup.');
  return key;
}

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: { 'X-Goog-Api-Key': apiKey(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`Jules API ${method} ${path} → HTTP ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

async function listAll(path, key) {
  const items = [];
  let pageToken;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await api(
      'GET',
      `${path}${sep}pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    );
    items.push(...(page[key] ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

function sessionPath(state, id) {
  const entry = taskState(state, id);
  if (!entry?.sessionId) fail(`Task ${id} has no session yet. Run: start ${id}`);
  return `sessions/${entry.sessionId}`;
}

function prUrl(session) {
  return (session.outputs ?? []).map((o) => o.pullRequest?.url).find(Boolean);
}

// ---------- git / gh helpers ----------

function detectSource() {
  try {
    const url = execFileSync('git', ['-C', REPO_ROOT, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(url);
    if (m) return `sources/github/${m[1]}/${m[2]}`;
  } catch {
    // no remote configured
  }
  return undefined;
}

function prMerged(url) {
  try {
    const out = execFileSync('gh', ['pr', 'view', url, '--json', 'state', '-q', '.state'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out === 'MERGED';
  } catch {
    return undefined; // gh missing or not authenticated
  }
}

function isMerged(entry) {
  if (!entry) return false;
  if (entry.merged) return true;
  if (!entry.prUrl) return false;
  return prMerged(entry.prUrl) === true;
}

function unmetDependencies(state, id) {
  return (DEPENDENCIES[id] ?? []).filter((dep) => !isMerged(taskState(state, dep)));
}

// ---------- printing ----------

function describeActivity(a) {
  const when = (a.createTime ?? '').replace('T', ' ').slice(0, 19);
  const who = a.originator ?? '?';
  let what = '';
  if (a.planGenerated) what = `plan generated (${a.planGenerated.plan?.steps?.length ?? 0} steps)`;
  else if (a.planApproved) what = 'plan approved';
  else if (a.userMessaged) what = `you: ${a.userMessaged.userMessage}`;
  else if (a.agentMessaged) what = `jules: ${a.agentMessaged.agentMessage}`;
  else if (a.progressUpdated)
    what = [a.progressUpdated.title, a.progressUpdated.description].filter(Boolean).join(' — ');
  else if (a.sessionCompleted) what = 'session completed';
  else if (a.sessionFailed) what = `session FAILED: ${a.sessionFailed.reason ?? ''}`;
  else what = a.description ?? '(activity)';
  return `${when}  [${who}] ${truncate(what, 400)}`;
}

function printPlan(plan) {
  for (const step of plan.steps ?? []) {
    console.log(`  ${(step.index ?? 0) + 1}. ${step.title}`);
    if (step.description) console.log(`     ${step.description}`);
  }
}

function truncate(s, n) {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- commands ----------

async function cmdTasks(opts = {}) {
  const tasks = loadTasks();
  const state = loadState();
  if (opts.json) {
    const rows = [...tasks.values()].map((t) => {
      const entry = taskState(state, t.id);
      const merged = isMerged(entry);
      return {
        id: t.id,
        title: t.title,
        deps: DEPENDENCIES[t.id] ?? [],
        started: Boolean(entry?.sessionId),
        merged,
        state: entry?.lastState ?? null,
        prUrl: entry?.prUrl ?? null,
        url: entry?.url ?? null,
        ready: !entry && unmetDependencies(state, t.id).length === 0,
      };
    });
    console.log(JSON.stringify(rows));
    return;
  }
  for (const task of tasks.values()) {
    const entry = taskState(state, task.id);
    let status = 'not started';
    if (entry) {
      status = isMerged(entry) ? 'merged' : (entry.lastState ?? 'started');
      if (entry.prUrl && !isMerged(entry)) status += `  ${entry.prUrl}`;
    }
    const deps = DEPENDENCIES[task.id]?.join(',') || '—';
    console.log(`${task.id.padEnd(3)} ${status.padEnd(24)} deps:${deps.padEnd(12)} ${task.title}`);
  }
}

async function cmdNext() {
  const tasks = loadTasks();
  const state = loadState();
  const ready = [...tasks.values()].filter(
    (t) => !taskState(state, t.id) && unmetDependencies(state, t.id).length === 0,
  );
  if (ready.length === 0) {
    console.log('Nothing ready. Merge open PRs (or run mark-merged) and check "status".');
    return;
  }
  console.log('Ready to start (max 3 concurrent on the free plan):');
  for (const t of ready) console.log(`  ${t.id}  ${t.title}`);
}

function cmdPrompt(rawId) {
  process.stdout.write(`${getTask(loadTasks(), rawId).prompt}\n`);
}

async function cmdSources() {
  const sources = await listAll('sources', 'sources');
  if (sources.length === 0) console.log('No sources. Connect the repo in the Jules web app first.');
  for (const s of sources) console.log(s.name);
}

async function cmdStart(rawId, opts) {
  const tasks = loadTasks();
  const state = loadState();
  const task = getTask(tasks, rawId);
  const existing = taskState(state, task.id);

  if (existing && !opts.force) {
    fail(
      `Task ${task.id} already has session ${existing.sessionId}. Use "forget ${task.id}" or --force.`,
    );
  }
  const unmet = unmetDependencies(state, task.id);
  if (unmet.length > 0 && !opts.force) {
    fail(
      `Dependencies not merged: ${unmet.join(', ')}. Merge their PRs (or "mark-merged <id>"), or use --force.`,
    );
  }

  let prompt = opts['prompt-file']
    ? readFileSync(resolve(opts['prompt-file']), 'utf8')
    : task.prompt;
  if (!opts['prompt-file'] && /<(?:provider|plan name|short bug title|e\.g\.|\.\.\.|…)/.test(prompt)) {
    fail(`Task ${task.id} contains <placeholders>. Fill them in a file and pass --prompt-file.`);
  }
  if (opts.note) prompt += `\n\nNote: ${opts.note}`;
  const customTitle = /^# (.+)$/.exec(prompt.replace(/\r\n/g, '\n').split('\n', 1)[0] ?? '');
  const title = opts['prompt-file'] && customTitle ? customTitle[1] : task.title;

  const source = opts.source ?? detectSource();
  if (!source) fail('Cannot derive the Jules source from git remote "origin". Pass --source.');
  const body = {
    prompt,
    title,
    sourceContext: { source, githubRepoContext: { startingBranch: opts.branch ?? 'main' } },
    automationMode: 'AUTO_CREATE_PR',
    requirePlanApproval: !opts['auto-approve'],
  };

  if (opts['dry-run']) {
    console.log(`Would create session for: ${title}`);
    console.log(`  source: ${source}  branch: ${body.sourceContext.githubRepoContext.startingBranch}`);
    console.log(`  requirePlanApproval: ${body.requirePlanApproval}  prompt chars: ${prompt.length}`);
    return;
  }

  const session = await api('POST', 'sessions', body);
  state.tasks[task.id] = {
    sessionId: session.id,
    url: session.url,
    title,
    startedAt: new Date().toISOString(),
    lastState: session.state ?? 'QUEUED',
  };
  saveState(state);
  console.log(`Started ${title}`);
  console.log(`  session: ${session.id}`);
  if (session.url) console.log(`  web:     ${session.url}`);
  console.log(`Next: node tools/jules/jules.mjs watch ${task.id}`);
}

async function refreshSession(state, id) {
  const session = await api('GET', sessionPath(state, id));
  const entry = taskState(state, id);
  entry.lastState = session.state ?? entry.lastState;
  entry.url = session.url ?? entry.url;
  const pr = prUrl(session);
  if (pr) entry.prUrl = pr;
  saveState(state);
  return session;
}

async function cmdStatus(rawId) {
  const state = loadState();
  const ids = rawId ? [normalizeId(rawId)] : Object.keys(state.tasks).sort();
  if (ids.length === 0) console.log('No tasks started yet.');
  for (const id of ids) {
    const session = await refreshSession(state, id);
    const entry = taskState(state, id);
    const merged = isMerged(entry);
    console.log(`${id.padEnd(3)} ${String(session.state).padEnd(24)} ${merged ? 'MERGED ' : ''}${entry.prUrl ?? ''}`);
    console.log(`    ${entry.title}`);
    if (session.url) console.log(`    ${session.url}`);
  }
}

async function latestActivities(state, id) {
  return listAll(`${sessionPath(state, id)}/activities`, 'activities');
}

async function cmdPlan(rawId) {
  const state = loadState();
  const id = normalizeId(rawId);
  const activities = await latestActivities(state, id);
  const planActivity = [...activities].reverse().find((a) => a.planGenerated);
  if (!planActivity) {
    console.log('No plan yet. Check again in a minute ("watch" polls for you).');
    return;
  }
  console.log(`Plan for ${taskState(state, id).title}:`);
  printPlan(planActivity.planGenerated.plan ?? {});
  console.log(`\nApprove: node tools/jules/jules.mjs approve ${id}`);
  console.log(`Or ask for changes: node tools/jules/jules.mjs message ${id} "..."`);
}

async function cmdApprove(rawId) {
  const state = loadState();
  const id = normalizeId(rawId);
  await api('POST', `${sessionPath(state, id)}:approvePlan`, {});
  console.log(`Plan approved for task ${id}.`);
}

async function cmdMessage(rawId, text) {
  if (!text) fail('Missing message text.');
  const state = loadState();
  const id = normalizeId(rawId);
  await api('POST', `${sessionPath(state, id)}:sendMessage`, { prompt: text });
  console.log(`Message sent to task ${id}. Jules replies as a new activity ("activities ${id}").`);
}

async function cmdActivities(rawId, opts) {
  const state = loadState();
  const id = normalizeId(rawId);
  const limit = Number(opts.limit ?? 15);
  const activities = await latestActivities(state, id);
  for (const a of activities.slice(-limit)) console.log(describeActivity(a));
}

async function cmdWatch(rawId, opts) {
  const state = loadState();
  const id = normalizeId(rawId);
  const intervalMs = Math.max(10, Number(opts.interval ?? 30)) * 1000;
  const seen = new Set();
  let lastState;
  for (;;) {
    const session = await refreshSession(state, id);
    const activities = await latestActivities(state, id);
    for (const a of activities) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      console.log(describeActivity(a));
    }
    if (session.state !== lastState) {
      console.log(`--- state: ${session.state}`);
      lastState = session.state;
    }
    if (session.state === 'AWAITING_PLAN_APPROVAL') {
      const planActivity = [...activities].reverse().find((a) => a.planGenerated);
      if (planActivity) printPlan(planActivity.planGenerated.plan ?? {});
      console.log(`\nReview the plan, then: approve ${id}   (or: message ${id} "...")`);
      return;
    }
    if (ATTENTION_STATES.has(session.state)) {
      console.log(`\nJules needs you. Reply with: message ${id} "..."  or open ${session.url ?? 'the web app'}`);
      return;
    }
    if (TERMINAL_STATES.has(session.state)) {
      const pr = prUrl(session);
      console.log(pr ? `\nPR: ${pr}\nReview, wait for green CI, merge, then run "next".` : '\nNo PR found.');
      return;
    }
    await sleep(intervalMs);
  }
}

function cmdMarkMerged(rawId) {
  const state = loadState();
  const id = normalizeId(rawId);
  state.tasks[id] = { ...(state.tasks[id] ?? { title: `Task ${id}` }), merged: true };
  saveState(state);
  console.log(`Task ${id} marked as merged.`);
}

function cmdForget(rawId) {
  const state = loadState();
  const id = normalizeId(rawId);
  delete state.tasks[id];
  saveState(state);
  console.log(`Task ${id} removed from local state.`);
}

// ---------- main ----------

async function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      source: { type: 'string' },
      branch: { type: 'string' },
      'auto-approve': { type: 'boolean' },
      note: { type: 'string' },
      'prompt-file': { type: 'string' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      limit: { type: 'string' },
      interval: { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  const [command, arg, ...rest] = positionals;
  if (opts.help || !command) {
    console.log(HELP);
    return;
  }
  switch (command) {
    case 'tasks':
      return cmdTasks(opts);
    case 'next':
      return cmdNext();
    case 'prompt':
      return cmdPrompt(arg);
    case 'sources':
      return cmdSources();
    case 'start':
      return cmdStart(arg, opts);
    case 'status':
      return cmdStatus(arg);
    case 'plan':
      return cmdPlan(arg);
    case 'approve':
      return cmdApprove(arg);
    case 'message':
      return cmdMessage(arg, rest.join(' '));
    case 'activities':
      return cmdActivities(arg, opts);
    case 'watch':
      return cmdWatch(arg, opts);
    case 'mark-merged':
      return cmdMarkMerged(arg);
    case 'forget':
      return cmdForget(arg);
    default:
      fail(`Unknown command "${command}". Run with --help.`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
