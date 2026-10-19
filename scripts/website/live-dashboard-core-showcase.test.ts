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
    expect(website).toContain('growth/react-native-form-try-it-20261018');
    expect(website).not.toContain('/blob/main/examples/workspace-starter');
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
    expect(standaloneDashboard).toContain('Progress by project');
    expect(standaloneDashboard).toContain('Project pipeline');
    expect(standaloneDashboard).toContain('Active Projects');
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
    expect(standaloneDashboard).toContain('statusProgress');
    expect(standaloneDashboard).toContain("saved.name === 'Northstar Studio'");
  });
});
