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

describe('live Vellira Dashboard Core showcase', () => {
  it('uses one existing homepage section, not a duplicate marketing page', () => {
    expect(homepage).toContain('<ProductInterfaceDemo />');
    expect(website).toContain("id='interface'");
    expect(website).toContain("id='dashboard-live'");
    expect(website).toContain("href='#dashboard-live'");
    expect(website).toContain('Try Live Demo');
    expect(website).toContain('View Source');
    expect(website).toContain('Use This Starter');
  });

  it('reuses the standalone starter model and actual Vellira controls', () => {
    expect(website).toContain('examples/workspace-starter/web/src/model');
    for (const component of [
      'Button',
      'Checkbox',
      'Dropdown',
      'Input',
      'Modal',
      'Portal',
      'Select',
    ]) {
      expect(website).toContain(component);
    }
    expect(website).toContain('addProject(');
    expect(website).toContain('filterProjects(');
    expect(website).toContain('readStoredWorkspace(');
    expect(website).toContain('localStorage.setItem');
    expect(website).toContain('onCheckedChange');
  });

  it('only links free source and does not advertise unbuilt paid features', () => {
    expect(website).toContain('Free Core demo');
    expect(website).toMatch(/No Pro\s+subscription/);
    expect(website).toContain('future paid layers');
    expect(website).toContain("href='#pro'");
    expect(website).toContain('github.com/vellira-dev/vellira');
    expect(website).not.toContain('/showcase');
    expect(website).not.toContain('Purchase now');
    expect(website).not.toContain('2.173.0');
    expect(readme).toContain('MIT');
    expect(starter).toContain('Vellira');
  });

  it('removes unrelated fictional branding and retains honest demo metrics', () => {
    expect(model).toContain("name: 'Demo Workspace'");
    expect(model).not.toContain('Northstar Studio');
    expect(website).not.toContain('Northstar Studio');
    expect(website).toContain('workspace.projects.length');
    expect(website).toContain('shippedCount');
    expect(website).toContain('activeCount');
  });
});
