'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Check,
  Clock,
  Grid,
  Home,
  Package,
  Plus,
  Settings,
} from '@vellira-ui/icons';
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Modal,
  Portal,
  Select,
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
} from '../../../../../../examples/workspace-starter/web/src/model';

import styles from './Dashboard.module.css';

type View = 'overview' | 'projects' | 'settings';
export type DashboardTheme = 'light' | 'dark' | 'high-contrast' | 'system';

interface DashboardProps {
  variant?: 'embedded' | 'standalone';
  theme: DashboardTheme;
  onThemeChange: (next: DashboardTheme) => void;
}

const statusLabels: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'In progress',
  shipped: 'Shipped',
};
const teamLabels: Record<Team, string> = {
  design: 'Design',
  platform: 'Platform',
  mobile: 'Mobile',
};
const navigation = [
  { id: 'overview', label: 'Dashboard', icon: Home },
  { id: 'projects', label: 'Projects', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
const statuses = ['planned', 'active', 'shipped'] as const;
const teams = ['design', 'platform', 'mobile'] as const;

function recoverWorkspace(raw: string | null): Workspace | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as { workspace?: unknown };
    const saved = readStoredWorkspace(value.workspace ?? parsed);
    if (!saved) return null;
    // Migrate the previous fictional seed without discarding real demo edits.
    return saved.name === 'Northstar Studio'
      ? { ...saved, name: 'Demo Workspace' }
      : saved;
  } catch {
    return null;
  }
}

type BreakdownItem = {
  id: string;
  label: string;
  count: number;
};

function BreakdownChart({
  items,
  description,
}: {
  items: readonly BreakdownItem[];
  description: string;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count));

  return (
    <div
      className={styles.pipeline}
      role='img'
      aria-label={
        description +
        ': ' +
        items.map((item) => item.label + ' ' + item.count).join(', ')
      }
    >
      {items.map((item) => (
        <div className={styles.pipelineColumn} key={item.id}>
          <div className={styles.pipelineTrack}>
            <div
              className={styles.pipelineBar}
              data-category={item.id}
              style={{
                height:
                  item.count === 0
                    ? '0%'
                    : String(Math.max(14, (item.count / maximum) * 100)) + '%',
              }}
            >
              {item.count > 0 && <strong>{item.count}</strong>}
            </div>
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard({
  variant = 'standalone',
  theme,
  onThemeChange,
}: DashboardProps) {
  const storageKey =
    variant === 'embedded'
      ? 'vellira-dashboard-live-core-v1'
      : 'vellira-workspace-starter-v1';
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>('overview');
  const viewStorageKey = `${storageKey}-active-view`;
  const filterStorageKey = `${storageKey}-project-filter`;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<Team>('design');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('planned');
  const [nameError, setNameError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      const saved = recoverWorkspace(window.localStorage.getItem(storageKey));
      if (saved) setWorkspace(saved);
      const savedFilter = window.localStorage.getItem(filterStorageKey);
      if (
        savedFilter === 'all' ||
        (savedFilter !== null && isStatus(savedFilter))
      ) {
        setFilter(savedFilter);
      }
      const savedView = window.localStorage.getItem(viewStorageKey);
      if (
        savedView === 'overview' ||
        savedView === 'projects' ||
        savedView === 'settings'
      ) {
        setView(savedView);
      }
    } catch {
      // Private browsing may forbid even reading localStorage.
    }
    setHydrated(true);
  }, [filterStorageKey, storageKey, viewStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const stored = variant === 'embedded' ? workspace : { workspace, theme };
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // The demo remains usable when storage is disabled.
    }
  }, [hydrated, storageKey, theme, variant, workspace]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(viewStorageKey, view);
    } catch {
      // Navigation remains available if browser storage is unavailable.
    }
  }, [hydrated, view, viewStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(filterStorageKey, filter);
    } catch {
      // Filtering still works if browser storage is unavailable.
    }
  }, [filter, filterStorageKey, hydrated]);

  const projects = useMemo(
    () => filterProjects(workspace.projects, query, filter),
    [workspace.projects, query, filter]
  );
  const total = workspace.projects.length;
  const completed = workspace.projects.filter((item) => item.completed).length;
  const active = workspace.projects.filter(
    (item) => item.status === 'active'
  ).length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const cards = [
    {
      label: 'Total Projects',
      number: String(total),
      detail: 'Local projects',
      icon: Package,
      tone: 'primary',
    },
    {
      label: 'Completed',
      number: String(completed),
      detail: 'Marked as done',
      icon: Check,
      tone: 'success',
    },
    {
      label: 'In Progress',
      number: String(active),
      detail: 'Active projects',
      icon: Clock,
      tone: 'warning',
    },
    {
      label: 'Completion Rate',
      number: String(completionRate) + '%',
      detail: 'Of current projects',
      icon: Grid,
      tone: 'purple',
    },
  ];

  function openCreate() {
    setNewName('');
    setNewTeam('design');
    setNewStatus('planned');
    setNameError('');
    setModalOpen(true);
  }

  function createProject() {
    if (!newName.trim()) {
      setNameError('Enter a project name.');
      return;
    }
    setWorkspace((current) => addProject(current, newName, newTeam, newStatus));
    setModalOpen(false);
    setView('projects');
    setFeedback('Project created in this browser.');
  }

  function resetDemo() {
    setResetOpen(false);
    setWorkspace(initialWorkspace);
    setQuery('');
    setFilter('all');
    setFeedback('Demo projects restored.');
  }

  function search(value: string) {
    setQuery(value);
    if (value.trim()) setView('projects');
  }

  return (
    <div
      className={styles.dashboard}
      data-layout={variant}
      aria-label='Vellira interactive Dashboard Starter'
    >
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden='true'>
            <img
              src='/brand/icons/logo-icon-dark.svg'
              alt=''
              className={styles.brandLogoDark}
              width={24}
              height={24}
            />
            <img
              src='/brand/icons/logo-icon-light.svg'
              alt=''
              className={styles.brandLogoLight}
              width={24}
              height={24}
            />
          </span>
          <div>
            <strong>Vellira</strong>
            <small>Dashboard Starter</small>
          </div>
        </div>
        <span className={styles.navCaption}>WORKSPACE</span>
        <nav className={styles.sideNav} aria-label='Dashboard navigation'>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                shape='pill'
                key={item.id}
                appearance={view === item.id ? 'soft' : 'ghost'}
                color={view === item.id ? 'primary' : 'neutral'}
                size='sm'
                iconStart={<Icon size={18} aria-hidden='true' />}
                className={styles.navButton}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </Button>
            );
          })}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.userAvatar} aria-hidden='true'>
            DW
          </div>
          <div>
            <strong>Demo Workspace</strong>
            <small>Local-only sample account</small>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Input
              type='search'
              size='md'
              aria-label='Search projects'
              value={query}
              onValueChange={search}
              placeholder='Search projects...'
            />
          </div>
          <div className={styles.toolbarActions}>
            <span className={styles.localLabel}>Local demo</span>
            <Button
              shape='pill'
              size='sm'
              iconStart={<Plus size={16} aria-hidden='true' />}
              onClick={openCreate}
            >
              New project
            </Button>
          </div>
        </div>

        <main className={styles.mainContent}>
          <div className={styles.pageHeading}>
            <div>
              <h3>
                {view === 'overview'
                  ? 'Dashboard'
                  : view === 'projects'
                    ? 'Projects'
                    : 'Settings'}
              </h3>
              <p>
                {view === 'overview'
                  ? 'Your current projects and progress, in one place.'
                  : view === 'projects'
                    ? 'Manage sample projects with real Vellira components.'
                    : 'Customize the local demo workspace.'}
              </p>
            </div>
            <span className={styles.workspaceName}>
              {workspace.name.trim() || 'Untitled workspace'}
            </span>
          </div>

          {feedback && (
            <p role='status' className={styles.notice}>
              {feedback}
            </p>
          )}

          {view === 'overview' && (
            <div className={styles.overview}>
              <section
                className={styles.metrics}
                aria-label='Live project metrics'
              >
                {cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article className={styles.metricCard} key={card.label}>
                      <div>
                        <span>{card.label}</span>
                        <strong>{card.number}</strong>
                        <small>{card.detail}</small>
                      </div>
                      <span className={styles.metricIcon} data-tone={card.tone}>
                        <Icon size={20} aria-hidden='true' />
                      </span>
                    </article>
                  );
                })}
              </section>

              <div className={styles.charts}>
                <section className={styles.chartCard}>
                  <div className={styles.chartHeading}>
                    <h4>Projects by status</h4>
                    <span>Current workspace</span>
                  </div>
                  <BreakdownChart
                    description='Current project counts by status'
                    items={statuses.map((status) => ({
                      id: status,
                      label: statusLabels[status],
                      count: workspace.projects.filter(
                        (project) => project.status === status
                      ).length,
                    }))}
                  />
                  <p className={styles.chartNote}>
                    Live counts from the sample projects. No historical
                    analytics.
                  </p>
                </section>
                <section className={styles.chartCard}>
                  <div className={styles.chartHeading}>
                    <h4>Projects by team</h4>
                    <span>Current workspace</span>
                  </div>
                  <BreakdownChart
                    description='Current project counts by team'
                    items={teams.map((team) => ({
                      id: team,
                      label: teamLabels[team],
                      count: workspace.projects.filter(
                        (project) => project.team === team
                      ).length,
                    }))}
                  />
                  <p className={styles.chartNote}>
                    Updates when projects are created, duplicated or removed.
                  </p>
                </section>
              </div>

              <section className={styles.recentSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h4>Active Projects</h4>
                    <p>Track the work inside this sample workspace.</p>
                  </div>
                  <Button
                    shape='pill'
                    size='sm'
                    appearance='outline'
                    color='neutral'
                    onClick={() => setView('projects')}
                  >
                    View all projects
                  </Button>
                </div>
                <div className={styles.projectCards}>
                  {workspace.projects.slice(0, 3).map((project) => (
                    <article className={styles.projectCard} key={project.id}>
                      <div className={styles.projectCardTitle}>
                        <span
                          className={styles.projectSymbol}
                          aria-hidden='true'
                        >
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={styles.statusPill}
                          data-status={project.status}
                        >
                          {statusLabels[project.status]}
                        </span>
                      </div>
                      <h5>{project.name}</h5>
                      <p>{project.description}</p>
                      <small>{teamLabels[project.team]} team</small>
                    </article>
                  ))}
                  {total === 0 && (
                    <p className={styles.empty}>
                      Create your first project to get started.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {view === 'projects' && (
            <section
              className={`${styles.contentPanel} ${styles.projectsPanel}`}
            >
              <div className={styles.sectionHeading}>
                <div>
                  <h4>
                    All projects{' '}
                    <span className={styles.projectCount}>
                      {workspace.projects.length}
                    </span>
                  </h4>
                  
                </div>
                <p className={styles.projectsSubtitle}>Manage your sample projects</p>
              </div>
              <div className={styles.filters}>
                <Select
                  size='md'
                  aria-label='Status filter'
                  value={filter}
                  onValueChange={(value) => {
                    if (
                      typeof value === 'string' &&
                      (value === 'all' || isStatus(value))
                    ) {
                      setFilter(value);
                    }
                  }}
                >
                  <Select.Item value='all'>All statuses</Select.Item>
                  <Select.Item value='planned'>Planned</Select.Item>
                  <Select.Item value='active'>In progress</Select.Item>
                  <Select.Item value='shipped'>Shipped</Select.Item>
                </Select>
              </div>
              <div className={styles.projectList}>
                {projects.map((project) => (
                  <article className={styles.projectRow} key={project.id}>
                    <span className={styles.projectSymbol} aria-hidden='true'>
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                    <div className={styles.projectDetails}>
                      <strong>{project.name}</strong>
                      <small>{project.description}</small>
                      <span
                        className={styles.statusPill}
                        data-status={project.status}
                      >
                        {statusLabels[project.status]}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <Checkbox
                        label='Done'
                        checked={project.completed}
                        onCheckedChange={(checked) =>
                          setWorkspace((current) =>
                            toggleProject(current, project.id, checked)
                          )
                        }
                      />
                      <Dropdown placement='bottom-end'>
                        <Dropdown.Trigger asChild>
                          <Button
                            shape='pill'
                            size='sm'
                            appearance='outline'
                            color='neutral'
                            aria-label={`Actions for ${project.name}`}
                            iconOnly
                          >
                            <span aria-hidden='true'>⋯</span>
                          </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Content>
                          <Dropdown.Item
                            onSelect={() => {
                              setWorkspace((current) =>
                                duplicateProject(current, project.id)
                              );
                              setFeedback('Project duplicated locally.');
                            }}
                          >
                            Duplicate
                          </Dropdown.Item>
                          <Dropdown.Item
                            color='danger'
                            onSelect={() => {
                              setWorkspace((current) =>
                                removeProject(current, project.id)
                              );
                              setFeedback('Project removed locally.');
                            }}
                          >
                            Remove
                          </Dropdown.Item>
                        </Dropdown.Content>
                      </Dropdown>
                    </div>
                  </article>
                ))}
                {projects.length === 0 && (
                  <div className={styles.projectEmpty}>
                    <div className={styles.emptySymbol} aria-hidden='true'>
                      {workspace.projects.length === 0 ? '＋' : '⌕'}
                    </div>
                    <strong>
                      {workspace.projects.length === 0
                        ? 'No projects yet'
                        : 'No matching projects'}
                    </strong>
                    <p>
                      {workspace.projects.length === 0
                        ? 'Create your first project to get started.'
                        : 'Try another search or clear your filters.'}
                    </p>
                    {workspace.projects.length === 0 ? (
                      <Button shape='pill' size='sm' onClick={openCreate}>
                        Create project
                      </Button>
                    ) : (
                      <Button
                        shape='pill'
                        size='sm'
                        appearance='outline'
                        color='neutral'
                        onClick={() => {
                          setQuery('');
                          setFilter('all');
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {view === 'settings' && (
            <section className={styles.contentPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h4>Workspace Settings</h4>
                  <p>Changes stay in your browser. No account or backend.</p>
                </div>
              </div>
              <div className={styles.settingsFields}>
                <Input
                  size='md'
                  label='Workspace name'
                  value={workspace.name}
                  onValueChange={(name) =>
                    setWorkspace((current) => ({ ...current, name }))
                  }
                />
                <Checkbox
                  label='Example notifications'
                  description='This changes local state only. No email is sent.'
                  checked={workspace.notifications}
                  onCheckedChange={(notifications) =>
                    setWorkspace((current) => ({ ...current, notifications }))
                  }
                />
                <Select
                  size='md'
                  label='Theme'
                  value={theme}
                  onValueChange={(next) => {
                    if (
                      next === 'light' ||
                      next === 'dark' ||
                      next === 'high-contrast' ||
                      (variant === 'embedded' && next === 'system')
                    ) {
                      onThemeChange(next);
                    }
                  }}
                >
                  <Select.Item value='light'>Light</Select.Item>
                  <Select.Item value='dark'>Dark</Select.Item>
                  <Select.Item value='high-contrast'>High contrast</Select.Item>
                  {variant === 'embedded' && (
                    <Select.Item value='system'>System</Select.Item>
                  )}
                </Select>
                <Button
                  shape='pill'
                  size='md'
                  appearance='outline'
                  color='neutral'
                  onClick={() => setResetOpen(true)}
                >
                  Restore sample data
                </Button>
              </div>
            </section>
          )}
        </main>
        <footer className={styles.footer}>
          Vellira Core · Free dashboard example · Local sample projects
        </footer>
      </div>

      <Modal open={resetOpen} onOpenChange={setResetOpen}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <div>
                <Modal.Title>Restore sample data?</Modal.Title>
                <Modal.Description>
                  This replaces your locally saved projects and workspace
                  settings with the original examples. This action cannot be
                  undone.
                </Modal.Description>
              </div>
              <Modal.Close />
            </Modal.Header>
            <Modal.Footer>
              <Button
                shape='pill'
                size='sm'
                appearance='outline'
                color='neutral'
                onClick={() => setResetOpen(false)}
              >
                Cancel
              </Button>
              <Button shape='pill' size='sm' color='danger' onClick={resetDemo}>
                Restore data
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Portal>
      </Modal>

      <Modal
        open={modalOpen}
        onOpenChange={(next) => {
          setModalOpen(next);
          if (!next) setNameError('');
        }}
      >
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <div>
                <Modal.Title>Create a project</Modal.Title>
                <Modal.Description>
                  Add a sample project. Nothing is sent to a server.
                </Modal.Description>
              </div>
              <Modal.Close />
            </Modal.Header>
            <Modal.Body>
              <div className={styles.modalFields}>
                <Input
                  label='Project name'
                  required
                  value={newName}
                  error={nameError || undefined}
                  onValueChange={(value) => {
                    setNewName(value);
                    setNameError('');
                  }}
                  placeholder='e.g. Mobile UI audit'
                />
                <Select
                  size='md'
                  label='Team'
                  value={newTeam}
                  onValueChange={(value) => {
                    if (value && isTeam(value)) setNewTeam(value);
                  }}
                >
                  <Select.Item value='design'>Design</Select.Item>
                  <Select.Item value='platform'>Platform</Select.Item>
                  <Select.Item value='mobile'>Mobile</Select.Item>
                </Select>
                <Select
                  size='md'
                  label='Status'
                  value={newStatus}
                  onValueChange={(value) => {
                    if (value && isStatus(value)) setNewStatus(value);
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
                shape='pill'
                size='sm'
                appearance='outline'
                color='neutral'
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button shape='pill' size='sm' onClick={createProject}>
                Create project
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Portal>
      </Modal>
    </div>
  );
}

Dashboard.displayName = 'Dashboard';
