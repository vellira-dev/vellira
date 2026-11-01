import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type WorkflowStep = { name?: string; run?: string; if?: string };
type Workflow = {
  on?: {
    push?: { branches?: string[]; paths?: string[] };
    pull_request?: { branches?: string[]; paths?: string[] };
  };
  jobs: Record<string, { steps: WorkflowStep[] }>;
};

const checkCommand = 'node scripts/website/sync-dashboard-starter.mjs --check';

function readWorkflow(path: string): Workflow {
  return parse(readFileSync(resolve(path), 'utf8')) as Workflow;
}

describe('Dashboard Starter CI parity contract', () => {
  it('runs on every push and PR without path filters', () => {
    const workflow = readWorkflow(
      '.github/workflows/dashboard-starter-parity.yml'
    );
    expect(workflow.on?.push?.branches).toEqual(['**']);
    expect(workflow.on?.pull_request?.branches).toEqual(['main']);
    expect(workflow.on?.push?.paths).toBeUndefined();
    expect(workflow.on?.pull_request?.paths).toBeUndefined();

    const steps = workflow.jobs.parity.steps;
    const guard = steps.find((step) => step.run?.includes(checkCommand));
    expect(guard?.run).toContain('git rev-parse HEAD');
    expect(guard?.run).toContain('EXPECTED_SHA');
    const hasInstall = steps.some((step) => step.run?.includes('npm install'));
    expect(hasInstall).toBe(false);
  });

  it('blocks staging and production before dependency installation', () => {
    const staging = readWorkflow(
      '.github/workflows/deploy-website-cloudflare-staging.yml'
    );
    const production = readWorkflow(
      '.github/workflows/deploy-website-cloudflare-production.yml'
    );
    const legacyAdoption = readWorkflow(
      '.github/workflows/adopt-website-cloudflare-legacy.yml'
    );

    for (const job of [
      staging.jobs.migration,
      staging.jobs.deploy,
      production.jobs.deploy,
      legacyAdoption.jobs.deploy,
    ]) {
      const steps = job.steps;
      const guard = steps.findIndex((step) => step.run === checkCommand);
      const install = steps.findIndex(
        (step) => step.run === 'pnpm install --frozen-lockfile'
      );
      expect(guard).toBeGreaterThan(-1);
      expect(install).toBeGreaterThan(guard);
      expect(steps[guard].if).toBe(steps[install].if);
    }
  });

  it('fails closed and does not rewrite a drifted JSX or CSS mirror', () => {
    const root = mkdtempSync(join(tmpdir(), 'vellira-dashboard-parity-'));
    try {
      const starter = join(root, 'examples/workspace-starter/web/src');
      const site = join(
        root,
        'apps/website/src/sections/home/ProductInterfaceDemo'
      );
      const scripts = join(root, 'scripts/website');
      for (const dir of [starter, site, scripts]) {
        mkdirSync(dir, { recursive: true });
      }
      copyFileSync(
        resolve('scripts/website/sync-dashboard-starter.mjs'),
        join(scripts, 'sync-dashboard-starter.mjs')
      );

      const sourceJsx = [
        "import { fixture } from './model';",
        'export const Dashboard = fixture;',
        '',
      ].join('\n');
      const mirroredJsx = sourceJsx.replace(
        "from './model';",
        "from '../../../../../../examples/workspace-starter/web/src/model';"
      );
      const css = '.dashboard { display: grid; }\n';
      const siteJsx = join(site, 'Dashboard.tsx');
      const siteCss = join(site, 'Dashboard.module.css');
      writeFileSync(join(starter, 'Dashboard.tsx'), sourceJsx);
      writeFileSync(join(starter, 'Dashboard.module.css'), css);
      writeFileSync(siteJsx, mirroredJsx);
      writeFileSync(siteCss, css);

      const check = () =>
        spawnSync(
          process.execPath,
          [join(scripts, 'sync-dashboard-starter.mjs'), '--check'],
          { cwd: root, encoding: 'utf8' }
        );

      expect(check().status).toBe(0);

      const badJsx = 'export const Dashboard = null;\n';
      writeFileSync(siteJsx, badJsx);
      const jsxResult = check();
      expect(jsxResult.status).not.toBe(0);
      expect(jsxResult.stderr).toContain('Dashboard copies diverged');
      expect(readFileSync(siteJsx, 'utf8')).toBe(badJsx);

      writeFileSync(siteJsx, mirroredJsx);
      const badCss = '.dashboard { display: none; }\n';
      writeFileSync(siteCss, badCss);
      const cssResult = check();
      expect(cssResult.status).not.toBe(0);
      expect(cssResult.stderr).toContain('Dashboard copies diverged');
      expect(readFileSync(siteCss, 'utf8')).toBe(badCss);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
