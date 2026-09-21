import { CanonicalGapError } from './types';

export function parseTrustedGitHubRepository(repository: string): {
  owner: string;
  repo: string;
} {
  const [owner, repo, ...rest] = repository.split('/');
  if (
    !owner ||
    !repo ||
    rest.length > 0 ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
    repo === '.' ||
    repo === '..'
  ) {
    throw new CanonicalGapError(
      `Expected repository in owner/name form, received "${repository}".`
    );
  }
  return { owner, repo };
}
