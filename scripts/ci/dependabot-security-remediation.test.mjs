import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRegistryRemediationEvidence,
  buildRemediationPlan,
  buildRuntimeAuditIgnores,
  materializeDependabotAuditGaps,
  normalizeDependabotVulnerableRange,
  packageFromDependencySelector,
  reconcileGeneratedWorkspaceAuthority,
  stripMutableWorkspaceSections,
  validateAuditGapMaterializations,
  validateAuthorizedPackagesRemediated,
  validateCandidateBaseSyncChain,
  validatePlanAgainstRegistryEvidence,
  validateRemediationDiff,
} from './dependabot-security-remediation.mjs';

test('plan selects only open high/critical npm alerts', () => {
  const plan = buildRemediationPlan([
    {
      number: 1,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'fast-uri' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'high',
        ghsa_id: 'GHSA-2345-cfgh-jmpq',
      },
      security_vulnerability: {
        vulnerable_version_range: '<3.1.7',
        first_patched_version: { identifier: '3.1.7' },
      },
    },
    {
      number: 2,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'low-only' },
        scope: 'development',
      },
      security_advisory: { severity: 'low' },
      security_vulnerability: {
        first_patched_version: { identifier: '1.0.1' },
      },
    },
  ]);

  assert.equal(plan.relevantAlertCount, 1);
  assert.equal(plan.fixableAlertCount, 1);
  assert.deepEqual(plan.packages, ['fast-uri']);
  assert.deepEqual(plan.fixablePackages, ['fast-uri']);
});

test('plan excludes runtime alerts from the bounded fallback', () => {
  const plan = buildRemediationPlan([
    {
      number: 3,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'runtime-package' },
        scope: 'runtime',
      },
      security_advisory: {
        severity: 'critical',
        ghsa_id: 'GHSA-runtime-only',
      },
      security_vulnerability: {
        vulnerable_version_range: '<9.9.9',
        first_patched_version: { identifier: '9.9.9' },
      },
    },
  ]);

  assert.equal(plan.dependencyScope, 'development');
  assert.equal(plan.relevantAlertCount, 0);
  assert.equal(plan.fixableAlertCount, 0);
  assert.deepEqual(plan.packages, []);
  assert.deepEqual(plan.fixablePackages, []);
});

test('plan blocks a package when any open runtime alert shares that package', () => {
  const plan = buildRemediationPlan([
    {
      number: 7,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'shared-package' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'high',
        ghsa_id: 'GHSA-2345-cfgh-jmpq',
      },
      security_vulnerability: {
        vulnerable_version_range: '<2.0.0',
        first_patched_version: { identifier: '2.0.0' },
      },
    },
    {
      number: 8,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'shared-package' },
        scope: 'runtime',
      },
      security_advisory: {
        severity: 'moderate',
        ghsa_id: 'GHSA-5678-fghj-mpqr',
      },
      security_vulnerability: {
        vulnerable_version_range: '<1.5.0',
        first_patched_version: { identifier: '1.5.0' },
      },
    },
  ]);

  assert.equal(plan.relevantAlertCount, 1);
  assert.equal(plan.fixableAlertCount, 0);
  assert.equal(plan.blockedAlertCount, 1);
  assert.deepEqual(plan.fixablePackages, []);
  assert.deepEqual(plan.runtimeBlockedPackages, ['shared-package']);
  assert.equal(plan.alerts[0].blockedByRuntimeScope, true);
});

test('low audit level includes moderate and low alerts', () => {
  const plan = buildRemediationPlan(
    [
      {
        number: 5,
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'moderate-package' },
          scope: 'development',
        },
        security_advisory: { severity: 'moderate' },
        security_vulnerability: {
          first_patched_version: { identifier: '1.2.4' },
        },
      },
      {
        number: 6,
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'low-package' },
          scope: 'development',
        },
        security_advisory: { severity: 'low' },
        security_vulnerability: {
          first_patched_version: { identifier: '2.0.1' },
        },
      },
    ],
    'low'
  );

  assert.equal(plan.relevantAlertCount, 2);
  assert.deepEqual(plan.packages, ['low-package', 'moderate-package']);
  assert.deepEqual(plan.fixablePackages, ['low-package', 'moderate-package']);
});

test('plan reports advisories without patched versions', () => {
  const plan = buildRemediationPlan([
    {
      number: 4,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'blocked' },
        scope: 'development',
      },
      security_advisory: { severity: 'critical' },
      security_vulnerability: { first_patched_version: null },
    },
  ]);

  assert.equal(plan.fixableAlertCount, 0);
  assert.equal(plan.blockedAlertCount, 1);
  assert.deepEqual(plan.fixablePackages, []);
});

test('runtime audit ignores cover every advisory on runtime-overlap packages', () => {
  const ignores = buildRuntimeAuditIgnores(
    [
      {
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'brace-expansion' },
          scope: 'runtime',
        },
        security_advisory: {
          severity: 'high',
          ghsa_id: 'GHSA-qhr7-859c-m2p7',
        },
      },
      {
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'fast-uri' },
          scope: 'development',
        },
        security_advisory: {
          severity: 'high',
          ghsa_id: 'GHSA-qw65-cvwx-89v3',
        },
      },
      {
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'shared' },
          scope: 'runtime',
        },
        security_advisory: {
          severity: 'high',
          ghsa_id: 'GHSA-2345-cfgh-jmpq',
        },
      },
      {
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'shared' },
          scope: 'development',
        },
        security_advisory: {
          severity: 'high',
          ghsa_id: 'GHSA-2345-cfgh-jmpq',
        },
      },
      {
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'runtime-medium' },
          scope: 'runtime',
        },
        security_advisory: {
          severity: 'moderate',
          ghsa_id: 'GHSA-5678-fghj-mpqr',
        },
      },
    ],
    'high'
  );

  assert.deepEqual(ignores.runtimePackages, [
    'brace-expansion',
    'runtime-medium',
    'shared',
  ]);
  assert.deepEqual(ignores.ignoredGhsas, [
    'GHSA-2345-cfgh-jmpq',
    'GHSA-5678-fghj-mpqr',
    'GHSA-qhr7-859c-m2p7',
  ]);
});

test('registry evidence captures all advisories at the requested severity floor', () => {
  const evidence = buildRegistryRemediationEvidence(
    {
      advisories: {
        1: {
          severity: 'high',
          module_name: 'fast-uri',
          patched_versions: '>=3.1.7',
          github_advisory_id: 'GHSA-qw65-cvwx-89v3',
        },
        2: {
          severity: 'high',
          module_name: 'brace-expansion',
          patched_versions: '>=1.1.20',
          github_advisory_id: 'GHSA-qhr7-859c-m2p7',
        },
        3: {
          severity: 'moderate',
          module_name: 'moderate-only',
          patched_versions: '>=2.0.0',
          github_advisory_id: 'GHSA-5678-fghj-mpqr',
        },
        4: {
          severity: 'high',
          module_name: 'unfixable-high',
          patched_versions: null,
          github_advisory_id: 'GHSA-2345-cfgh-jmpq',
        },
      },
    },
    'high'
  );

  assert.deepEqual(evidence.packages, [
    'brace-expansion',
    'fast-uri',
    'unfixable-high',
  ]);
  assert.deepEqual(evidence.advisories, [
    {
      ghsaId: 'GHSA-2345-cfgh-jmpq',
      package: 'unfixable-high',
      severity: 'high',
    },
    {
      ghsaId: 'GHSA-qhr7-859c-m2p7',
      package: 'brace-expansion',
      severity: 'high',
    },
    {
      ghsaId: 'GHSA-qw65-cvwx-89v3',
      package: 'fast-uri',
      severity: 'high',
    },
  ]);
  assert.equal('dependencyScope' in evidence, false);
});

test('registry evidence records Dependabot advisory gaps without revoking authority', () => {
  const plan = buildRemediationPlan([
    {
      number: 10,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'fast-uri' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'high',
        ghsa_id: 'GHSA-qw65-cvwx-89v3',
      },
      security_vulnerability: {
        vulnerable_version_range: '<3.1.7',
        first_patched_version: { identifier: '3.1.7' },
      },
    },
  ]);
  const wrongAdvisoryEvidence = {
    schemaVersion: 1,
    auditLevel: 'high',
    packages: ['fast-uri'],
    advisories: [
      {
        ghsaId: 'GHSA-2345-cfgh-jmpq',
        package: 'fast-uri',
        severity: 'high',
      },
    ],
  };

  const comparison = validatePlanAgainstRegistryEvidence(
    plan,
    wrongAdvisoryEvidence
  );

  assert.deepEqual(comparison.matchedPackages, ['fast-uri']);
  assert.deepEqual(comparison.missingPackages, []);
  assert.equal(comparison.missingAdvisories.length, 1);
  assert.deepEqual(comparison.missingAdvisories[0], {
    number: 10,
    ghsaId: 'GHSA-qw65-cvwx-89v3',
    package: 'fast-uri',
    severity: 'high',
    vulnerableVersionRange: '<3.1.7',
    firstPatchedVersion: '3.1.7',
  });
});

test('candidate base sync accepts the exact direct candidate', () => {
  const base = '1'.repeat(40);
  const head = '2'.repeat(40);

  assert.deepEqual(
    validateCandidateBaseSyncChain({
      candidateBaseSha: base,
      candidateHeadSha: head,
      currentBaseSha: base,
      currentHeadSha: head,
      mergeCommits: [],
    }),
    {
      mode: 'direct',
      mergeCount: 0,
      candidateBaseSha: base,
      candidateHeadSha: head,
      currentBaseSha: base,
      currentHeadSha: head,
    }
  );
});

test('candidate base sync accepts bounded first-parent main merges', () => {
  const candidateBaseSha = '1'.repeat(40);
  const candidateHeadSha = '2'.repeat(40);
  const intermediateBaseSha = '3'.repeat(40);
  const firstMergeSha = '4'.repeat(40);
  const currentBaseSha = '5'.repeat(40);
  const currentHeadSha = '6'.repeat(40);

  assert.deepEqual(
    validateCandidateBaseSyncChain({
      candidateBaseSha,
      candidateHeadSha,
      currentBaseSha,
      currentHeadSha,
      mergeCommits: [
        {
          sha: firstMergeSha,
          firstParent: candidateHeadSha,
          secondParent: intermediateBaseSha,
        },
        {
          sha: currentHeadSha,
          firstParent: firstMergeSha,
          secondParent: currentBaseSha,
        },
      ],
    }),
    {
      mode: 'base-sync',
      mergeCount: 2,
      candidateBaseSha,
      candidateHeadSha,
      currentBaseSha,
      currentHeadSha,
    }
  );
});

test('candidate base sync rejects non-candidate first-parent history', () => {
  assert.throws(
    () =>
      validateCandidateBaseSyncChain({
        candidateBaseSha: '1'.repeat(40),
        candidateHeadSha: '2'.repeat(40),
        currentBaseSha: '5'.repeat(40),
        currentHeadSha: '6'.repeat(40),
        mergeCommits: [
          {
            sha: '6'.repeat(40),
            firstParent: '7'.repeat(40),
            secondParent: '5'.repeat(40),
          },
        ],
      }),
    /first-parent chain is invalid/
  );
});

test('candidate base sync rejects a stale latest base merge', () => {
  assert.throws(
    () =>
      validateCandidateBaseSyncChain({
        candidateBaseSha: '1'.repeat(40),
        candidateHeadSha: '2'.repeat(40),
        currentBaseSha: '5'.repeat(40),
        currentHeadSha: '6'.repeat(40),
        mergeCommits: [
          {
            sha: '6'.repeat(40),
            firstParent: '2'.repeat(40),
            secondParent: '3'.repeat(40),
          },
        ],
      }),
    /does not use the current PR base/
  );
});

test('dependency selector parsing handles parent and scoped selectors', () => {
  assert.equal(
    packageFromDependencySelector('minimatch@10>brace-expansion@<2.0.0'),
    'brace-expansion'
  );
  assert.equal(
    packageFromDependencySelector('@xmldom/xmldom@0.8.14'),
    '@xmldom/xmldom'
  );
  assert.equal(
    packageFromDependencySelector('fast-uri@>=3.0.0 <3.1.7'),
    'fast-uri'
  );
  assert.equal(packageFromDependencySelector('undici@>=7 <8'), 'undici');
  assert.equal(packageFromDependencySelector('fast-uri@3.1.7'), 'fast-uri');
});

test('audit-gap materialization adds exact Dependabot fallback overrides', () => {
  const plan = buildRemediationPlan([
    {
      number: 115,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'handlebars' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'critical',
        ghsa_id: 'GHSA-2345-cfgh-jmpq',
      },
      security_vulnerability: {
        vulnerable_version_range: '>= 4.0.0, <= 4.7.9',
        first_patched_version: { identifier: '4.7.10' },
      },
    },
    {
      number: 116,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'handlebars' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'critical',
        ghsa_id: 'GHSA-5678-fghj-mpqr',
      },
      security_vulnerability: {
        vulnerable_version_range: '>= 4.0.0, <= 4.7.9',
        first_patched_version: { identifier: '4.7.10' },
      },
    },
  ]);
  const comparison = validatePlanAgainstRegistryEvidence(plan, {
    schemaVersion: 1,
    auditLevel: 'high',
    packages: [],
    advisories: [],
  });
  const workspace = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.8
`;

  const result = materializeDependabotAuditGaps({
    workspaceSource: workspace,
    plan,
    comparison,
  });

  assert.equal(
    normalizeDependabotVulnerableRange('>= 4.0.0, <= 4.7.9'),
    '>=4.0.0 <=4.7.9'
  );
  assert.match(result.workspaceSource, /handlebars@>=4\.0\.0 <=4\.7\.9/);
  assert.match(result.workspaceSource, /'4\.7\.10'/);
  assert.match(result.workspaceSource, /handlebars@4\.7\.10/);
  assert.deepEqual(result.evidence.packages, ['handlebars']);
  assert.equal(result.evidence.materializations.length, 1);
  assert.equal(
    result.evidence.materializations[0].vulnerableVersionRange,
    '>= 4.0.0, <= 4.7.9'
  );
  assert.equal(
    result.evidence.materializations[0].selector,
    'handlebars@>=4.0.0 <=4.7.9'
  );
  assert.deepEqual(result.evidence.materializations[0].alertNumbers, [115, 116]);
  assert.deepEqual(result.evidence.materializations[0].ghsaIds, [
    'GHSA-2345-cfgh-jmpq',
    'GHSA-5678-fghj-mpqr',
  ]);
  assert.equal(result.evidence.materializations[0].overrideAdded, true);
  assert.equal(result.evidence.materializations[0].releaseAgeAdded, true);
  assert.deepEqual(
    validateAuditGapMaterializations(
      result.workspaceSource,
      result.evidence
    ),
    {
      schemaVersion: 1,
      packages: ['handlebars'],
      materializationCount: 1,
    }
  );
});

test('audit-gap materialization fails closed on conflicting existing override', () => {
  const plan = buildRemediationPlan([
    {
      number: 115,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'handlebars' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'critical',
        ghsa_id: 'GHSA-2345-cfgh-jmpq',
      },
      security_vulnerability: {
        vulnerable_version_range: '>= 4.0.0, <= 4.7.9',
        first_patched_version: { identifier: '4.7.10' },
      },
    },
  ]);
  const comparison = validatePlanAgainstRegistryEvidence(plan, {
    schemaVersion: 1,
    auditLevel: 'high',
    packages: [],
    advisories: [],
  });

  assert.throws(
    () =>
      materializeDependabotAuditGaps({
        workspaceSource: `nodeLinker: hoisted
overrides:
  'handlebars@>=4.0.0 <=4.7.9': '4.7.9'
`,
        plan,
        comparison,
      }),
    /conflicts with existing override/
  );
});

test('generated override reconciliation prunes registry-only mutations', () => {
  const before = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.6
`;
  const after = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
  - braces@3.0.4
  - fast-uri@3.1.7
  - sprintf-js@1.1.4
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.6
  'braces@<=3.0.3': ^3.0.4
  'fast-uri@<3.1.7': ^3.1.7
  'sprintf-js@<=1.1.3': ^1.1.4
`;

  const result = reconcileGeneratedWorkspaceAuthority({
    workspaceBefore: before,
    workspaceAfter: after,
    authorizedPackages: ['fast-uri'],
  });

  assert.match(result.workspaceSource, /fast-uri@3\.1\.7/);
  assert.match(result.workspaceSource, /fast-uri@<3\.1\.7/);
  assert.doesNotMatch(result.workspaceSource, /braces@/);
  assert.doesNotMatch(result.workspaceSource, /sprintf-js@/);
  assert.deepEqual(result.evidence.retainedPackages, ['fast-uri']);
  assert.deepEqual(result.evidence.prunedPackages, ['braces', 'sprintf-js']);

  const validation = validateRemediationDiff({
    changedFiles: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
    workspaceBefore: before,
    workspaceAfter: result.workspaceSource,
    authorizedPackages: ['fast-uri'],
  });
  assert.deepEqual(validation.changedPackages, ['fast-uri']);
});

test('post-remediation audit ignores registry-only packages outside authority', () => {
  const result = validateAuthorizedPackagesRemediated(
    {
      advisories: {
        1: {
          severity: 'high',
          module_name: 'braces',
          github_advisory_id: 'GHSA-2345-cfgh-jmpq',
        },
      },
    },
    ['fast-uri'],
    'high'
  );

  assert.deepEqual(result.remainingAdvisories, []);
});

test('post-remediation audit fails when an authorized package remains vulnerable', () => {
  assert.throws(
    () =>
      validateAuthorizedPackagesRemediated(
        {
          advisories: {
            1: {
              severity: 'high',
              module_name: 'fast-uri',
              github_advisory_id: 'GHSA-qw65-cvwx-89v3',
            },
          },
        },
        ['fast-uri'],
        'high'
      ),
    /Authorized remediation package\(s\) still have registry advisories/
  );
});

test('post-remediation audit fails on authorized package without GHSA metadata', () => {
  assert.throws(
    () =>
      validateAuthorizedPackagesRemediated(
        {
          advisories: {
            1: {
              severity: 'high',
              module_name: 'fast-uri',
              github_advisory_id: null,
            },
          },
        },
        ['fast-uri'],
        'high'
      ),
    /Authorized remediation package\(s\) still have registry advisories/
  );
});

test('diff guard permits audited security mutations and semantic YAML reformatting', () => {
  const before = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.6

patchedDependencies:
  next@1: patches/next.patch
`;
  const after = `nodeLinker: hoisted
packages:
  - "packages/*"

minimumReleaseAgeExclude:
  - old@1.0.0
  - fast-uri@3.1.7

overrides:
  fast-uri: 3.1.6
  'fast-uri@>=3.0.0 <3.1.7': ^3.1.7

patchedDependencies:
  next@1: patches/next.patch
`;

  const result = validateRemediationDiff({
    changedFiles: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'],
    workspaceBefore: before,
    workspaceAfter: after,
    authorizedPackages: ['fast-uri'],
  });

  assert.deepEqual(result.changedFiles, [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ]);
  assert.deepEqual(result.changedPackages, ['fast-uri']);
  assert.equal(
    stripMutableWorkspaceSections(before),
    stripMutableWorkspaceSections(after)
  );
});

test('diff guard permits every package explicitly present in caller authority', () => {
  const before = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
`;
  const after = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
  'brace-expansion@<1.1.20': ^1.1.20
`;

  const result = validateRemediationDiff({
    changedFiles: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'],
    workspaceBefore: before,
    workspaceAfter: after,
    authorizedPackages: ['brace-expansion', 'fast-uri'],
  });

  assert.deepEqual(result.changedPackages, ['brace-expansion']);
});

test('diff guard rejects package mutations outside dependabot plan authority', () => {
  const before = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
`;
  const after = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
  unrelated-package: 9.9.9
`;

  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml'],
        workspaceBefore: before,
        workspaceAfter: after,
        authorizedPackages: ['fast-uri'],
      }),
    /outside Dependabot plan authority/
  );
});

test('diff guard rejects removal of existing security authority entries', () => {
  const before = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
  undici: 7.29.0
`;
  const after = `nodeLinker: hoisted
overrides:
  fast-uri: 3.1.6
`;

  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml'],
        workspaceBefore: before,
        workspaceAfter: after,
        authorizedPackages: ['undici'],
      }),
    /removed existing overrides/
  );
});

test('diff guard rejects lockfile-only mutations without an explicit override', () => {
  const source = "nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n";

  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-lock.yaml'],
        workspaceBefore: source,
        workspaceAfter: source,
      }),
    /must include a bounded pnpm-workspace.yaml override mutation/
  );
});

test('diff guard rejects unexpected untracked files', () => {
  const before = "nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n";
  const after =
    "nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n  'fast-uri@<3.1.7': ^3.1.7\n";

  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'],
        untrackedFiles: [
          '.security-remediation/plan.json',
          'unexpected-security-output.txt',
        ],
        workspaceBefore: before,
        workspaceAfter: after,
        authorizedPackages: ['fast-uri'],
      }),
    /forbidden untracked paths/
  );
});

test('diff guard rejects forbidden paths', () => {
  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['package.json', 'pnpm-workspace.yaml'],
        workspaceBefore: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n',
        workspaceAfter: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n',
        authorizedPackages: ['fast-uri'],
      }),
    /forbidden paths/
  );
});

test('diff guard rejects non-security workspace changes', () => {
  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml'],
        workspaceBefore: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n',
        workspaceAfter: 'nodeLinker: isolated\noverrides:\n  fast-uri: 3.1.7\n',
        authorizedPackages: ['fast-uri'],
      }),
    /outside overrides\/minimumReleaseAgeExclude/
  );
});

test('workspace mutation requires explicit package authority', () => {
  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml'],
        workspaceBefore: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n',
        workspaceAfter: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n',
      }),
    /requires explicit package authority/
  );
});
