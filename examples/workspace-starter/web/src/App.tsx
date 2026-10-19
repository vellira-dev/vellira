import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Modal,
  Portal,
  Select,
  Tabs,
  ThemeProvider,
} from '@vellira-ui/react';

import {
  addProject,
  duplicateProject,
  filterProjects,
  initialWorkspace,
  isStatus,
  isTeam,
  readStoredWorkspace,
  removeProject,
  toggleProject,
  type ProjectStatus,
  type Team,
  type Workspace,
} from './model';

type ViewName = 'overview' | 'projects' | 'settings';
type ThemeName = 'light' | 'dark' | 'high-contrast';

const storageKey = 'vellira-workspace-starter-v1';
const allStatuses = ['all', 'planned', 'active', 'shipped'] as const;
const themeNames: readonly ThemeName[] = ['light', 'dark', 'high-contrast'];

const statusLabel: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'In progress',
  shipped: 'Shipped',
};

function isView(value: string): value is ViewName {
  return value === 'overview' || value === 'projects' || value === 'settings';
}

function isTheme(value: string): value is ThemeName {
  return themeNames.some((item) => item === value);
}

export default function App() {
  const [theme, setTheme] = useState<ThemeName>('light');
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewName>('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectTeam, setProjectTeam] = useState<Team>('design');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('planned');
  const [createError, setCreateError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          const state = saved as { workspace?: unknown; theme?: unknown };
          const restored = readStoredWorkspace(state.workspace);
          if (restored) setWorkspace(restored);
          if (typeof state.theme === 'string' && isTheme(state.theme)) {
            setTheme(state.theme);
          }
        }
      }
    } catch {
      // Local storage may be unavailable; the starter remains usable in memory.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ workspace, theme })
      );
    } catch {
      // The demo still works without persistence.
    }
  }, [ready, workspace, theme]);

  const visibleProjects = useMemo(
    () => filterProjects(workspace.projects, search, filter),
    [workspace.projects, search, filter]
  );
  const shippedCount = workspace.projects.filter(
    (project) => project.status === 'shipped'
  ).length;
  const activeCount = workspace.projects.filter(
    (project) => project.status === 'active'
  ).length;
  const completedCount = workspace.projects.filter(
    (project) => project.completed
  ).length;

  function createProject() {
    if (!projectName.trim()) {
      setCreateError('Give the project a name to continue.');
      return;
    }
    setWorkspace((current) =>
      addProject(current, projectName, projectTeam, projectStatus)
    );
    setCreateOpen(false);
    setProjectName('');
    setCreateError('');
    setView('projects');
    setNotice('Project added to your local workspace.');
  }

  function resetDemo() {
    setWorkspace(initialWorkspace);
    setTheme('light');
    setSearch('');
    setFilter('all');
    setNotice('Sample data restored.');
  }

  return (
    <ThemeProvider theme={theme} onThemeChange={setTheme}>
      <div className='application'>
        <aside className='sidebar'>
          <div className='brand'>
            <div className='brandMark' aria-hidden='true'>V</div>
            <div>
              <strong>Vellira</strong>
              <span>Dashboard Starter</span>
            </div>
          </div>
          <nav className='sideNav' aria-label='Workspace navigation'>
            {(['overview', 'projects', 'settings'] as const).map((item) => (
              <Button
                key={item}
                appearance={view === item ? 'soft' : 'ghost'}
                color={view === item ? 'primary' : 'neutral'}
                className='navButton'
                onClick={() => setView(item)}
                aria-current={view === item ? 'page' : undefined}
              >
                {item === 'overview'
                  ? 'Overview'
                  : item === 'projects'
                    ? 'Projects'
                    : 'Settings'}
              </Button>
            ))}
          </nav>
          <div className='sidebarFoot'>
            <span className='projectPill'>Open source starter</span>
            <p>Built with published Vellira components, not screenshots.</p>
          </div>
        </aside>

        <div className='workspace'>
          <header className='topbar'>
            <div>
              <span className='eyebrow'>Product workspace</span>
              <h1>{workspace.name.trim() || 'Untitled workspace'}</h1>
              <p>Explore a complete, editable interface built with Vellira.</p>
            </div>
            <div className='topActions'>
              <Button
                appearance='outline'
                color='neutral'
                onClick={() =>
                  setTheme((current) =>
                    current === 'light' ? 'dark' : 'light'
                  )
                }
              >
                {theme === 'light' ? 'Dark theme' : 'Light theme'}
              </Button>
              <Button
                appearance='solid'
                color='primary'
                onClick={() => setCreateOpen(true)}
              >
                New project
              </Button>
            </div>
          </header>

          {notice && (
            <p role='status' className='notice'>
              {notice}
            </p>
          )}

          <Tabs
            value={view}
            onValueChange={(next) => {
              if (isView(next)) setView(next);
            }}
            variant='line'
          >
            <Tabs.List aria-label='Workspace sections'>
              <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
              <Tabs.Trigger value='projects'>Projects</Tabs.Trigger>
              <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>
              <Tabs.Indicator />
            </Tabs.List>

            <Tabs.Content value='overview'>
              <div className='viewBody'>
                <section className='metrics' aria-label='Project metrics'>
                  <article className='metricCard'>
                    <span>Total projects</span>
                    <strong>{workspace.projects.length}</strong>
                    <small>Current workspace</small>
                  </article>
                  <article className='metricCard'>
                    <span>In progress</span>
                    <strong>{activeCount}</strong>
                    <small>Active delivery</small>
                  </article>
                  <article className='metricCard'>
                    <span>Shipped</span>
                    <strong>{shippedCount}</strong>
                    <small>Released work</small>
                  </article>
                  <article className='metricCard'>
                    <span>Completed</span>
                    <strong>{completedCount}</strong>
                    <small>Marked done</small>
                  </article>
                </section>

                <div className='contentGrid'>
                  <section className='surfaceCard'>
                    <div className='sectionHeading'>
                      <div>
                        <span className='eyebrow'>Delivery overview</span>
                        <h2>Projects at a glance</h2>
                      </div>
                      <Button
                        appearance='outline'
                        color='neutral'
                        onClick={() => setView('projects')}
                      >
                        All projects
                      </Button>
                    </div>
                    <div className='projectList'>
                      {workspace.projects.slice(0, 3).map((project) => (
                        <div key={project.id} className='overviewProject'>
                          <span className='initials' aria-hidden='true'>
                            {project.name.slice(0, 1)}
                          </span>
                          <div className='projectCopy'>
                            <strong>{project.name}</strong>
                            <span>{project.description}</span>
                          </div>
                          <span
                            className='statusPill'
                            data-status={project.status}
                          >
                            {statusLabel[project.status]}
                          </span>
                        </div>
                      ))}
                      {workspace.projects.length === 0 && (
                        <p className='empty'>Create a project to get started.</p>
                      )}
                    </div>
                  </section>

                  <section className='surfaceCard insightCard'>
                    <span className='eyebrow'>What you can test</span>
                    <h2>Real interactions, public APIs.</h2>
                    <p>
                      Create and duplicate projects, filter the list, toggle
                      completion, change themes, and edit workspace settings.
                    </p>
                    <p>
                      All state is local to this browser. No sign-in or backend
                      is required.
                    </p>
                    <Button
                      appearance='solid'
                      color='primary'
                      onClick={() => setView('settings')}
                    >
                      Edit workspace
                    </Button>
                  </section>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value='projects'>
              <div className='viewBody'>
                <section className='surfaceCard'>
                  <div className='sectionHeading'>
                    <div>
                      <span className='eyebrow'>Project manager</span>
                      <h2>Projects</h2>
                      <p>Create, duplicate, complete, or remove project items.</p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                      Create
                    </Button>
                  </div>

                  <div className='filters'>
                    <Input
                      label='Search projects'
                      placeholder='Name or description'
                      value={search}
                      onValueChange={setSearch}
                      clearable
                      onClear={() => setSearch('')}
                    />
                    <Select
                      label='Status'
                      value={filter}
                      onValueChange={(next) => {
                        if (
                          typeof next === 'string' &&
                          (next === 'all' || isStatus(next))
                        ) {
                          setFilter(next);
                        }
                      }}
                    >
                      {allStatuses.map((value) => (
                        <Select.Item key={value} value={value}>
                          {value === 'all' ? 'All statuses' : statusLabel[value]}
                        </Select.Item>
                      ))}
                    </Select>
                  </div>

                  <div className='projectList'>
                    {visibleProjects.length === 0 && (
                      <div className='empty'>
                        No matching projects. Change your filters or create one.
                      </div>
                    )}
                    {visibleProjects.map((project) => (
                      <article key={project.id} className='projectRow'>
                        <div className='projectCopy'>
                          <span className='eyebrow'>
                            Team: {project.team}
                          </span>
                          <h3>{project.name}</h3>
                          <p>{project.description}</p>
                          <span
                            className='statusPill'
                            data-status={project.status}
                          >
                            {statusLabel[project.status]}
                          </span>
                        </div>
                        <div className='projectActions'>
                          <Checkbox
                            label='Mark completed'
                            checked={project.completed}
                            onCheckedChange={(checked) =>
                              setWorkspace((current) =>
                                toggleProject(current, project.id, checked)
                              )
                            }
                          />
                          <Dropdown placement='bottom-end'>
                            <Dropdown.Trigger asChild>
                              <Button appearance='outline' color='neutral'>
                                Actions
                              </Button>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                              <Dropdown.Label>Project actions</Dropdown.Label>
                              <Dropdown.Item
                                onSelect={() => {
                                  setWorkspace((current) =>
                                    duplicateProject(current, project.id)
                                  );
                                  setNotice('Project duplicated.');
                                }}
                              >
                                Duplicate
                              </Dropdown.Item>
                              <Dropdown.Separator />
                              <Dropdown.Item
                                color='danger'
                                onSelect={() => {
                                  setWorkspace((current) =>
                                    removeProject(current, project.id)
                                  );
                                  setNotice('Project removed from the demo.');
                                }}
                              >
                                Remove
                              </Dropdown.Item>
                            </Dropdown.Content>
                          </Dropdown>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </Tabs.Content>

            <Tabs.Content value='settings'>
              <div className='viewBody'>
                <section className='surfaceCard settingsCard'>
                  <span className='eyebrow'>Workspace settings</span>
                  <h2>Make it yours.</h2>
                  <p>
                    These settings are stored locally when browser storage is
                    available. No data is sent to Vellira.
                  </p>
                  <Input
                    label='Workspace name'
                    value={workspace.name}
                    onValueChange={(name) =>
                      setWorkspace((current) => ({ ...current, name }))
                    }
                    placeholder='Your workspace name'
                  />
                  <Checkbox
                    label='Product notifications'
                    description='Example local preference; no emails are sent.'
                    checked={workspace.notifications}
                    onCheckedChange={(notifications) =>
                      setWorkspace((current) => ({
                        ...current,
                        notifications,
                      }))
                    }
                  />
                  <div className='themePicker'>
                    <span>Appearance</span>
                    <div className='themeButtons' role='group' aria-label='Theme'>
                      {themeNames.map((option) => (
                        <Button
                          key={option}
                          appearance={theme === option ? 'solid' : 'outline'}
                          color={theme === option ? 'primary' : 'neutral'}
                          aria-pressed={theme === option}
                          onClick={() => setTheme(option)}
                        >
                          {option === 'high-contrast'
                            ? 'High contrast'
                            : option === 'light'
                              ? 'Light'
                              : 'Dark'}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button
                    appearance='outline'
                    color='neutral'
                    onClick={resetDemo}
                  >
                    Restore sample data
                  </Button>
                </section>
              </div>
            </Tabs.Content>
          </Tabs>

          <footer className='appFooter'>
            <span>Vellira Dashboard Starter · Local demo</span>
            <div>
              <a
                href='https://docs.vellira.dev/react/'
                target='_blank'
                rel='noopener noreferrer'
              >
                Docs
              </a>
              <a
                href='https://github.com/vellira-dev/vellira'
                target='_blank'
                rel='noopener noreferrer'
              >
                Source
              </a>
            </div>
          </footer>
        </div>
      </div>

      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError('');
        }}
      >
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <div>
                <Modal.Title>Create a project</Modal.Title>
                <Modal.Description>
                  Add a project to your local workspace. No backend needed.
                </Modal.Description>
              </div>
              <Modal.Close />
            </Modal.Header>
            <Modal.Body>
              <div className='dialogFields'>
                <Input
                  label='Project name'
                  value={projectName}
                  required
                  error={createError || undefined}
                  onValueChange={(value) => {
                    setProjectName(value);
                    setCreateError('');
                  }}
                  placeholder='e.g. Mobile design QA'
                />
                <Select
                  label='Team'
                  value={projectTeam}
                  onValueChange={(value) => {
                    if (value && isTeam(value)) setProjectTeam(value);
                  }}
                >
                  <Select.Item value='design'>Design</Select.Item>
                  <Select.Item value='platform'>Platform</Select.Item>
                  <Select.Item value='mobile'>Mobile</Select.Item>
                </Select>
                <Select
                  label='Status'
                  value={projectStatus}
                  onValueChange={(value) => {
                    if (value && isStatus(value)) setProjectStatus(value);
                  }}
                >
                  <Select.Item value='planned'>Planned</Select.Item>
                  <Select.Item value='active'>In progress</Select.Item>
                  <Select.Item value='shipped'>Shipped</Select.Item>
                </Select>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                appearance='outline'
                color='neutral'
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={createProject}>Create project</Button>
            </Modal.Footer>
          </Modal.Content>
        </Portal>
      </Modal>
    </ThemeProvider>
  );
}
