import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

const website = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx'
);
const homepage = read('apps/website/src/app/(marketing)/(site)/page.tsx');
const model = read('examples/workspace-starter/web/src/model.ts');
const starter = read('examples/workspace-starter/web/src/App.tsx');
const readme = read('examples/workspace-starter/README.md');
const standaloneDashboard = read(
  'examples/workspace-starter/web/src/Dashboard.tsx'
);
const siteDashboard = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.tsx'
);
const standaloneStyles = read(
  'examples/workspace-starter/web/src/Dashboard.module.css'
);
const siteStyles = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/Dashboard.module.css'
);

describe('live Vellira Dashboard Core showcase', () => {
  it('reuses the existing homepage and gives visitors working preview links', () => {
    expect(homepage).toContain('<ProductInterfaceDemo />');
    expect(website).toContain("id='interface'");
    expect(website).toContain("id='dashboard-live'");
    expect(website).toContain("href='#dashboard-live'");
    expect(website).toContain('Try Live Demo');
    expect(website).toContain('View Source');
    expect(website).toContain('Use This Starter');
    expect(website).toContain("const sourceRef = 'main'");
    expect(website).not.toContain('growth/react-native-form-try-it-20261018');
  });

  it('exposes full-screen, mobile and native discovery paths', () => {
    const fullDemo = read(
      'apps/website/src/app/(marketing)/demo/dashboard/page.tsx'
    );
    expect(fullDemo).toContain("variant='standalone'");
    expect(website).toContain("href='/demo/dashboard'");
    expect(website).toContain(
      "<Tabs.Trigger value='mobile'>Mobile</Tabs.Trigger>"
    );
    expect(website).toContain(
      "<Tabs.Trigger value='desktop'>Desktop</Tabs.Trigger>"
    );
    expect(website).toContain('/examples/workspace-starter/native');
    expect(website).toContain("src='/demo/dashboard'");
  });

  it('uses real Vellira primitives and maintains local sample behavior', () => {
    for (const component of [
      'Button',
      'Checkbox',
      'Dropdown',
      'Input',
      'Modal',
      'Portal',
      'Select',
    ]) {
      expect(standaloneDashboard).toContain(component);
    }
    expect(standaloneDashboard).toContain('addProject(');
    expect(standaloneDashboard).toContain('filterProjects(');
    expect(standaloneDashboard).toContain('readStoredWorkspace(');
    expect(standaloneDashboard).toContain('localStorage.setItem');
    expect(standaloneDashboard).toContain('onCheckedChange');
    expect(standaloneDashboard).toContain('Completion Rate');
    expect(standaloneDashboard).toContain('Projects by status');
    expect(standaloneDashboard).toContain('Projects by team');
    expect(standaloneDashboard).toContain('iconStart={<Icon');
    expect(standaloneDashboard).toContain('iconStart={<Plus');
    expect(standaloneDashboard).toContain("type='search'");
    expect(standaloneDashboard).toContain("aria-label='Search projects'");
    expect(standaloneDashboard).not.toMatch(/\slabel='Search projects'/);
    expect(standaloneDashboard).not.toContain('ProjectTrend');
    expect(standaloneDashboard).toMatch(/No historical\s+analytics\./);

    expect(standaloneDashboard).toContain('Project Snapshot');
  });

  it('vendors the canonical Vellira icons for standalone offline use', () => {
    for (const tone of ['dark', 'light']) {
      const original = read(
        `packages/assets/brand/icons/logo-icon-${tone}.svg`
      );
      const vendored = read(
        `examples/workspace-starter/web/public/brand/icons/logo-icon-${tone}.svg`
      );
      expect(vendored).toBe(original);
      expect(standaloneDashboard).toContain(
        `/brand/icons/logo-icon-${tone}.svg`
      );
    }
    expect(standaloneDashboard).not.toContain(
      'https://vellira.dev/brand/icons/'
    );
    expect(siteDashboard).not.toContain('https://vellira.dev/brand/icons/');
  });

  it('uses a compact Projects layout with distinct filtered and empty workspace states', () => {
    expect(standaloneDashboard).toContain('No matching projects');
    expect(standaloneDashboard).toContain('No projects yet');
    expect(standaloneDashboard).toContain('Clear filters');
    expect(standaloneDashboard).toContain("aria-label='Search projects'");
    expect(standaloneDashboard).not.toContain(
      "aria-label='Filter project list'"
    );
    expect(standaloneDashboard).toContain('styles.projectsPanel');
  });

  it('matches the Storybook rotating icon-only dropdown trigger', () => {
    expect(standaloneDashboard).toContain('<MoreHorizontal');
    expect(standaloneDashboard).toContain('<MoreVertical');
    expect(standaloneDashboard).toContain('styles.projectActionHorizontal');
    expect(standaloneDashboard).toContain('styles.projectActionVertical');
    expect(standaloneDashboard).toContain('styles.projectActionTrigger');
    expect(standaloneDashboard).toContain('<Dropdown.CheckboxItem');
    expect(standaloneStyles).toContain("[data-state='open']");
    expect(standaloneStyles).toContain('rotate(90deg) scale(0.92)');
    expect(standaloneStyles).toContain('prefers-reduced-motion');
  });

  it('uses shared radius tokens across Dashboard and preview', () => {
    const stageStyles = read(
      'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.module.css'
    );
    const hardcodedRadius = /border-radius:\s*[^;]*(?:\d+px|\d+%)/;
    expect(standaloneStyles).not.toMatch(hardcodedRadius);
    expect(siteStyles).not.toMatch(hardcodedRadius);
    expect(stageStyles).not.toMatch(hardcodedRadius);
    expect(standaloneStyles).toContain('border-radius: var(--radius-sm);');
    expect(standaloneStyles).toContain('border-radius: var(--radius-md);');
    expect(standaloneStyles).toContain('border-radius: var(--radius-lg);');
    expect(standaloneStyles).toContain('border-radius: var(--radius-full);');
    expect(stageStyles).toContain('border-radius: var(--radius-xl);');
  });

  it('preserves edits across previews and supports reversible actions', () => {
    const page = read(
      'apps/website/src/app/(marketing)/demo/dashboard/page.tsx'
    );
    const native = read('examples/workspace-starter/native/App.tsx');
    expect(standaloneDashboard).toContain(
      "const storageKey = 'vellira-dashboard-live-core-v1'"
    );
    expect(standaloneDashboard).toContain("'storage', syncWorkspace");
    expect(standaloneDashboard).toContain('workspaceDisplayName');
    expect(standaloneDashboard).toContain('restoreProject(');
    expect(standaloneDashboard).toContain('updateProject(');
    expect(standaloneDashboard).toContain('Project Snapshot');
    expect(standaloneDashboard).toContain('supportsSystemTheme');
    expect(page).toContain('allowSystemTheme');
    expect(page).not.toContain('<main');
    expect(native).toContain('themeStorageKey');
    expect(native).toContain('setResetOpen(true)');
    expect(native).toContain('openEdit(project)');
    expect(native).toContain('<Dropdown.Content');
    expect(native).toContain('contentStyle={{');
    expect(native).toContain('<Dropdown.Trigger asChild>');
    expect(native).toContain('offset={-44}');
    expect(native).toContain('systemUltraThinMaterialLight');
    expect(native).toContain('intensity={45}');
    expect(native).toContain('systemUltraThinMaterialDark');
    expect(native).toMatch(/<Dropdown\.Item\s+value='remove'/);
    expect(native).toContain('duplicateProject(project.id)');
    expect(native).toContain('deleteProject(project.id)');
    expect(native).toContain("label='Team'");
    expect(native).toContain("label='Status'");
    expect(native).toContain('Undo');
    expect(native).toContain('theme.tokens.radius.lg');
  });

  it('keeps one synchronized Dashboard implementation across both apps', () => {
    const normalizedWebsite = siteDashboard.replace(
      "from '../../../../../../examples/workspace-starter/web/src/model';",
      "from './model';"
    );
    expect(normalizedWebsite.replace(/\s+/g, '')).toBe(
      standaloneDashboard.replace(/\s+/g, '')
    );
    expect(siteStyles).toBe(standaloneStyles);
    expect(website).toContain("from './Dashboard'");
    expect(starter).toContain('<Dashboard');
  });

  it('keeps the free Core promise and does not claim paid features exist', () => {
    expect(website).toContain('Free Core demo');
    expect(website).toMatch(/No Pro\s+subscription/);
    expect(website).toContain('Future');
    expect(website).toContain('Pro tiers');
    expect(website).toContain("href='#pro'");
    expect(website).not.toContain('/showcase');
    expect(website).not.toContain('Purchase now');
    expect(website).not.toContain('2.173.0');
    expect(readme).toContain('MIT');
  });

  it('retains truthful project metrics and removes fictional branding', () => {
    expect(model).toContain("name: 'Demo Workspace'");
    expect(model).not.toContain("name: 'Northstar Studio'");
    expect(standaloneDashboard).toContain('workspace.projects.length');
    expect(standaloneDashboard).toContain('completionRate');
    expect(standaloneDashboard).not.toContain('statusProgress');
    expect(standaloneDashboard).not.toContain('<svg');
    expect(siteDashboard).not.toContain('<svg');
    expect(standaloneDashboard).toContain("saved.name === 'Northstar Studio'");
  });
});
