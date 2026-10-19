export type ProjectStatus = 'planned' | 'active' | 'shipped';
export type Team = 'design' | 'platform' | 'mobile';

export interface Project {
  id: number;
  name: string;
  description: string;
  team: Team;
  status: ProjectStatus;
  completed: boolean;
}

export interface Workspace {
  name: string;
  notifications: boolean;
  projects: Project[];
}

export const initialWorkspace: Workspace = {
  name: 'Demo Workspace',
  notifications: true,
  projects: [
    {
      id: 1,
      name: 'Design token refresh',
      description: 'Unify semantic colors and spacing.',
      team: 'design',
      status: 'active',
      completed: false,
    },
    {
      id: 2,
      name: 'Mobile onboarding',
      description: 'Bring the first-run experience to native.',
      team: 'mobile',
      status: 'planned',
      completed: false,
    },
    {
      id: 3,
      name: 'Dashboard rollout',
      description: 'Ship the verified workspace interface.',
      team: 'platform',
      status: 'shipped',
      completed: true,
    },
  ],
};

export const statuses: readonly ProjectStatus[] = [
  'planned',
  'active',
  'shipped',
];

export const teams: readonly Team[] = ['design', 'platform', 'mobile'];

export function isStatus(value: string): value is ProjectStatus {
  return statuses.some((status) => status === value);
}

export function isTeam(value: string): value is Team {
  return teams.some((team) => team === value);
}

export function nextProjectId(projects: readonly Project[]): number {
  return projects.reduce((max, project) => Math.max(max, project.id), 0) + 1;
}

export function addProject(
  workspace: Workspace,
  name: string,
  team: Team,
  status: ProjectStatus
): Workspace {
  const trimmed = name.trim();
  if (!trimmed) return workspace;

  const next: Project = {
    id: nextProjectId(workspace.projects),
    name: trimmed,
    description: 'Created in the Vellira Workspace Starter.',
    team,
    status,
    completed: status === 'shipped',
  };

  return { ...workspace, projects: [next, ...workspace.projects] };
}

export function duplicateProject(workspace: Workspace, id: number): Workspace {
  const existing = workspace.projects.find((project) => project.id === id);
  if (!existing) return workspace;

  return {
    ...workspace,
    projects: [
      {
        ...existing,
        id: nextProjectId(workspace.projects),
        name: existing.name + ' copy',
        status: 'planned',
        completed: false,
      },
      ...workspace.projects,
    ],
  };
}

export function removeProject(workspace: Workspace, id: number): Workspace {
  return {
    ...workspace,
    projects: workspace.projects.filter((project) => project.id !== id),
  };
}

export function toggleProject(
  workspace: Workspace,
  id: number,
  completed: boolean
): Workspace {
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === id
        ? {
            ...project,
            completed,
            status: completed ? 'shipped' : 'active',
          }
        : project
    ),
  };
}

export function filterProjects(
  projects: readonly Project[],
  query: string,
  status: ProjectStatus | 'all'
): Project[] {
  const needle = query.trim().toLocaleLowerCase();
  return projects.filter(
    (project) =>
      (status === 'all' || project.status === status) &&
      (!needle ||
        project.name.toLocaleLowerCase().includes(needle) ||
        project.description.toLocaleLowerCase().includes(needle))
  );
}

export function readStoredWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Workspace>;

  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.notifications !== 'boolean' ||
    !Array.isArray(candidate.projects)
  ) {
    return null;
  }

  for (const project of candidate.projects) {
    if (
      !project ||
      typeof project.id !== 'number' ||
      !Number.isSafeInteger(project.id) ||
      project.id < 1 ||
      typeof project.name !== 'string' ||
      typeof project.description !== 'string' ||
      typeof project.completed !== 'boolean' ||
      !isStatus(project.status) ||
      !isTeam(project.team)
    ) {
      return null;
    }
  }

  const ids = candidate.projects.map((project) => project.id);
  if (new Set(ids).size !== ids.length) return null;

  return candidate as Workspace;
}
