'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Check,
  Clock,
  Grid,
  Home,
  Package,
  Plus,
  Search,
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
  type Project,
  type ProjectStatus,
  type Team,
  type Workspace,
} from './model';

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
const statusProgress: Record<ProjectStatus, number> = {
  planned: 20,
  active: 65,
  shipped: 100,
};
const navigation = [
  { id: 'overview', label: 'Dashboard', icon: Home },
  { id: 'projects', label: 'Projects', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
const statuses = ['planned', 'active', 'shipped'] as const;

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

function progressSeries(projects: readonly Project[]) {
  return projects.slice(0, 6).reverse();
}

function ProjectTrend({ projects }: { projects: readonly Project[] }) {
  const selected = progressSeries(projects);
  const dots = selected.map((project, index) => ({
    id: project.id,
    name: project.name,
    value: statusProgress[project.status],
    x: selected.length === 1 ? 270 : 28 + (index * 484) / (selected.length - 1),
    y: 176 - statusProgress[project.status] * 1.4,
  }));
  const linePoints = dots.map((point) => String(point.x) + ',' + String(point.y)).join(' ');

  return (
    <div className={styles.trendChart}>
      {dots.length > 0 ? (
        <>
          <svg
            viewBox='0 0 540 204'
            role='img'
            aria-label='Project progress in list order, based on current status: planned 20 percent, in progress 65 percent and shipped 100 percent'
            className={styles.trendSvg}
          >
            <title>Progress by sample project</title>
            {[36, 78, 120, 162].map((y) => (
              <line
                key={y}
                x1='20'
                x2='520'
                y1={y}
                y2={y}
                className={styles.chartGrid}
              />
            ))}
            {dots.length > 1 && (
              <polyline
                points={linePoints}
                className={styles.trendLine}
                fill='none'
              />
            )}
            {dots.map((point) => (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r='6'
                className={styles.trendDot}
              >
                <title>{point.name}: {point.value}% status progress</title>
              </circle>
            ))}
          </svg>
          <div className={styles.trendLegend} aria-hidden='true'>
            {dots.map((point) => (
              <span key={point.id}>{point.name.split(' ')[0]}</span>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>Create a project to see its progress.</p>
      )}
    </div>
  );
}

function PipelineChart({ projects }: { projects: readonly Project[] }) {
  const counts = statuses.map((status) => ({
    status,
    count: projects.filter((project) => project.status === status).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));

  return (
    <div
      className={styles.pipeline}
      role='img'
      aria-label={counts.map((item) => statusLabels[item.status] + ': ' + item.count + ' projects').join(', ')}
    >
      {counts.map((item) => (
        <div className={styles.pipelineColumn} key={item.status}>
          <div className={styles.pipelineTrack}>
            <div
              className={styles.pipelineBar}
              data-status={item.status}
              style={{
                height:
                  item.count === 0
                    ? '0%'
                    : String(Math.max(14, (item.count / max) * 100)) + '%',
              }}
            >
              {item.count > 0 && <strong>{item.count}</strong>}
            </div>
          </div>
          <span>{statusLabels[item.status]}</span>
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<Team>('design');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('planned');
  const [nameError, setNameError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      const saved = recoverWorkspace(window.localStorage.getItem(storageKey));
      if (saved) setWorkspace(saved);
    } catch {
      // Private browsing may forbid even reading localStorage.
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const stored =
        variant === 'embedded' ? workspace : { workspace, theme };
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // The demo remains usable when storage is disabled.
    }
  }, [hydrated, storageKey, theme, variant, workspace]);

  const projects = useMemo(
    () => filterProjects(workspace.projects, query, filter),
    [workspace.projects, query, filter]
  );
  const total = workspace.projects.length;
  const completed = workspace.projects.filter((item) => item.completed).length;
  const active = workspace.projects.filter((item) => item.status === 'active').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const cards = [
    { label: 'Total Projects', number: String(total), detail: 'Local projects', icon: Package, tone: 'primary' },
    { label: 'Completed', number: String(completed), detail: 'Marked as done', icon: Check, tone: 'success' },
    { label: 'In Progress', number: String(active), detail: 'Active projects', icon: Clock, tone: 'warning' },
    { label: 'Completion Rate', number: String(completionRate) + '%', detail: 'Of current projects', icon: Grid, tone: 'purple' },
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
    setWorkspace((current) =>
      addProject(current, newName, newTeam, newStatus)
    );
    setModalOpen(false);
    setView('projects');
    setFeedback('Project created in this browser.');
  }

  function resetDemo() {
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
          <span className={styles.brandMark} aria-hidden='true'>V</span>
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
                key={item.id}
                appearance={view === item.id ? 'soft' : 'ghost'}
                color={view === item.id ? 'primary' : 'neutral'}
                className={styles.navButton}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} aria-hidden='true' />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.userAvatar} aria-hidden='true'>DW</div>
          <div>
            <strong>Demo Workspace</strong>
            <small>Local-only sample account</small>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Search size={18} aria-hidden='true' />
            <Input
              label='Search projects'
              value={query}
              onValueChange={search}
              placeholder='Search projects...'
            />
          </div>
          <div className={styles.toolbarActions}>
            <span className={styles.localLabel}>Local demo</span>
            <Button onClick={openCreate}>
              <Plus size={16} aria-hidden='true' />
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
              <section className={styles.metrics} aria-label='Live project metrics'>
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
                    <h4>Progress by project</h4>
                    <span>Live sample data</span>
                  </div>
                  <ProjectTrend projects={workspace.projects} />
                  <p className={styles.chartNote}>
                    Each point shows the project's current status, not historical analytics.
                  </p>
                </section>
                <section className={styles.chartCard}>
                  <div className={styles.chartHeading}>
                    <h4>Project pipeline</h4>
                    <span>Current totals</span>
                  </div>
                  <PipelineChart projects={workspace.projects} />
                  <p className={styles.chartNote}>
                    Counts update when you create, complete or remove projects.
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
                        <span className={styles.projectSymbol} aria-hidden='true'>
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.statusPill} data-status={project.status}>
                          {statusLabels[project.status]}
                        </span>
                      </div>
                      <h5>{project.name}</h5>
                      <p>{project.description}</p>
                      <div className={styles.projectProgress}>
                        <div
                          style={{ width: String(statusProgress[project.status]) + '%' }}
                        />
                      </div>
                      <small>{teamLabels[project.team]} team</small>
                    </article>
                  ))}
                  {total === 0 && (
                    <p className={styles.empty}>Create your first project to get started.</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {view === 'projects' && (
            <section className={styles.contentPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h4>All Projects</h4>
                  <p>Search, filter and manage sample work.</p>
                </div>
                <Button onClick={openCreate}>Create project</Button>
              </div>
              <div className={styles.filters}>
                <Select
                  label='Status filter'
                  value={filter}
                  onValueChange={(value) => {
                    if (typeof value === 'string' &&
                      (value === 'all' || isStatus(value))) {
                      setFilter(value);
                    }
                  }}
                >
                  <Select.Item value='all'>All statuses</Select.Item>
                  <Select.Item value='planned'>Planned</Select.Item>
                  <Select.Item value='active'>In progress</Select.Item>
                  <Select.Item value='shipped'>Shipped</Select.Item>
                </Select>
                <span>{projects.length} matching projects</span>
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
                      <span className={styles.statusPill} data-status={project.status}>
                        {statusLabels[project.status]} · {teamLabels[project.team]}
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
                          <Button appearance='outline' color='neutral'>Actions</Button>
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
                  <p className={styles.empty}>No matching projects. Change the filter or create a new project.</p>
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
                <Button appearance='outline' color='neutral' onClick={resetDemo}>
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
                appearance='outline'
                color='neutral'
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={createProject}>Create project</Button>
            </Modal.Footer>
          </Modal.Content>
        </Portal>
      </Modal>
    </div>
  );
}

Dashboard.displayName = 'Dashboard';
