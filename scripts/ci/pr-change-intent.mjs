import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHANGE_INTENT_ENFORCEMENT_START = '2026-10-08T20:00:00Z';
const CHANGE_INTENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MARKER = /<!--\s*vellira-change-intent:v1:([^\s>]+)\s*-->/g;
const TRUSTED_AUTOMATION_LOGINS = new Set([
  'dependabot[bot]',
  'github-actions[bot]',
  'vellira-content-agent[bot]',
  'vellira-release-sync[bot]',
]);

export function parseChangeIntent(body = '') {
  const markers = [...String(body).matchAll(MARKER)].map((match) => match[1]);
  if (markers.length === 0) return { kind: 'missing' };
  if (markers.length !== 1) {
    return {
      kind: 'invalid',
      reason: 'exactly one change-intent marker is required',
    };
  }

  const id = markers[0];
  if (id === 'replace-me' || !CHANGE_INTENT_ID.test(id) || id.length > 96) {
    return {
      kind: 'invalid',
      reason:
        'change-intent ID must be a 1-96 character lowercase kebab-case root-problem ID',
    };
  }
  return { kind: 'valid', id };
}

export function isTrustedAutomationPullRequest(pull) {
  const login = pull?.user?.login ?? '';
  return pull?.user?.type === 'Bot' && TRUSTED_AUTOMATION_LOGINS.has(login);
}

export function requiresChangeIntent(
  pull,
  enforcementStart = CHANGE_INTENT_ENFORCEMENT_START
) {
  if (isTrustedAutomationPullRequest(pull)) return false;
  const createdAt = Date.parse(pull?.created_at ?? '');
  const threshold = Date.parse(enforcementStart);
  if (!Number.isFinite(createdAt) || !Number.isFinite(threshold)) return true;
  return createdAt >= threshold;
}

export function findOpenIntentDuplicates({
  currentNumber,
  intentId,
  openPullRequests,
}) {
  return openPullRequests.filter((pull) => {
    if (pull.number === currentNumber) return false;
    const parsed = parseChangeIntent(pull.body ?? '');
    return parsed.kind === 'valid' && parsed.id === intentId;
  });
}

export function validatePullRequestChangeIntent({
  pull,
  openPullRequests,
  enforcementStart = CHANGE_INTENT_ENFORCEMENT_START,
}) {
  if (isTrustedAutomationPullRequest(pull)) {
    return { ok: true, status: 'trusted-automation-exempt' };
  }

  const parsed = parseChangeIntent(pull.body ?? '');
  const required = requiresChangeIntent(pull, enforcementStart);

  if (parsed.kind === 'missing') {
    return required
      ? {
          ok: false,
          status: 'missing',
          reason: 'Missing Engineering Change Admission marker.',
        }
      : { ok: true, status: 'legacy-unmarked' };
  }

  if (parsed.kind === 'invalid') {
    return { ok: false, status: 'invalid', reason: parsed.reason };
  }

  const duplicates = findOpenIntentDuplicates({
    currentNumber: pull.number,
    intentId: parsed.id,
    openPullRequests,
  });
  if (duplicates.length > 0) {
    return {
      ok: false,
      status: 'duplicate',
      intentId: parsed.id,
      duplicates,
      reason: `Change intent ${parsed.id} is already owned by open PR ${duplicates
        .map((item) => `#${item.number}`)
        .join(', ')}. Continue the existing PR instead of creating a superseding PR.`,
    };
  }

  return { ok: true, status: 'admitted', intentId: parsed.id };
}

function repositoryFromEnvironment() {
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const [owner, repo, extra] = repository.split('/');
  if (!owner || !repo || extra) {
    throw new Error('GITHUB_REPOSITORY must be owner/repo.');
  }
  return { owner, repo };
}

async function listOpenPullRequests() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN or GH_TOKEN is required for change-intent admission.'
    );
  }
  const { owner, repo } = repositoryFromEnvironment();
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const pulls = [];

  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (!response.ok) {
      throw new Error(
        `GitHub open-PR lookup failed: ${response.status} ${response.statusText}`
      );
    }
    const pageItems = await response.json();
    pulls.push(...pageItems);
    if (pageItems.length < 100) return pulls;
  }

  throw new Error('Open-PR lookup exceeded 10,000 entries; uniqueness is unproven.');
}

async function validateEvent() {
  if (!process.env.GITHUB_EVENT_PATH) {
    throw new Error('GITHUB_EVENT_PATH is required.');
  }
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')
  );
  if (!event.pull_request) {
    throw new Error(
      'Engineering Change Admission requires a pull_request event.'
    );
  }

  const openPullRequests = await listOpenPullRequests();
  const result = validatePullRequestChangeIntent({
    pull: event.pull_request,
    openPullRequests,
  });
  if (!result.ok) {
    console.error(`::error::${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Engineering Change Admission: ${result.status}${result.intentId ? ` (${result.intentId})` : ''}`
  );
}

async function preflight(intentId) {
  const parsed = parseChangeIntent(
    `<!-- vellira-change-intent:v1:${intentId} -->`
  );
  if (parsed.kind !== 'valid') {
    throw new Error(parsed.reason ?? 'Invalid change-intent ID.');
  }

  const openPullRequests = await listOpenPullRequests();
  const duplicates = findOpenIntentDuplicates({
    currentNumber: null,
    intentId: parsed.id,
    openPullRequests,
  });
  if (duplicates.length > 0) {
    const owners = duplicates
      .map((pull) => `#${pull.number} ${pull.html_url ?? ''}`.trim())
      .join(', ');
    console.error(
      `Change intent ${parsed.id} already has an open PR: ${owners}`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`No open PR owns change intent ${parsed.id}.`);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const [command, value] = process.argv.slice(2);
  try {
    if (command === 'event') await validateEvent();
    else if (command === 'preflight' && value) await preflight(value);
    else {
      throw new Error(
        'Usage: pr-change-intent.mjs event | preflight <intent-id>'
      );
    }
  } catch (error) {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}
