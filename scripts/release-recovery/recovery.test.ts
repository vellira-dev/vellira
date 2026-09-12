import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assessGithubRelease,
  assertNoCloudflareChanges,
  assertTaggedCheckout,
  assertTaggedSourceChanges,
  assertTagState,
  planPackageRecovery,
  validateInputs,
  verifyRegistryEvidence,
} = require('./recovery.cjs');
const {
  recovery: { publishPackages, verifyPackageCompleteness },
} = require('../semantic-release-packages.cjs');

const sha = '07670ecf1ad70222d02d98a06f474d5ab9f404bf';
const packages = [
  '@vellira-ui/core',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
  '@vellira-ui/icons',
  '@vellira-ui/react',
  '@vellira-ui/react-native',
];

function states(missing: string[] = []) {
  return Object.fromEntries(
    packages.map((name) => [
      name,
      missing.includes(name)
        ? { exists: false, verified: false }
        : { exists: true, verified: true },
    ])
  );
}

function release(overrides = {}) {
  return {
    id: 1,
    tag_name: 'v2.104.1',
    draft: false,
    prerelease: false,
    name: 'Vellira 2.104.1',
    body: 'notes',
    ...overrides,
  };
}

describe('release recovery decisions', () => {
  it('requires valid SemVer, an exact SHA, and explicit confirmation', () => {
    expect(() =>
      validateInputs({
        version: 'v2.104.1',
        expectedTagSha: sha,
        confirmation: 'RECOVER_EXISTING_RELEASE',
      })
    ).toThrow('valid SemVer');
    expect(() =>
      validateInputs({
        version: '2.104.1',
        expectedTagSha: 'short',
        confirmation: 'RECOVER_EXISTING_RELEASE',
      })
    ).toThrow('40-character Git SHA');
    expect(() =>
      validateInputs({
        version: '2.104.1',
        expectedTagSha: sha,
        confirmation: 'RECOVER',
      })
    ).toThrow('confirmation must equal RECOVER_EXISTING_RELEASE');
  });

  it('accepts an exact existing tag, complete packages, and exact release without mutation', () => {
    const input = validateInputs({
      version: '2.104.1',
      expectedTagSha: sha,
      confirmation: 'RECOVER_EXISTING_RELEASE',
    });
    assertTagState({
      tagExists: true,
      tagSha: sha,
      expectedTagSha: sha,
      reachableFromMain: true,
    });
    expect(planPackageRecovery(packages, states())).toEqual({
      publish: [],
      satisfied: packages,
    });
    expect(
      assessGithubRelease(release(), {
        tagName: input.tag,
        name: 'Vellira 2.104.1',
        body: 'notes',
      })
    ).toEqual({ action: 'none', releaseId: 1 });
  });

  it('selects only missing packages and never republishes existing versions', () => {
    expect(
      planPackageRecovery(
        packages,
        states(['@vellira-ui/icons', '@vellira-ui/react-native'])
      )
    ).toEqual({
      publish: ['@vellira-ui/icons', '@vellira-ui/react-native'],
      satisfied: [
        '@vellira-ui/core',
        '@vellira-ui/tokens',
        '@vellira-ui/types',
        '@vellira-ui/react',
      ],
    });
  });

  it('fails before mutation for a missing or mismatched tag', () => {
    expect(() =>
      assertTagState({
        tagExists: false,
        tagSha: undefined,
        expectedTagSha: sha,
        reachableFromMain: false,
      })
    ).toThrow('Release tag does not exist');
    expect(() =>
      assertTagState({
        tagExists: true,
        tagSha: 'a'.repeat(40),
        expectedTagSha: sha,
        reachableFromMain: true,
      })
    ).toThrow('Release tag SHA does not match');
  });

  it('fails on a conflicting release and accepts the exact release', () => {
    const expected = {
      tagName: 'v2.104.1',
      name: 'Vellira 2.104.1',
      body: 'notes',
    };
    expect(assessGithubRelease(release(), expected).action).toBe('none');
    expect(() =>
      assessGithubRelease(release({ body: 'different' }), expected)
    ).toThrow('Existing release notes conflict');
    expect(assessGithubRelease(null, expected)).toEqual({ action: 'create' });
  });

  it('stops when an existing package lacks verified integrity or provenance', () => {
    const invalid = states();
    invalid['@vellira-ui/icons'] = { exists: true, verified: false };
    expect(() => planPackageRecovery(packages, invalid)).toThrow(
      'integrity/provenance verification failed'
    );
  });

  it('locks package reconstruction to the tag rather than moving main', () => {
    expect(() =>
      assertTaggedCheckout({ checkoutSha: sha, expectedTagSha: sha })
    ).not.toThrow();
    expect(() =>
      assertTaggedCheckout({
        checkoutSha: 'b'.repeat(40),
        expectedTagSha: sha,
      })
    ).toThrow('exact tagged commit');
    expect(() =>
      assertTaggedSourceChanges([
        'package.json',
        'pnpm-lock.yaml',
        'packages/icons/package.json',
      ])
    ).not.toThrow();
    expect(() =>
      assertTaggedSourceChanges(['packages/icons/src/index.ts'])
    ).toThrow('unexpected change');
  });

  it('verifies attestation digest, trusted workflow, and source SHA', () => {
    const digest = Buffer.alloc(64, 7);
    const integrity = `sha512-${digest.toString('base64')}`;
    const statement = {
      predicateType: 'https://slsa.dev/provenance/v1',
      subject: [{ digest: { sha512: digest.toString('hex') } }],
      predicate: {
        buildDefinition: {
          externalParameters: {
            workflow: {
              repository: 'https://github.com/vellira-dev/vellira',
              path: '.github/workflows/release.yml',
            },
          },
          resolvedDependencies: [{ digest: { gitCommit: sha } }],
        },
      },
    };
    const attestation = {
      bundle: {
        dsseEnvelope: {
          payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
        },
      },
    };
    expect(
      verifyRegistryEvidence(
        {
          packageName: '@vellira-ui/icons',
          version: '2.104.1',
          dist: { integrity, tarball: 'https://registry.example/icons.tgz' },
          attestations: [attestation],
        },
        { allowedSourceShas: [sha] }
      ).sourceShas
    ).toEqual([sha]);
  });

  it('does not abandon the shared queue when one worker throws', async () => {
    const infos = packages.map((name) => ({ name, version: '2.104.1' }));
    const attempted: string[] = [];
    const publish = vi.fn(async (info: { name: string; version: string }) => {
      attempted.push(info.name);
      if (info.name === '@vellira-ui/core') throw new Error('worker failure');
      return { packageName: info.name, version: info.version };
    });
    const summaries = await publishPackages(infos, publish);
    expect(new Set(attempted)).toEqual(new Set(packages));
    expect(summaries).toHaveLength(6);
    expect(
      summaries.find(
        (item: { packageName: string }) =>
          item.packageName === '@vellira-ui/core'
      ).error
    ).toBeInstanceOf(Error);
  });

  it('permanently re-verifies the exact version for all six packages', async () => {
    const infos = packages.map((name) => ({ name, version: '2.104.1' }));
    const verify = vi.fn(
      async (info: { name: string; version: string }) => info
    );

    await expect(verifyPackageCompleteness(infos, verify)).resolves.toEqual(
      infos
    );
    expect(verify).toHaveBeenCalledTimes(6);
    expect(new Set(verify.mock.calls.map(([info]) => info.name))).toEqual(
      new Set(packages)
    );

    await expect(
      verifyPackageCompleteness(infos.slice(0, 5), verify)
    ).rejects.toThrow('exactly the six public packages');
    await expect(
      verifyPackageCompleteness(
        infos.map((info, index) => ({
          ...info,
          version: index === 5 ? '2.104.0' : info.version,
        })),
        verify
      )
    ).rejects.toThrow('one exact version');
  });

  it('fails the completeness gate if any package verification fails', async () => {
    const infos = packages.map((name) => ({ name, version: '2.104.1' }));
    const verify = vi.fn(async (info: { name: string }) => {
      if (info.name === '@vellira-ui/icons') {
        throw new Error('provenance missing');
      }
      return info;
    });

    await expect(verifyPackageCompleteness(infos, verify)).rejects.toThrow(
      'provenance missing'
    );
  });

  it('keeps the recovery scope outside Cloudflare deployment surfaces', () => {
    const changed = [
      '.github/workflows/release.yml',
      'scripts/semantic-release-packages.cjs',
      'scripts/release-recovery/recovery.cjs',
      'scripts/release-recovery/cli.cjs',
      'scripts/release-recovery/recovery.test.ts',
      'docs/architecture/release-recovery.md',
    ];
    expect(() => assertNoCloudflareChanges(changed)).not.toThrow();
    expect(() =>
      assertNoCloudflareChanges(['apps/website/wrangler.production.jsonc'])
    ).toThrow('must not affect Cloudflare');
  });

  it('workflow dispatch uses the trusted Release filename and tagged checkout', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('recover-existing-release:');
    expect(workflow).toContain('path: tagged-source');
    expect(workflow).toContain('ref: ${{ inputs.expected_tag_sha }}');
    expect(workflow).not.toMatch(/cloudflare|wrangler/i);

    const cli = readFileSync('scripts/release-recovery/cli.cjs', 'utf8');
    expect(cli).toContain("'--verify-tag'");
    expect(cli).not.toMatch(/git\s+(?:tag|push)|deleteRef|createRef/);
  });
});
