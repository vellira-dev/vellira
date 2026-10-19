import { describe, expect, it } from 'vitest';

import {
  addProject,
  duplicateProject,
  filterProjects,
  initialWorkspace,
  nextProjectId,
  readStoredWorkspace,
  removeProject,
  toggleProject,
} from '../../examples/workspace-starter/web/src/model';

describe('Vellira Workspace Starter state model', () => {
  it('creates nonempty projects without mutating sample data', () => {
    const updated = addProject(initialWorkspace, '  Mobile QA  ', 'mobile', 'planned');
    expect(updated.projects).toHaveLength(4);
    expect(updated.projects[0]).toMatchObject({
      id: 4,
      name: 'Mobile QA',
      team: 'mobile',
      status: 'planned',
      completed: false,
    });
    expect(initialWorkspace.projects).toHaveLength(3);
    expect(nextProjectId(updated.projects)).toBe(5);
    expect(addProject(initialWorkspace, '  ', 'design', 'planned')).toBe(
      initialWorkspace
    );
  });

  it('duplicates, completes, reopens and removes a project', () => {
    const duplicated = duplicateProject(initialWorkspace, 2);
    expect(duplicated.projects[0]).toMatchObject({
      id: 4,
      name: 'Mobile onboarding copy',
      status: 'planned',
      completed: false,
    });
    const completed = toggleProject(duplicated, 4, true);
    expect(completed.projects[0]).toMatchObject({
      status: 'shipped',
      completed: true,
    });
    const reopened = toggleProject(completed, 4, false);
    expect(reopened.projects[0]).toMatchObject({
      status: 'active',
      completed: false,
    });
    expect(removeProject(reopened, 4).projects).toHaveLength(3);
    expect(duplicateProject(initialWorkspace, 999)).toBe(initialWorkspace);
  });

  it('filters by status and text without mutating projects', () => {
    expect(filterProjects(initialWorkspace.projects, '', 'all')).toHaveLength(3);
    expect(filterProjects(initialWorkspace.projects, '', 'planned')).toHaveLength(1);
    expect(filterProjects(initialWorkspace.projects, 'MOBILE', 'all')[0].id).toBe(2);
    expect(filterProjects(initialWorkspace.projects, 'semantic', 'all')[0].id).toBe(1);
    expect(filterProjects(initialWorkspace.projects, 'mobile', 'shipped')).toEqual([]);
  });

  it('rejects corrupt, duplicate or invalid persisted data', () => {
    expect(readStoredWorkspace(initialWorkspace)).not.toBeNull();
    expect(readStoredWorkspace(null)).toBeNull();
    expect(readStoredWorkspace({ name: 'x', notifications: true })).toBeNull();
    expect(
      readStoredWorkspace({
        ...initialWorkspace,
        projects: [initialWorkspace.projects[0], initialWorkspace.projects[0]],
      })
    ).toBeNull();
    expect(
      readStoredWorkspace({
        ...initialWorkspace,
        projects: [{ ...initialWorkspace.projects[0], status: 'invalid' }],
      })
    ).toBeNull();
  });
});
