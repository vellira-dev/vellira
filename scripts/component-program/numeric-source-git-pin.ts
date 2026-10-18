import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { parseComponentProductionInput } from '../component-production/contracts';
import { captureComponentProgramInput } from './capture-input';
import {
  resolveNumericBindingReceiptsV1,
  type NumericBindingReceiptResolutionV1,
} from './numeric-binding-receipt-resolver';

const REPOSITORY = 'vellira-dev/vellira' as const;
const SOURCE_PATH =
  /^scripts\/component-production\/specs\/[A-Za-z][A-Za-z0-9_-]{0,95}\.json$/;
const SHA = /^[a-f0-9]{40}$/;
const MAX_SPEC_BYTES = 131072;

export type NumericSourceGitPinV1 = Readonly<{
  schemaVersion: '1';
  repository: typeof REPOSITORY;
  revision: string;
  sourcePath: string;
}>;

export type NumericSourceGitPinResultV1 =
  | Readonly<{
      ok: true;
      schemaVersion: '1';
      disposition: 'review-required';
      sourceContentMatched: true;
      sourceAuthenticated: false;
      ownerApproved: false;
      grammarAdmitted: false;
      repository: typeof REPOSITORY;
      revision: string;
      sourcePath: string;
      gitBlobSha1: string;
      sourceBytesSha256: string;
      resolution: Extract<NumericBindingReceiptResolutionV1, { ok: true }>;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'invalid-pin'
        | 'checkout-unavailable'
        | 'repository-mismatch'
        | 'revision-mismatch'
        | 'source-not-tracked'
        | 'invalid-source'
        | 'receipt-resolution-failed';
      path: '$';
    }>;

type FailureCode = Extract<NumericSourceGitPinResultV1, { ok: false }>['code'];

const rejected = (code: FailureCode): NumericSourceGitPinResultV1 =>
  Object.freeze({ ok: false, code, path: '$' });

/** A locator is only a claim; it cannot authenticate a checkout or a human. */
function sourcePin(input: unknown): NumericSourceGitPinV1 | null {
  try {
    const value = captureComponentProgramInput(input);
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Reflect.ownKeys(value).length !== 4 ||
      !['schemaVersion', 'repository', 'revision', 'sourcePath'].every((key) =>
        Object.hasOwn(value, key)
      )
    ) {
      return null;
    }
    const item = value as Record<string, unknown>;
    if (
      item.schemaVersion !== '1' ||
      item.repository !== REPOSITORY ||
      typeof item.revision !== 'string' ||
      !SHA.test(item.revision) ||
      typeof item.sourcePath !== 'string' ||
      !SOURCE_PATH.test(item.sourcePath)
    ) {
      return null;
    }
    return {
      schemaVersion: '1',
      repository: REPOSITORY,
      revision: item.revision,
      sourcePath: item.sourcePath,
    };
  } catch {
    return null;
  }
}

function git(root: string, args: readonly string[]): Buffer {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_')) delete environment[key];
  }
  environment.GIT_NO_REPLACE_OBJECTS = '1';
  environment.GIT_OPTIONAL_LOCKS = '0';
  return execFileSync('git', [...args], {
    cwd: root,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 8000,
    maxBuffer: MAX_SPEC_BYTES + 8192,
  });
}

const utf8 = (bytes: Buffer): string =>
  new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();

/**
 * Read-only SOURCE-CONTENT pin, not human approval or authenticated provenance.
 * The checkout must come from a separately trusted/protected source.
 * A caller-controlled Git repository can forge its remote and all Git objects.
 */
export function prepareNumericSourceGitPinV1(
  checkoutRoot: unknown,
  pinInput: unknown,
  evidenceInput: unknown
): NumericSourceGitPinResultV1 {
  const pin = sourcePin(pinInput);
  if (!pin) return rejected('invalid-pin');

  let root: string;
  try {
    if (
      typeof checkoutRoot !== 'string' ||
      checkoutRoot.length < 1 ||
      checkoutRoot.length > 4096
    ) {
      return rejected('checkout-unavailable');
    }
    root = realpathSync(checkoutRoot);
    if (
      realpathSync(utf8(git(root, ['rev-parse', '--show-toplevel']))) !== root
    ) {
      return rejected('checkout-unavailable');
    }
  } catch {
    return rejected('checkout-unavailable');
  }

  try {
    const remote = utf8(git(root, ['config', '--get', 'remote.origin.url']));
    if (
      remote !== 'https://github.com/vellira-dev/vellira.git' &&
      remote !== 'https://github.com/vellira-dev/vellira' &&
      remote !== 'git@github.com:vellira-dev/vellira.git'
    ) {
      return rejected('repository-mismatch');
    }
    if (utf8(git(root, ['rev-parse', 'HEAD'])) !== pin.revision) {
      return rejected('revision-mismatch');
    }
    if (utf8(git(root, ['cat-file', '-t', pin.revision])) !== 'commit') {
      return rejected('revision-mismatch');
    }
  } catch {
    return rejected('checkout-unavailable');
  }

  let content: Buffer;
  let gitBlobSha1: string;
  try {
    const line = utf8(
      git(root, ['ls-tree', pin.revision, '--', pin.sourcePath])
    );
    const match = line.match(/^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/);
    if (!match || match[2] !== pin.sourcePath) {
      return rejected('source-not-tracked');
    }
    gitBlobSha1 = match[1];
    content = git(root, ['cat-file', 'blob', gitBlobSha1]);
    if (content.length > MAX_SPEC_BYTES) return rejected('invalid-source');
    // No Git object replacement or stream substitution is allowed.
    const object = Buffer.concat([
      Buffer.from('blob ' + content.length + '\0', 'utf8'),
      content,
    ]);
    if (createHash('sha1').update(object).digest('hex') !== gitBlobSha1) {
      return rejected('invalid-source');
    }
  } catch {
    return rejected('source-not-tracked');
  }

  let production: ReturnType<typeof parseComponentProductionInput>;
  try {
    const bytes = new TextDecoder('utf-8', { fatal: true }).decode(content);
    production = parseComponentProductionInput(JSON.parse(bytes));
  } catch {
    return rejected('invalid-source');
  }
  // A valid Git blob must also belong to its canonical component identity.
  // Hash and receipt equality alone cannot prevent a cross-component path alias.
  if (
    pin.sourcePath !==
    `scripts/component-production/specs/${production.componentName}.json`
  ) {
    return rejected('invalid-source');
  }
  const resolution = resolveNumericBindingReceiptsV1(production, evidenceInput);
  if (!resolution.ok) return rejected('receipt-resolution-failed');

  // Protect against branch/ref changes during inspection. Object reads above
  // are by immutable identity; this only detects a moving checkout HEAD.
  try {
    if (utf8(git(root, ['rev-parse', 'HEAD'])) !== pin.revision) {
      return rejected('revision-mismatch');
    }
  } catch {
    return rejected('checkout-unavailable');
  }

  return Object.freeze({
    ok: true,
    schemaVersion: '1',
    disposition: 'review-required',
    sourceContentMatched: true,
    sourceAuthenticated: false,
    ownerApproved: false,
    grammarAdmitted: false,
    repository: REPOSITORY,
    revision: pin.revision,
    sourcePath: pin.sourcePath,
    gitBlobSha1,
    sourceBytesSha256: createHash('sha256').update(content).digest('hex'),
    resolution,
  });
}
