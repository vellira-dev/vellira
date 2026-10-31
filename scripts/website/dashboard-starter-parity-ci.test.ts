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
  it('checks the exact commit on every branch push and PR, without path filters', () => {
    const workflow = readWorkflow('.github/workflows/dashboard-starter-parity.yml');
    expect(workflow.on?.push?.branches).toEqual(['**']);
    expect(workflow.on?.pull_request?.branches).toEqual(['main']);
    expect(workflow.on?.push?.paths).toBeUndefined();
    expect(workflow.on?.pull_request?.paths).toBeUndefined();

    const steps = workflow.jobs.parity.steps;
    expect(steps.some((step) => step.run?.includes(checkCommand))).toBe(true);
    expect(steps.some((step) => step.run?.includes('git rev-parse HEAD'))).toBe(true);
    expect(steps.some((step) => step.run?.includes('EXPECTED_SHA'))).toBe(true);
    expect(steps.every((step) => !step.run?.includes('npm install'))).toBe(true);
  });

  it('blocks both staging phases and production before installing dependencies', () => {
    const staging = readWorkflow(
      '.github/workflows/deploy-website-cloudflare-staging.yml'
    );
    const production = readWorkflow(
      '.github/workflows/deploy-website-cloudflare-production.yml'
    );

    for (const job of [
      staging.jobs.migration,
      staging.jobs.deploy,
      production.jobs.deploy,
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

      const sourceJsx = "import { fixture } from './model';\nexport const Dashboard = fixture;\n";
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
