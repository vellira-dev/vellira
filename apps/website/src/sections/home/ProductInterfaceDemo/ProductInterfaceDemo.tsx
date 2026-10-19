'use client';

import { useEffect, useMemo, useState } from 'react';

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

import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';

import styles from './ProductInterfaceDemo.module.css';

type View = 'overview' | 'projects' | 'settings';
const storageKey = 'vellira-dashboard-live-core-v1';
const sourceUrl =
  'https://github.com/vellira-dev/vellira/blob/main/examples/workspace-starter/web/src/App.tsx';
const starterUrl =
  'https://github.com/vellira-dev/vellira/tree/main/examples/workspace-starter';

const statusLabels: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'In progress',
  shipped: 'Shipped',
};
const navigationItems = [
  { label: 'Overview', value: 'overview' },
  { label: 'Projects', value: 'projects' },
  { label: 'Settings', value: 'settings' },
] as const;

export function ProductInterfaceDemo() {
  const { preference, setPreference } = useWebsiteThemeContext();
  const [view, setView] = useState<View>('overview');
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(
    'all'
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<Team>('design');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('planned');
  const [nameError, setNameError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(storageKey);
      if (value) {
        const saved = readStoredWorkspace(JSON.parse(value) as unknown);
        if (saved) setWorkspace(saved);
      }
    } catch {
      // In-memory editing remains usable when local storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(workspace));
    } catch {
      // Nothing in the demo is sent to a remote service.
    }
  }, [hydrated, workspace]);

  const projects = useMemo(
    () => filterProjects(workspace.projects, query, statusFilter),
    [workspace.projects, query, statusFilter]
  );
  const activeCount = workspace.projects.filter(
    (project) => project.status === 'active'
  ).length;
  const shippedCount = workspace.projects.filter(
    (project) => project.status === 'shipped'
  ).length;

  function openNewProject() {
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
    setFeedback('Your project was created locally.');
  }

  function resetDemo() {
    setWorkspace(initialWorkspace);
    setQuery('');
    setStatusFilter('all');
    setFeedback('Demo projects restored.');
  }

  return (
    <section
      id='interface'
      className={styles.section}
      aria-labelledby='product-interface-demo-title'
    >
      <div className={styles.container}>
        <header className={styles.intro}>
          <span className={styles.eyebrow}>Open-source developer showcase</span>
          <h2 id='product-interface-demo-title' className={styles.headline}>
            Vellira Dashboard Starter.
            <span>Real components. Working interface.</span>
          </h2>
          <p className={styles.description}>
            Try a project dashboard built with Vellira Core. Create projects,
            explore overlays, change the theme and inspect an independent React
            + React Native starter. No account required.
          </p>
          <nav className={styles.ctas} aria-label='Try Vellira Dashboard'>
            <Button asChild appearance='solid' color='primary'>
              <a href='#dashboard-live'>Try Live Demo</a>
            </Button>
            <Button asChild appearance='outline' color='neutral'>
              <a href={sourceUrl} target='_blank' rel='noopener noreferrer'>
                View Source
              </a>
            </Button>
            <Button asChild appearance='ghost' color='neutral'>
              <a href={starterUrl} target='_blank' rel='noopener noreferrer'>
                Use This Starter
              </a>
            </Button>
          </nav>
          <p className={styles.freeStatement}>
            Free Core demo · MIT source · Local sample data · No Pro
            subscription
          </p>
        </header>

        <div
          id='dashboard-live'
          className={styles.stage}
          tabIndex={-1}
          aria-label='Interactive Vellira Dashboard Demo'
        >
          <div className={styles.windowBar}>
            <div className={styles.windowDots} aria-hidden='true'>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.windowTitle}>
              Vellira Dashboard Starter
            </span>
            <span className={styles.liveIndicator}>Interactive Core demo</span>
          </div>

          <div className={styles.shell}>
            <aside className={styles.sidebar}>
              <div className={styles.brand}>
                <span className={styles.brandMark} aria-hidden='true'>
                  V
                </span>
                <div>
                  <strong>Vellira</strong>
                  <small>Dashboard Starter</small>
                </div>
              </div>
              <nav className={styles.navigation} aria-label='Demo navigation'>
                {navigationItems.map((item) => (
                  <Button
                    key={item.value}
                    type='button'
                    appearance={view === item.value ? 'soft' : 'ghost'}
                    color={view === item.value ? 'primary' : 'neutral'}
                    className={styles.navigationButton}
                    aria-current={view === item.value ? 'page' : undefined}
                    onClick={() => setView(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
              <div className={styles.sidebarFooter}>
                <span className={styles.statusDot} aria-hidden='true' />
                No backend. Your local demo.
              </div>
            </aside>

            <div className={styles.workspace}>
              <div className={styles.topbar}>
                <div>
                  <span className={styles.sectionLabel}>Workspace</span>
                  <h3>{workspace.name.trim() || 'Untitled workspace'}</h3>
                  <p>Build real applications with Vellira UI.</p>
                </div>
                <Button onClick={openNewProject}>New project</Button>
              </div>

              {feedback && (
                <p role='status' className={styles.notice}>
                  {feedback}
                </p>
              )}

              {view === 'overview' && (
                <div className={styles.content}>
                  <div
                    className={styles.metrics}
                    aria-label='Demo project metrics'
                  >
                    <div className={styles.metric}>
                      <small>Total projects</small>
                      <strong>{workspace.projects.length}</strong>
                      <span>In this local workspace</span>
                    </div>
                    <div className={styles.metric}>
                      <small>In progress</small>
                      <strong>{activeCount}</strong>
                      <span>Active delivery</span>
                    </div>
                    <div className={styles.metric}>
                      <small>Shipped</small>
                      <strong>{shippedCount}</strong>
                      <span>Completed milestones</span>
                    </div>
                  </div>
                  <div className={styles.overviewGrid}>
                    <div className={styles.panel}>
                      <div className={styles.panelTitle}>
                        <div>
                          <span className={styles.sectionLabel}>
                            Latest work
                          </span>
                          <h4>Projects overview</h4>
                        </div>
                        <Button
                          appearance='outline'
                          color='neutral'
                          onClick={() => setView('projects')}
                        >
                          View all
                        </Button>
                      </div>
                      {workspace.projects.slice(0, 4).map((project) => (
                        <div key={project.id} className={styles.projectRow}>
                          <span
                            className={styles.projectInitial}
                            aria-hidden='true'
                          >
                            {project.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className={styles.projectInfo}>
                            <strong>{project.name}</strong>
                            <small>{project.team} team</small>
                          </div>
                          <span
                            className={styles.status}
                            data-status={project.status}
                          >
                            {statusLabels[project.status]}
                          </span>
                        </div>
                      ))}
                      {workspace.projects.length === 0 && (
                        <p className={styles.empty}>
                          Create a project to see it here.
                        </p>
                      )}
                    </div>
                    <div className={styles.panel}>
                      <span className={styles.sectionLabel}>Get started</span>
                      <h4>Everything here uses Core.</h4>
                      <p className={styles.panelText}>
                        These are real Vellira inputs, menus, dialogs and
                        buttons with local state. You can inspect their
                        implementation and use the free packages in your own
                        application.
                      </p>
                      <Button
                        appearance='outline'
                        color='neutral'
                        onClick={() => setView('settings')}
                      >
                        Customize dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'projects' && (
                <div className={styles.content}>
                  <div className={styles.panel}>
                    <div className={styles.panelTitle}>
                      <div>
                        <span className={styles.sectionLabel}>
                          Project manager
                        </span>
                        <h4>Projects</h4>
                      </div>
                      <Button onClick={openNewProject}>Create project</Button>
                    </div>
                    <div className={styles.filters}>
                      <Input
                        label='Search projects'
                        value={query}
                        onValueChange={setQuery}
                        placeholder='Search by name or description'
                      />
                      <Select
                        label='Status filter'
                        value={statusFilter}
                        onValueChange={(value) => {
                          if (
                            typeof value === 'string' &&
                            (value === 'all' || isStatus(value))
                          ) {
                            setStatusFilter(value);
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
                        <div key={project.id} className={styles.projectRow}>
                          <span
                            className={styles.projectInitial}
                            aria-hidden='true'
                          >
                            {project.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className={styles.projectInfo}>
                            <strong>{project.name}</strong>
                            <small>{project.description}</small>
                            <span
                              className={styles.status}
                              data-status={project.status}
                            >
                              {statusLabels[project.status]}
                            </span>
                          </div>
                          <div className={styles.rowActions}>
                            <Checkbox
                              label='Done'
                              checked={project.completed}
                              onCheckedChange={(checked) => {
                                setWorkspace((current) =>
                                  toggleProject(current, project.id, checked)
                                );
                              }}
                            />
                            <Dropdown placement='bottom-end'>
                              <Dropdown.Trigger asChild>
                                <Button appearance='outline' color='neutral'>
                                  Actions
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
                        </div>
                      ))}
                      {projects.length === 0 && (
                        <p className={styles.empty}>No matching projects.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {view === 'settings' && (
                <div className={styles.content}>
                  <div className={styles.panel}>
                    <span className={styles.sectionLabel}>Local settings</span>
                    <h4>Make this demo yours.</h4>
                    <p className={styles.panelText}>
                      No registration, payment or server storage. Changes stay
                      in this browser when localStorage is available.
                    </p>
                    <div className={styles.settingsFields}>
                      <Input
                        label='Workspace name'
                        value={workspace.name}
                        onValueChange={(name) =>
                          setWorkspace((current) => ({ ...current, name }))
                        }
                      />
                      <Checkbox
                        label='Example notifications preference'
                        description='Changes local state only. No emails are sent.'
                        checked={workspace.notifications}
                        onCheckedChange={(notifications) =>
                          setWorkspace((current) => ({
                            ...current,
                            notifications,
                          }))
                        }
                      />
                      <Select
                        label='Theme'
                        value={preference}
                        onValueChange={(value) => {
                          if (
                            value === 'light' ||
                            value === 'dark' ||
                            value === 'high-contrast' ||
                            value === 'system'
                          ) {
                            setPreference(value);
                          }
                        }}
                      >
                        <Select.Item value='light'>Light</Select.Item>
                        <Select.Item value='dark'>Dark</Select.Item>
                        <Select.Item value='high-contrast'>
                          High contrast
                        </Select.Item>
                        <Select.Item value='system'>System</Select.Item>
                      </Select>
                      <p className={styles.hint}>
                        The theme selector uses Vellira tokens and updates this
                        page, not an imaginary Pro design editor.
                      </p>
                      <Button
                        appearance='outline'
                        color='neutral'
                        onClick={resetDemo}
                      >
                        Restore demo data
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <footer className={styles.dashboardFooter}>
                <span>Free Core · React · Sample projects</span>
                <a href={sourceUrl} target='_blank' rel='noopener noreferrer'>
                  Inspect the starter source ↗
                </a>
              </footer>
            </div>
          </div>
        </div>

        <div className={styles.boundary}>
          <p>
            <strong>Core stays free.</strong> This is a functional example built
            with published Vellira primitives and local data.
            Production-oriented application kits, managed team workflows, and
            advanced AI-assisted work belong to future paid layers.
          </p>
          <a href='#pro'>Explore the Pro roadmap →</a>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setNameError('');
        }}
      >
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <div>
                <Modal.Title>Create a project</Modal.Title>
                <Modal.Description>
                  Add a project to the local demo workspace.
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
    </section>
  );
}

ProductInterfaceDemo.displayName = 'ProductInterfaceDemo';
