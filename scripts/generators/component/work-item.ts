import fs from 'node:fs';
import path from 'node:path';

export type GovernedGitHubWorkItem = {
  provider: 'github';
  repository: string;
  issue: `#${number}`;
};

const repositoryPattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const issuePattern = /^#[1-9][0-9]*$/;

function isCanonicalIssue(value: string): value is `#${number}` {
  return (
    issuePattern.test(value) &&
    Number.isSafeInteger(Number(value.slice(1))) &&
    Number(value.slice(1)) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseGovernedGitHubWorkItem(
  value: unknown,
  label = 'workItem'
): GovernedGitHubWorkItem {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = ['issue', 'provider', 'repository'];

  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(
      `${label} must contain exactly provider, repository, and issue.`
    );
  }

  if (value.provider !== 'github') {
    throw new Error(`${label}.provider must be "github".`);
  }

  if (
    typeof value.repository !== 'string' ||
    !repositoryPattern.test(value.repository)
  ) {
    throw new Error(
      `${label}.repository must be an exact GitHub owner/repository identity.`
    );
  }

  if (typeof value.issue !== 'string' || !isCanonicalIssue(value.issue)) {
    throw new Error(`${label}.issue must use canonical #<number> form.`);
  }

  return {
    provider: 'github',
    repository: value.repository,
    issue: value.issue,
  };
}

export function parseGovernedGitHubWorkItemUrl(
  value: string
): GovernedGitHubWorkItem {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      '--work-item must be an exact https://github.com/<owner>/<repository>/issues/<number> URL.'
    );
  }

  const match = url.pathname.match(
    /^\/([^/]+)\/([^/]+)\/issues\/([1-9][0-9]*)$/
  );

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !match
  ) {
    throw new Error(
      '--work-item must be an exact https://github.com/<owner>/<repository>/issues/<number> URL.'
    );
  }

  return parseGovernedGitHubWorkItem(
    {
      provider: 'github',
      repository: `${match[1]}/${match[2]}`,
      issue: `#${match[3]}`,
    },
    '--work-item'
  );
}

function repositoryFromPackageUrl(value: unknown): string | null {
  const repository =
    typeof value === 'string'
      ? value
      : isRecord(value) && typeof value.url === 'string'
        ? value.url
        : null;

  if (!repository) return null;

  const match = repository.match(
    /^(?:git\+https:\/\/github\.com\/|https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/
  );

  return match?.[1] ?? null;
}

export function readCanonicalTokenRepositoryIdentity(root: string): string {
  const packageFile = path.join(root, 'packages', 'tokens', 'package.json');

  if (!fs.existsSync(packageFile)) {
    throw new Error(
      `component-token-work-item-authority-missing: expected ${path.relative(root, packageFile)}`
    );
  }

  let packageValue: unknown;

  try {
    packageValue = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  } catch (error) {
    throw new Error(
      `component-token-work-item-authority-invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const repository = isRecord(packageValue)
    ? repositoryFromPackageUrl(packageValue.repository)
    : null;

  if (!repository || !repositoryPattern.test(repository)) {
    throw new Error(
      'component-token-work-item-authority-invalid: @vellira-ui/tokens must declare an exact GitHub repository identity.'
    );
  }

  return repository;
}

export function assertGovernedWorkItemMatchesRepository(params: {
  root: string;
  workItem: GovernedGitHubWorkItem;
}): void {
  const canonicalRepository = readCanonicalTokenRepositoryIdentity(params.root);

  if (params.workItem.repository !== canonicalRepository) {
    throw new Error(
      `component-token-work-item-repository-mismatch: expected ${canonicalRepository}, received ${params.workItem.repository}`
    );
  }
}
