import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ALLOWED_REMEDIATION_PATHS = Object.freeze([
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

const MUTABLE_WORKSPACE_SECTIONS = new Set([
  'minimumReleaseAgeExclude',
  'overrides',
]);

const LIST_WORKSPACE_SECTIONS = new Set([
  'packages',
  'minimumReleaseAgeExclude',
]);

const MAP_WORKSPACE_SECTIONS = new Set([
  'allowBuilds',
  'overrides',
  'patchedDependencies',
]);

const SCALAR_WORKSPACE_SECTIONS = new Set([
  'allowUnusedPatches',
  'nodeLinker',
]);

const SEVERITY_RANK = Object.freeze({
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
});

export const AUTOMATED_DEPENDENCY_SCOPE = 'development';

function topLevelKey(line) {
  const match = /^([A-Za-z0-9_-]+):(?:\s|$)/.exec(line);
  return match?.[1] ?? null;
}

function normalizeScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    const quote = trimmed[0];
    const body = trimmed.slice(1, -1);
    return quote === "'" ? body.replace(/''/g, "'") : body;
  }
  return trimmed;
}

function splitWorkspaceSections(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let prefix = [];
  let current = null;

  for (const line of lines) {
    const key = topLevelKey(line);
    if (key !== null) {
      if (current !== null) {
        sections.push(current);
      }
      current = { key, lines: [line] };
      continue;
    }

    if (current === null) {
      prefix.push(line);
    } else {
      current.lines.push(line);
    }
  }

  if (current !== null) {
    sections.push(current);
  }

  const seen = new Set();
  for (const section of sections) {
    if (seen.has(section.key)) {
      throw new Error(
        `Duplicate top-level pnpm-workspace.yaml key: ${section.key}`
      );
    }
    seen.add(section.key);
  }

  return { prefix, sections };
}

function meaningfulSectionLines(section) {
  return section.lines
    .slice(1)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
}

function parseListSection(section) {
  if (section === undefined) {
    return [];
  }

  return meaningfulSectionLines(section).map((line) => {
    const match = /^ {2}-\s+(.+)$/.exec(line);
    if (!match) {
      throw new Error(
        `Unsupported list syntax in pnpm-workspace.yaml section ${section.key}: ${line}`
      );
    }
    return normalizeScalar(match[1]);
  });
}

function parseMapSection(section) {
  if (section === undefined) {
    return {};
  }

  const result = {};
  for (const line of meaningfulSectionLines(section)) {
    const match = /^ {2}(\S.*?):\s*(.*?)\s*$/.exec(line);
    if (!match) {
      throw new Error(
        `Unsupported mapping syntax in pnpm-workspace.yaml section ${section.key}: ${line}`
      );
    }
    const key = normalizeScalar(match[1]);
    if (Object.hasOwn(result, key)) {
      throw new Error(
        `Duplicate pnpm-workspace.yaml entry in ${section.key}: ${key}`
      );
    }
    result[key] = normalizeScalar(match[2]);
  }

  return result;
}

function parseScalarSection(section) {
  if (section === undefined) {
    return null;
  }

  const firstLine = section.lines[0];
  const separator = firstLine.indexOf(':');
  const inline = firstLine.slice(separator + 1).trim();
  const children = meaningfulSectionLines(section);
  if (children.length > 0) {
    throw new Error(
      `Unsupported nested scalar syntax in pnpm-workspace.yaml section ${section.key}`
    );
  }
  return normalizeScalar(inline);
}

function parseGenericSection(section) {
  return section.lines
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    })
    .map((line) => line.replace(/^\s+/, (indent) => ' '.repeat(indent.length)))
    .join('\n');
}

function parseWorkspace(source) {
  const { prefix, sections } = splitWorkspaceSections(source);
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const parsed = {
    prefix: prefix
      .map((line) => line.trimEnd())
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
      }),
    sections: {},
  };

  for (const section of sections) {
    if (LIST_WORKSPACE_SECTIONS.has(section.key)) {
      parsed.sections[section.key] = parseListSection(section);
    } else if (MAP_WORKSPACE_SECTIONS.has(section.key)) {
      parsed.sections[section.key] = parseMapSection(section);
    } else if (SCALAR_WORKSPACE_SECTIONS.has(section.key)) {
      parsed.sections[section.key] = parseScalarSection(section);
    } else {
      parsed.sections[section.key] = parseGenericSection(section);
    }
  }

  return { parsed, byKey };
}

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableObject(entry)])
    );
  }
  return value;
}

function immutableWorkspaceView(source) {
  const { parsed } = parseWorkspace(source);
  return stableObject({
    prefix: parsed.prefix,
    sections: Object.fromEntries(
      Object.entries(parsed.sections).filter(
        ([key]) => !MUTABLE_WORKSPACE_SECTIONS.has(key)
      )
    ),
  });
}

export function stripMutableWorkspaceSections(source) {
  return JSON.stringify(immutableWorkspaceView(source));
}

export function packageFromDependencySelector(selector) {
  let target = normalizeScalar(selector);
  for (let index = target.length - 2; index > 0; index -= 1) {
    if (target[index] !== '>') {
      continue;
    }
    const previous = target[index - 1];
    const next = target[index + 1];
    if (
      /[A-Za-z0-9._-]/.test(previous) &&
      /[@A-Za-z0-9]/.test(next)
    ) {
      target = target.slice(index + 1).trim();
      break;
    }
  }

  if (target.startsWith('@')) {
    const slashIndex = target.indexOf('/');
    if (slashIndex <= 1) {
      throw new Error(`Invalid scoped dependency selector: ${selector}`);
    }
    const versionIndex = target.indexOf('@', slashIndex + 1);
    return versionIndex >= 0 ? target.slice(0, versionIndex) : target;
  }

  const versionIndex = target.indexOf('@');
  return versionIndex >= 0 ? target.slice(0, versionIndex) : target;
}

function parseSeverity(value) {
  const severity = typeof value === 'string' ? value.toLowerCase() : '';
  if (!(severity in SEVERITY_RANK)) {
    return null;
  }
  return severity;
}

export function buildRegistryRemediationEvidence(
  auditReport,
  auditLevel = 'high'
) {
  if (!(auditLevel in SEVERITY_RANK)) {
    throw new Error(`Unsupported audit level: ${auditLevel}`);
  }
  if (
    auditReport === null ||
    typeof auditReport !== 'object' ||
    Array.isArray(auditReport) ||
    auditReport.advisories === null ||
    typeof auditReport.advisories !== 'object' ||
    Array.isArray(auditReport.advisories)
  ) {
    throw new Error('pnpm audit payload must contain an advisories object');
  }

  const packages = new Set();
  const advisories = [];
  for (const advisory of Object.values(auditReport.advisories)) {
    const severity = parseSeverity(advisory?.severity);
    const packageName = advisory?.module_name;
    const ghsaId = advisory?.github_advisory_id;
    if (
      severity !== null &&
      SEVERITY_RANK[severity] >= SEVERITY_RANK[auditLevel] &&
      typeof packageName === 'string' &&
      packageName.length > 0
    ) {
      packages.add(packageName);
      if (
        typeof ghsaId === 'string' &&
        /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/i.test(
          ghsaId
        )
      ) {
        advisories.push({
          ghsaId,
          package: packageName,
          severity,
        });
      }
    }
  }

  advisories.sort((a, b) => {
    const byGhsa = a.ghsaId.localeCompare(b.ghsaId);
    return byGhsa !== 0 ? byGhsa : a.package.localeCompare(b.package);
  });

  return {
    schemaVersion: 1,
    auditLevel,
    packages: [...packages].sort(),
    advisories,
  };
}

export function validatePlanAgainstRegistryEvidence(plan, registryEvidence) {
  if (
    plan === null ||
    typeof plan !== 'object' ||
    Array.isArray(plan) ||
    registryEvidence === null ||
    typeof registryEvidence !== 'object' ||
    Array.isArray(registryEvidence) ||
    plan.schemaVersion !== 1 ||
    registryEvidence.schemaVersion !== 1 ||
    plan.auditLevel !== registryEvidence.auditLevel ||
    plan.dependencyScope !== AUTOMATED_DEPENDENCY_SCOPE ||
    !Array.isArray(plan.packages) ||
    !Array.isArray(plan.fixablePackages) ||
    !Array.isArray(plan.alerts) ||
    !Array.isArray(registryEvidence.packages)
  ) {
    throw new Error('Dependabot remediation plan is malformed or mismatched');
  }

  const confirmedPackages = new Set(registryEvidence.packages);
  const missing = plan.fixablePackages.filter(
    (packageName) => !confirmedPackages.has(packageName)
  );
  if (missing.length > 0) {
    throw new Error(
      `Dependabot remediation package(s) are absent from the registry audit evidence: ${missing.join(', ')}`
    );
  }

  if (!Array.isArray(registryEvidence.advisories)) {
    throw new Error('Registry audit advisory evidence is malformed');
  }
  const auditAdvisories = new Set(
    registryEvidence.advisories.map(
      (advisory) => `${advisory.ghsaId}\0${advisory.package}`
    )
  );
  const missingAdvisories = plan.alerts
    .filter(
      (alert) =>
        alert?.blockedByRuntimeScope !== true &&
        typeof alert?.firstPatchedVersion === 'string' &&
        alert.firstPatchedVersion.length > 0
    )
    .filter(
      (alert) =>
        !auditAdvisories.has(`${alert.ghsaId}\0${alert.package}`)
    )
    .map((alert) => `${alert.ghsaId ?? '?'}:${alert.package ?? '?'}`)
    .sort();
  if (missingAdvisories.length > 0) {
    throw new Error(
      `Dependabot remediation advisory evidence is absent from the registry audit: ${missingAdvisories.join(', ')}`
    );
  }
}

function workspaceMutationSummary(workspaceBefore, workspaceAfter) {
  const before = parseWorkspace(workspaceBefore).parsed.sections;
  const after = parseWorkspace(workspaceAfter).parsed.sections;
  const changedPackages = new Set();

  const beforeOverrides = before.overrides ?? {};
  const afterOverrides = after.overrides ?? {};
  const removedOverrides = Object.keys(beforeOverrides).filter(
    (key) => !Object.hasOwn(afterOverrides, key)
  );
  if (removedOverrides.length > 0) {
    throw new Error(
      `Security remediation removed existing overrides: ${removedOverrides.join(', ')}`
    );
  }

  const overrideMutations = [];
  for (const [key, value] of Object.entries(afterOverrides)) {
    if (!Object.hasOwn(beforeOverrides, key) || beforeOverrides[key] !== value) {
      const packageName = packageFromDependencySelector(key);
      changedPackages.add(packageName);
      overrideMutations.push({ key, value, packageName });
    }
  }

  const beforeReleaseAge = new Set(before.minimumReleaseAgeExclude ?? []);
  const afterReleaseAge = new Set(after.minimumReleaseAgeExclude ?? []);
  const removedReleaseAge = [...beforeReleaseAge].filter(
    (entry) => !afterReleaseAge.has(entry)
  );
  if (removedReleaseAge.length > 0) {
    throw new Error(
      `Security remediation removed existing minimumReleaseAgeExclude entries: ${removedReleaseAge.join(', ')}`
    );
  }

  const releaseAgeMutations = [...afterReleaseAge]
    .filter((entry) => !beforeReleaseAge.has(entry))
    .map((entry) => {
      const packageName = packageFromDependencySelector(entry);
      changedPackages.add(packageName);
      return { entry, packageName };
    });

  return {
    overrideMutations,
    releaseAgeMutations,
    changedPackages: [...changedPackages].sort(),
  };
}


function rawMapSectionEntries(section) {
  const entries = new Map();
  if (section === undefined) {
    return entries;
  }

  section.lines.slice(1).forEach((line, offset) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return;
    }
    const match = /^ {2}(\S.*?):\s*(.*?)\s*$/.exec(line.trimEnd());
    if (!match) {
      throw new Error(
        `Unsupported mapping syntax in pnpm-workspace.yaml section ${section.key}: ${line}`
      );
    }
    const key = normalizeScalar(match[1]);
    if (entries.has(key)) {
      throw new Error(
        `Duplicate pnpm-workspace.yaml entry in ${section.key}: ${key}`
      );
    }
    entries.set(key, {
      key,
      value: normalizeScalar(match[2]),
      line: line.trimEnd(),
      index: offset + 1,
    });
  });

  return entries;
}

function rawListSectionEntries(section) {
  const entries = new Map();
  if (section === undefined) {
    return entries;
  }

  section.lines.slice(1).forEach((line, offset) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return;
    }
    const match = /^ {2}-\s+(.+)$/.exec(line.trimEnd());
    if (!match) {
      throw new Error(
        `Unsupported list syntax in pnpm-workspace.yaml section ${section.key}: ${line}`
      );
    }
    const value = normalizeScalar(match[1]);
    if (entries.has(value)) {
      throw new Error(
        `Duplicate pnpm-workspace.yaml entry in ${section.key}: ${value}`
      );
    }
    entries.set(value, {
      value,
      line: line.trimEnd(),
      index: offset + 1,
    });
  });

  return entries;
}

function appendBeforeTrailingBlankLines(lines, line) {
  let index = lines.length;
  while (index > 1 && lines[index - 1].trim().length === 0) {
    index -= 1;
  }
  lines.splice(index, 0, line);
}

export function reconcileGeneratedWorkspaceAuthority({
  workspaceBefore,
  workspaceAfter,
  authorizedPackages = [],
}) {
  if (
    JSON.stringify(immutableWorkspaceView(workspaceBefore)) !==
    JSON.stringify(immutableWorkspaceView(workspaceAfter))
  ) {
    throw new Error(
      'Generated security fix changed pnpm-workspace.yaml outside overrides/minimumReleaseAgeExclude'
    );
  }

  const authorized = new Set(authorizedPackages);
  if (authorized.size === 0) {
    throw new Error(
      'Generated security fix reconciliation requires explicit package authority'
    );
  }

  const beforeSplit = splitWorkspaceSections(workspaceBefore);
  const afterSplit = splitWorkspaceSections(workspaceAfter);
  const beforeByKey = new Map(
    beforeSplit.sections.map((section) => [section.key, section])
  );
  const afterByKey = new Map(
    afterSplit.sections.map((section) => [section.key, section])
  );
  const retainedMutations = [];
  const prunedMutations = [];

  const sanitizeMapSection = (key) => {
    const beforeSection = beforeByKey.get(key);
    const afterSection = afterByKey.get(key);
    if (beforeSection === undefined && afterSection === undefined) {
      return null;
    }

    const beforeEntries = rawMapSectionEntries(beforeSection);
    const afterEntries = rawMapSectionEntries(afterSection);
    const lines =
      beforeSection !== undefined
        ? [...beforeSection.lines]
        : [afterSection.lines[0]];

    for (const [selector, current] of afterEntries) {
      const previous = beforeEntries.get(selector);
      if (previous !== undefined && previous.value === current.value) {
        continue;
      }

      const packageName = packageFromDependencySelector(selector);
      const mutation = {
        section: key,
        selector,
        packageName,
        previousValue: previous?.value ?? null,
        generatedValue: current.value,
      };

      if (!authorized.has(packageName)) {
        prunedMutations.push(mutation);
        continue;
      }

      retainedMutations.push(mutation);
      if (previous !== undefined) {
        lines[previous.index] = current.line;
      } else {
        appendBeforeTrailingBlankLines(lines, current.line);
      }
    }

    if (beforeSection === undefined && retainedMutations.every(
      (mutation) => mutation.section !== key
    )) {
      return null;
    }

    return { key, lines };
  };

  const sanitizeListSection = (key) => {
    const beforeSection = beforeByKey.get(key);
    const afterSection = afterByKey.get(key);
    if (beforeSection === undefined && afterSection === undefined) {
      return null;
    }

    const beforeEntries = rawListSectionEntries(beforeSection);
    const afterEntries = rawListSectionEntries(afterSection);
    const lines =
      beforeSection !== undefined
        ? [...beforeSection.lines]
        : [afterSection.lines[0]];

    for (const [entry, current] of afterEntries) {
      if (beforeEntries.has(entry)) {
        continue;
      }

      const packageName = packageFromDependencySelector(entry);
      const mutation = {
        section: key,
        selector: entry,
        packageName,
        previousValue: null,
        generatedValue: entry,
      };

      if (!authorized.has(packageName)) {
        prunedMutations.push(mutation);
        continue;
      }

      retainedMutations.push(mutation);
      appendBeforeTrailingBlankLines(lines, current.line);
    }

    if (beforeSection === undefined && retainedMutations.every(
      (mutation) => mutation.section !== key
    )) {
      return null;
    }

    return { key, lines };
  };

  const replacements = new Map([
    ['overrides', sanitizeMapSection('overrides')],
    [
      'minimumReleaseAgeExclude',
      sanitizeListSection('minimumReleaseAgeExclude'),
    ],
  ]);

  const sections = [];
  const seen = new Set();
  for (const section of afterSplit.sections) {
    if (!MUTABLE_WORKSPACE_SECTIONS.has(section.key)) {
      sections.push(section);
      continue;
    }
    const replacement = replacements.get(section.key);
    seen.add(section.key);
    if (replacement !== null) {
      sections.push(replacement);
    }
  }

  for (const key of MUTABLE_WORKSPACE_SECTIONS) {
    if (seen.has(key)) {
      continue;
    }
    const replacement = replacements.get(key);
    if (replacement !== null) {
      sections.push(replacement);
    }
  }

  const sortMutations = (a, b) => {
    const bySection = a.section.localeCompare(b.section);
    return bySection !== 0
      ? bySection
      : a.selector.localeCompare(b.selector);
  };
  retainedMutations.sort(sortMutations);
  prunedMutations.sort(sortMutations);

  return {
    workspaceSource: [
      ...afterSplit.prefix,
      ...sections.flatMap((section) => section.lines),
    ].join('\n'),
    evidence: {
      schemaVersion: 1,
      authorizedPackages: [...authorized].sort(),
      retainedPackages: [
        ...new Set(retainedMutations.map((mutation) => mutation.packageName)),
      ].sort(),
      prunedPackages: [
        ...new Set(prunedMutations.map((mutation) => mutation.packageName)),
      ].sort(),
      retainedMutations,
      prunedMutations,
    },
  };
}

export function validateAuthorizedPackagesRemediated(
  auditReport,
  authorizedPackages,
  auditLevel = 'high'
) {
  const authorized = new Set(authorizedPackages);
  if (authorized.size === 0) {
    throw new Error(
      'Post-remediation registry proof requires explicit package authority'
    );
  }

  const registryEvidence = buildRegistryRemediationEvidence(
    auditReport,
    auditLevel
  );
  const remainingPackages = registryEvidence.packages.filter((packageName) =>
    authorized.has(packageName)
  );
  const remainingAdvisories = registryEvidence.advisories.filter((advisory) =>
    authorized.has(advisory.package)
  );

  if (remainingPackages.length > 0) {
    const advisoryEvidence = remainingAdvisories
      .map((advisory) => `${advisory.ghsaId}:${advisory.package}`)
      .sort();
    const evidence =
      advisoryEvidence.length > 0
        ? advisoryEvidence.join(', ')
        : remainingPackages.join(', ');
    throw new Error(
      `Authorized remediation package(s) still have registry advisories: ${evidence}`
    );
  }

  return {
    schemaVersion: 1,
    auditLevel,
    authorizedPackages: [...authorized].sort(),
    remainingPackages: [],
    remainingAdvisories: [],
  };
}

export function validateRemediationDiff({
  changedFiles,
  untrackedFiles = [],
  workspaceBefore,
  workspaceAfter,
  authorizedPackages = [],
}) {
  const uniqueFiles = [...new Set(changedFiles)].sort();
  const allowed = new Set(ALLOWED_REMEDIATION_PATHS);

  if (uniqueFiles.length === 0) {
    throw new Error('Security remediation produced no repository changes');
  }

  const unexpected = uniqueFiles.filter((path) => !allowed.has(path));
  if (unexpected.length > 0) {
    throw new Error(
      `Security remediation changed forbidden paths: ${unexpected.join(', ')}`
    );
  }

  if (!uniqueFiles.includes('pnpm-workspace.yaml')) {
    throw new Error(
      'Security remediation must include a bounded pnpm-workspace.yaml override mutation'
    );
  }

  const unexpectedUntracked = [...new Set(untrackedFiles)]
    .sort()
    .filter((path) => !path.startsWith('.security-remediation/'));
  if (unexpectedUntracked.length > 0) {
    throw new Error(
      `Security remediation created forbidden untracked paths: ${unexpectedUntracked.join(', ')}`
    );
  }

  let mutationSummary = {
    overrideMutations: [],
    releaseAgeMutations: [],
    changedPackages: [],
  };

  {
    if (
      JSON.stringify(immutableWorkspaceView(workspaceBefore)) !==
      JSON.stringify(immutableWorkspaceView(workspaceAfter))
    ) {
      throw new Error(
        'Security remediation changed pnpm-workspace.yaml outside overrides/minimumReleaseAgeExclude'
      );
    }

    const authorized = new Set(authorizedPackages);
    if (authorized.size === 0) {
      throw new Error(
        'Security remediation workspace mutation requires explicit package authority'
      );
    }

    mutationSummary = workspaceMutationSummary(workspaceBefore, workspaceAfter);
    if (mutationSummary.changedPackages.length === 0) {
      throw new Error(
        'Security remediation changed pnpm-workspace.yaml without a semantic security mutation'
      );
    }

    const unauthorized = mutationSummary.changedPackages.filter(
      (packageName) => !authorized.has(packageName)
    );
    if (unauthorized.length > 0) {
      throw new Error(
        `Security remediation changed package(s) outside Dependabot plan authority: ${unauthorized.join(', ')}`
      );
    }
  }

  return {
    schemaVersion: 2,
    changedFiles: uniqueFiles,
    mutableWorkspaceSections: [...MUTABLE_WORKSPACE_SECTIONS].sort(),
    authorizedPackages: [...new Set(authorizedPackages)].sort(),
    changedPackages: mutationSummary.changedPackages,
  };
}

function isRelevantAlert(alert, auditLevel) {
  const severity = alert?.security_advisory?.severity?.toLowerCase();
  const minimumRank = SEVERITY_RANK[auditLevel];
  return (
    alert?.state === 'open' &&
    alert?.dependency?.package?.ecosystem === 'npm' &&
    alert?.dependency?.scope === AUTOMATED_DEPENDENCY_SCOPE &&
    typeof severity === 'string' &&
    SEVERITY_RANK[severity] >= minimumRank
  );
}

function openRuntimePackages(alerts) {
  return new Set(
    alerts
      .filter(
        (alert) =>
          alert?.state === 'open' &&
          alert?.dependency?.package?.ecosystem === 'npm' &&
          alert?.dependency?.scope !== AUTOMATED_DEPENDENCY_SCOPE
      )
      .map((alert) => alert?.dependency?.package?.name)
      .filter((name) => typeof name === 'string' && name.length > 0)
  );
}

export function buildRuntimeAuditIgnores(alerts, auditLevel = 'high') {
  if (!(auditLevel in SEVERITY_RANK)) {
    throw new Error(`Unsupported audit level: ${auditLevel}`);
  }

  const validGhsa = (ghsaId) =>
    typeof ghsaId === 'string' &&
    /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/i.test(
      ghsaId
    );
  const runtimePackages = openRuntimePackages(alerts);
  const ignoredGhsas = [
    ...new Set(
      alerts
        .filter(
          (alert) =>
            alert?.state === 'open' &&
            alert?.dependency?.package?.ecosystem === 'npm' &&
            runtimePackages.has(alert?.dependency?.package?.name)
        )
        .map((alert) => alert?.security_advisory?.ghsa_id)
        .filter(validGhsa)
    ),
  ].sort();

  return {
    schemaVersion: 1,
    auditLevel,
    dependencyScope: AUTOMATED_DEPENDENCY_SCOPE,
    runtimePackages: [...runtimePackages].sort(),
    ignoredGhsas,
  };
}

export function buildRemediationPlan(alerts, auditLevel = 'high') {
  if (!(auditLevel in SEVERITY_RANK)) {
    throw new Error(`Unsupported audit level: ${auditLevel}`);
  }

  const runtimePackages = openRuntimePackages(alerts);
  const relevant = alerts.filter((alert) => isRelevantAlert(alert, auditLevel));
  const safeRelevant = relevant.filter(
    (alert) => !runtimePackages.has(alert?.dependency?.package?.name)
  );
  const fixable = safeRelevant.filter(
    (alert) =>
      typeof alert?.security_vulnerability?.first_patched_version?.identifier ===
        'string' &&
      alert.security_vulnerability.first_patched_version.identifier.length > 0
  );
  const blocked = relevant.filter((alert) => !fixable.includes(alert));

  const packages = [
    ...new Set(
      relevant
        .map((alert) => alert?.dependency?.package?.name)
        .filter((name) => typeof name === 'string' && name.length > 0)
    ),
  ].sort();
  const fixablePackages = [
    ...new Set(
      fixable
        .map((alert) => alert?.dependency?.package?.name)
        .filter((name) => typeof name === 'string' && name.length > 0)
    ),
  ].sort();
  const runtimeBlockedPackages = [
    ...new Set(
      relevant
        .map((alert) => alert?.dependency?.package?.name)
        .filter(
          (name) =>
            typeof name === 'string' &&
            name.length > 0 &&
            runtimePackages.has(name)
        )
    ),
  ].sort();

  return {
    schemaVersion: 1,
    auditLevel,
    dependencyScope: AUTOMATED_DEPENDENCY_SCOPE,
    relevantAlertCount: relevant.length,
    fixableAlertCount: fixable.length,
    blockedAlertCount: blocked.length,
    packages,
    fixablePackages,
    runtimeBlockedPackages,
    alerts: relevant.map((alert) => ({
      number: alert.number,
      ghsaId: alert?.security_advisory?.ghsa_id ?? null,
      severity: alert?.security_advisory?.severity ?? null,
      package: alert?.dependency?.package?.name ?? null,
      scope: alert?.dependency?.scope ?? null,
      vulnerableVersionRange:
        alert?.security_vulnerability?.vulnerable_version_range ?? null,
      firstPatchedVersion:
        alert?.security_vulnerability?.first_patched_version?.identifier ?? null,
      blockedByRuntimeScope: runtimePackages.has(
        alert?.dependency?.package?.name
      ),
    })),
  };
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
}

function readChangedFiles(args) {
  const output = runGit(args);
  return output.length === 0 ? [] : output.split('\n').filter(Boolean);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function resolveSourceAuthority({ auditPath, planPath, auditLevel }) {
  if (!auditPath || !planPath) {
    throw new Error(
      'Source remediation validation requires --audit and --plan evidence'
    );
  }

  const registryEvidence = buildRegistryRemediationEvidence(
    readJson(auditPath),
    auditLevel
  );
  const plan = readJson(planPath);
  validatePlanAgainstRegistryEvidence(plan, registryEvidence);
  return { registryEvidence, plan };
}

function validateWorkingTree({ auditPath, planPath, auditLevel }) {
  const changedFiles = readChangedFiles(['diff', '--name-only', 'HEAD', '--']);
  const untrackedFiles = readChangedFiles([
    'ls-files',
    '--others',
    '--exclude-standard',
  ]);
  const workspaceBefore = runGit(['show', 'HEAD:pnpm-workspace.yaml']);
  const workspaceAfter = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
  const { plan } = resolveSourceAuthority({
    auditPath,
    planPath,
    auditLevel,
  });

  return validateRemediationDiff({
    changedFiles,
    untrackedFiles,
    workspaceBefore,
    workspaceAfter,
    authorizedPackages: plan.fixablePackages,
  });
}

function validatePullRequest(baseSha, candidatePath) {
  if (!/^[0-9a-f]{40}$/.test(baseSha ?? '')) {
    throw new Error('A valid 40-character base SHA is required');
  }
  if (!candidatePath) {
    throw new Error('Candidate evidence is required for PR validation');
  }

  const candidate = readJson(candidatePath);
  if (
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.authorizedPackages) ||
    candidate.authorizedPackages.length === 0
  ) {
    throw new Error('Security remediation candidate package authority is invalid');
  }

  const changedFiles = readChangedFiles([
    'diff',
    '--name-only',
    `${baseSha}...HEAD`,
    '--',
  ]);
  const workspaceBefore = runGit(['show', `${baseSha}:pnpm-workspace.yaml`]);
  const workspaceAfter = fs.readFileSync('pnpm-workspace.yaml', 'utf8');

  const validation = validateRemediationDiff({
    changedFiles,
    workspaceBefore,
    workspaceAfter,
    authorizedPackages: candidate.authorizedPackages,
  });
  if (!Array.isArray(candidate.changedPackages)) {
    throw new Error(
      'Security remediation candidate changed-package evidence is invalid'
    );
  }
  const expectedChangedPackages = [...candidate.changedPackages].sort();
  if (
    JSON.stringify(validation.changedPackages) !==
    JSON.stringify(expectedChangedPackages)
  ) {
    throw new Error(
      'Security remediation candidate changed-package evidence does not match the PR diff'
    );
  }

  return validation;
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(argv) {
  const [command, ...rest] = argv;

  if (command === 'plan' || command === 'runtime-ignores') {
    const [alertsPath = '.security-remediation/alerts.json'] = rest;
    const auditLevel = flagValue(rest, '--level') ?? 'high';
    const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));

    if (!Array.isArray(alerts)) {
      throw new Error('Dependabot alerts payload must be an array');
    }

    const result =
      command === 'plan'
        ? buildRemediationPlan(alerts, auditLevel)
        : buildRuntimeAuditIgnores(alerts, auditLevel);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'verify-plan-audit') {
    const auditLevel = flagValue(rest, '--level') ?? 'high';
    const { registryEvidence } = resolveSourceAuthority({
      auditPath: flagValue(rest, '--audit'),
      planPath: flagValue(rest, '--plan'),
      auditLevel,
    });
    console.log(JSON.stringify(registryEvidence, null, 2));
    return;
  }

  if (command === 'reconcile-generated-workspace') {
    const planPath = flagValue(rest, '--plan');
    if (!planPath) {
      throw new Error('Generated workspace reconciliation requires --plan');
    }
    const plan = readJson(planPath);
    if (!Array.isArray(plan.fixablePackages)) {
      throw new Error('Remediation plan fixablePackages must be an array');
    }
    const workspaceBefore = runGit(['show', 'HEAD:pnpm-workspace.yaml']);
    const workspaceAfter = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
    const result = reconcileGeneratedWorkspaceAuthority({
      workspaceBefore,
      workspaceAfter,
      authorizedPackages: plan.fixablePackages,
    });
    fs.writeFileSync('pnpm-workspace.yaml', result.workspaceSource, 'utf8');
    console.log(JSON.stringify(result.evidence, null, 2));
    return;
  }

  if (command === 'verify-remediated-audit') {
    const auditLevel = flagValue(rest, '--level') ?? 'high';
    const auditPath = flagValue(rest, '--audit');
    const planPath = flagValue(rest, '--plan');
    const candidatePath = flagValue(rest, '--candidate');
    if (!auditPath || (Boolean(planPath) === Boolean(candidatePath))) {
      throw new Error(
        'Post-remediation audit requires --audit and exactly one of --plan or --candidate'
      );
    }
    const authority = readJson(planPath ?? candidatePath);
    const authorizedPackages =
      planPath !== undefined
        ? authority.fixablePackages
        : authority.authorizedPackages;
    console.log(
      JSON.stringify(
        validateAuthorizedPackagesRemediated(
          readJson(auditPath),
          authorizedPackages,
          auditLevel
        ),
        null,
        2
      )
    );
    return;
  }

  if (command === 'validate-working-tree') {
    const auditLevel = flagValue(rest, '--level') ?? 'high';
    console.log(
      JSON.stringify(
        validateWorkingTree({
          auditPath: flagValue(rest, '--audit'),
          planPath: flagValue(rest, '--plan'),
          auditLevel,
        }),
        null,
        2
      )
    );
    return;
  }

  if (command === 'validate-pr') {
    console.log(
      JSON.stringify(
        validatePullRequest(
          flagValue(rest, '--base'),
          flagValue(rest, '--candidate')
        ),
        null,
        2
      )
    );
    return;
  }

  throw new Error(
    'Usage: dependabot-security-remediation.mjs <plan|runtime-ignores|verify-plan-audit|reconcile-generated-workspace|verify-remediated-audit|validate-working-tree|validate-pr>'
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
