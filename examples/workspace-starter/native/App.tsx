import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  Tabs,
  ThemeProvider,
  useTheme,
} from '@vellira-ui/react-native';

type NativeTheme = 'light' | 'dark' | 'highContrast';
type Section = 'overview' | 'projects' | 'settings';
type Status = 'planned' | 'active' | 'shipped';
type Team = 'design' | 'platform' | 'mobile';
type Project = {
  id: number;
  name: string;
  description: string;
  team: Team;
  status: Status;
  completed: boolean;
  previousStatus?: 'planned' | 'active';
};
type Workspace = {
  name: string;
  notifications: boolean;
  projects: Project[];
};

const storageKey = 'vellira-workspace-native-starter-v1';
const themeStorageKey = 'vellira-workspace-native-theme-v1';
const initialWorkspace: Workspace = {
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

function isSection(value: string): value is Section {
  return value === 'overview' || value === 'projects' || value === 'settings';
}

function isStatus(value: string): value is Status {
  return value === 'planned' || value === 'active' || value === 'shipped';
}

function isTeam(value: unknown): value is Team {
  return value === 'design' || value === 'platform' || value === 'mobile';
}

function restoreWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<Workspace>;
  if (
    typeof data.name !== 'string' ||
    typeof data.notifications !== 'boolean' ||
    !Array.isArray(data.projects)
  ) {
    return null;
  }
  const ids = new Set<number>();
  for (const item of data.projects) {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      !isStatus(item.status) ||
      typeof item.completed !== 'boolean' ||
      (item.description !== undefined &&
        typeof item.description !== 'string') ||
      (item.team !== undefined && !isTeam(item.team)) ||
      (item.previousStatus !== undefined &&
        item.previousStatus !== 'planned' &&
        item.previousStatus !== 'active')
    ) {
      return null;
    }
    ids.add(item.id);
  }
  // Previously saved projects lacked a team and description.
  return {
    ...(data as Workspace),
    projects: data.projects.map((item) => ({
      ...item,
      description: item.description ?? '',
      team: item.team ?? 'design',
    })),
  };
}

function nextId(projects: readonly Project[]): number {
  return projects.reduce((max, project) => Math.max(max, project.id), 0) + 1;
}

function WorkspaceScreen() {
  const { theme, themeName, setTheme } = useTheme();
  const [data, setData] = useState<Workspace>(initialWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [removedProject, setRemovedProject] = useState<Project | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [team, setTeam] = useState<Team>('design');
  const [status, setStatus] = useState<Status>('planned');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (!mounted || !value) return;
        const restored = restoreWorkspace(JSON.parse(value));
        if (restored) setData(restored);
      })
      .catch(() => {
        // The example continues with in-memory state if storage is unavailable.
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(data)).catch(() => {
      // In-memory interactions remain available.
    });
  }, [loaded, data]);

  const surface = theme.semantic.surface;
  const border = theme.semantic.border.muted;
  const mainText = theme.semantic.text.primary;
  const subtleText = theme.semantic.text.subtle;
  const cardStyle = {
    padding: 14,
    borderRadius: theme.tokens.radius.lg,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: surface.subtle,
    gap: 14,
  } as const;

  const visibleProjects = data.projects.filter((project) => {
    const sameStatus =
      statusFilter === 'all' || project.status === statusFilter;
    return (
      sameStatus &&
      (project.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        project.description.toLowerCase().includes(query.trim().toLowerCase()))
    );
  });

  function openCreate() {
    setEditingId(null);
    setName('');
    setDescription('');
    setTeam('design');
    setStatus('planned');
    setError('');
    setCreateOpen(true);
  }

  function openEdit(project: Project) {
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.description);
    setTeam(project.team);
    setStatus(project.status);
    setError('');
    setCreateOpen(true);
  }

  function saveProject() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a project name.');
      return;
    }
    setData((current) => ({
      ...current,
      projects:
        editingId === null
          ? [
              {
                id: nextId(current.projects),
                name: trimmed,
                description: description.trim(),
                team,
                status,
                completed: status === 'shipped',
                previousStatus: status === 'shipped' ? 'active' : undefined,
              },
              ...current.projects,
            ]
          : current.projects.map((project) =>
              project.id === editingId
                ? {
                    ...project,
                    name: trimmed,
                    description: description.trim(),
                    team,
                    status,
                    completed: status === 'shipped',
                    previousStatus:
                      status === 'shipped'
                        ? (project.previousStatus ??
                          (project.status === 'planned' ? 'planned' : 'active'))
                        : undefined,
                  }
                : project
            ),
    }));
    setCreateOpen(false);
    setRemovedProject(null);
    setSection('projects');
    setNotice(
      editingId === null
        ? 'Project created locally.'
        : 'Project updated locally.'
    );
  }

  function toggleProject(id: number, completed: boolean) {
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              completed,
              status: completed
                ? 'shipped'
                : (project.previousStatus ?? 'active'),
              previousStatus: completed
                ? project.status === 'shipped'
                  ? (project.previousStatus ?? 'active')
                  : project.status
                : undefined,
            }
          : project
      ),
    }));
  }

  function duplicateProject(id: number) {
    setData((current) => {
      const project = current.projects.find((item) => item.id === id);
      if (!project) return current;
      return {
        ...current,
        projects: [
          {
            ...project,
            id: nextId(current.projects),
            name: project.name.replace(/(?: copy)+$/i, '') + ' copy',
            completed: false,
            status: 'planned',
            previousStatus: undefined,
          },
          ...current.projects,
        ],
      };
    });
    setRemovedProject(null);
    setNotice('Project duplicated.');
  }

  function deleteProject(id: number) {
    const selected = data.projects.find((project) => project.id === id);
    if (!selected) return;
    setRemovedProject(selected);
    setData((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
    }));
    setNotice('Project removed.');
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: surface.canvas }}
      edges={['top', 'bottom']}
    >
      <ScrollView
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 40 }}
      >
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole='header'
            style={{
              color: mainText,
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '700',
            }}
          >
            {data.name.trim() || 'Untitled workspace'}
          </Text>
          <Text style={{ color: subtleText }}>
            A real React Native interface built with Vellira.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button
            appearance='outline'
            color='neutral'
            onPress={() => setTheme(themeName === 'light' ? 'dark' : 'light')}
          >
            {themeName === 'light' ? 'Dark theme' : 'Light theme'}
          </Button>
          <Button onPress={openCreate}>New project</Button>
        </View>

        {notice ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text accessibilityLiveRegion='polite' style={{ color: mainText }}>
              {notice}
            </Text>
            {removedProject ? (
              <Button
                appearance='ghost'
                onPress={() => {
                  setData((current) =>
                    current.projects.some(
                      (item) => item.id === removedProject.id
                    )
                      ? current
                      : {
                          ...current,
                          projects: [removedProject, ...current.projects],
                        }
                  );
                  setRemovedProject(null);
                  setNotice('Project restored.');
                }}
              >
                Undo
              </Button>
            ) : null}
            <Button appearance='ghost' color='neutral' onPress={() => { setNotice(''); setRemovedProject(null); }}>Dismiss</Button>
          </View>
        ) : null}

        <Tabs
          value={section}
          onValueChange={(value: string) => {
            if (isSection(value)) setSection(value);
          }}
        >
          <Tabs.List scrollable>
            <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
            <Tabs.Trigger value='projects'>Projects</Tabs.Trigger>
            <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value='overview'>
            <View style={{ gap: 14, paddingTop: 4 }}>
              <View style={cardStyle}>
                <Text style={{ color: subtleText }}>PROJECTS</Text>
                <Text
                  style={{
                    color: mainText,
                    fontSize: 36,
                    fontWeight: '700',
                  }}
                >
                  {data.projects.length}
                </Text>
                <Text style={{ color: subtleText }}>
                  {data.projects.filter((item) => item.completed).length}{' '}
                  completed
                </Text>
              </View>
              <View style={cardStyle}>
                <Text
                  style={{ color: mainText, fontSize: 21, fontWeight: '700' }}
                >
                  Your delivery pipeline
                </Text>
                {data.projects.map((project) => (
                  <View key={project.id} style={{ gap: 4 }}>
                    <Text style={{ color: mainText, fontWeight: '600' }}>
                      {project.name}
                    </Text>
                    <Text style={{ color: subtleText }}>{project.status}</Text>
                  </View>
                ))}
                {data.projects.length === 0 && (
                  <Text style={{ color: subtleText }}>
                    Create your first project.
                  </Text>
                )}
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => setSection('projects')}
                >
                  Manage projects
                </Button>
              </View>
            </View>
          </Tabs.Content>

          <Tabs.Content value='projects'>
            <View style={{ gap: 14, paddingTop: 4 }}>
              <Input
                label='Search projects'
                value={query}
                onValueChange={setQuery}
                placeholder='Project name'
              />
              <Select
                label='Status filter'
                value={statusFilter}
                onValueChange={(value: string | null) => {
                  if (
                    typeof value === 'string' &&
                    (value === 'all' || isStatus(value))
                  ) {
                    setStatusFilter(value);
                  }
                }}
                presentation='modal'
              >
                <Select.Item value='all' label='All statuses' />
                <Select.Item value='planned' label='Planned' />
                <Select.Item value='active' label='In progress' />
                <Select.Item value='shipped' label='Shipped' />
              </Select>

              {visibleProjects.map((project) => (
                <View key={project.id} style={cardStyle}>
                  <View style={{ gap: 5 }}>
                    <Text
                      style={{
                        color: mainText,
                        fontSize: 18,
                        fontWeight: '700',
                      }}
                    >
                      {project.name}
                    </Text>
                    <Text style={{ color: subtleText }}>{project.status}</Text>
                    <Text style={{ color: subtleText }}>
                      {project.description}
                    </Text>
                  </View>
                  <Checkbox
                    label='Mark completed'
                    checked={project.completed}
                    onCheckedChange={(value: boolean) =>
                      toggleProject(project.id, value)
                    }
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <Button
                      appearance='outline'
                      color='neutral'
                      onPress={() => openEdit(project)}
                    >
                      Edit
                    </Button>
                    <Button
                      appearance='outline'
                      color='neutral'
                      onPress={() => duplicateProject(project.id)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      appearance='ghost'
                      color='danger'
                      onPress={() => deleteProject(project.id)}
                    >
                      Remove
                    </Button>
                  </View>
                </View>
              ))}
              {visibleProjects.length === 0 && (
                <Text style={{ color: subtleText }}>No matching projects.</Text>
              )}
            </View>
          </Tabs.Content>

          <Tabs.Content value='settings'>
            <View style={{ paddingTop: 4, gap: 16 }}>
              <View style={cardStyle}>
                <Text
                  style={{ fontWeight: '700', fontSize: 22, color: mainText }}
                >
                  Workspace settings
                </Text>
                <Input
                  label='Workspace name'
                  value={data.name}
                  onValueChange={(next: string) =>
                    setData((current) => ({ ...current, name: next }))
                  }
                />
                <Checkbox
                  label='Product notifications'
                  description='Local preference only; no emails are sent.'
                  checked={data.notifications}
                  onCheckedChange={(notifications: boolean) =>
                    setData((current) => ({ ...current, notifications }))
                  }
                />
                <View style={{ gap: 8 }}>
                  <Text style={{ color: mainText, fontWeight: '600' }}>
                    Appearance
                  </Text>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    {(['light', 'dark', 'highContrast'] as const).map(
                      (option) => (
                        <Button
                          key={option}
                          appearance={
                            themeName === option ? 'solid' : 'outline'
                          }
                          color={themeName === option ? 'primary' : 'neutral'}
                          onPress={() => setTheme(option)}
                        >
                          {option === 'highContrast'
                            ? 'High contrast'
                            : option === 'light'
                              ? 'Light'
                              : 'Dark'}
                        </Button>
                      )
                    )}
                  </View>
                </View>
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => setResetOpen(true)}
                >
                  Restore sample data
                </Button>
              </View>
            </View>
          </Tabs.Content>
        </Tabs>

        <View style={{ gap: 6, paddingTop: 15 }}>
          <Text style={{ color: subtleText, fontSize: 12 }}>
            Vellira Dashboard Starter · React Native
          </Text>
          <Text style={{ color: subtleText, fontSize: 12 }}>
            Offline UI example. No account or backend required.
          </Text>
        </View>
      </ScrollView>

      <Modal open={resetOpen} onOpenChange={setResetOpen}>
        <Modal.Overlay>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Restore sample data?</Modal.Title>
              <Modal.Description>
                This replaces saved projects and settings. It cannot be undone.
              </Modal.Description>
            </Modal.Header>
            <Modal.Footer>
              <Button
                appearance='outline'
                color='neutral'
                onPress={() => setResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color='danger'
                onPress={() => {
                  setData(initialWorkspace);
                  setRemovedProject(null);
                  setTheme('light');
                  setResetOpen(false);
                  setNotice('Sample data restored.');
                }}
              >
                Restore data
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Overlay>
      </Modal>

      <Modal
        open={createOpen}
        onOpenChange={(open: boolean) => {
          setCreateOpen(open);
          if (!open) setError('');
        }}
      >
        <Modal.Overlay>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>
                {editingId === null ? 'Create a project' : 'Edit project'}
              </Modal.Title>
              <Modal.Description>
                Changes stay on this device.
              </Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <Input
                label='Project name'
                value={name}
                error={error || undefined}
                onValueChange={(value: string) => {
                  setName(value);
                  setError('');
                }}
                placeholder='New project name'
              />
              <Input
                label='Description'
                value={description}
                onValueChange={setDescription}
                placeholder='Describe the project'
              />
              <Select
                label='Team'
                value={team}
                onValueChange={(value: string | null) => {
                  if (isTeam(value)) setTeam(value);
                }}
                presentation='modal'
              >
                <Select.Item value='design' label='Design' />
                <Select.Item value='platform' label='Platform' />
                <Select.Item value='mobile' label='Mobile' />
              </Select>
              <Select
                label='Status'
                value={status}
                onValueChange={(value: string | null) => {
                  if (typeof value === 'string' && isStatus(value)) {
                    setStatus(value);
                  }
                }}
                presentation='modal'
              >
                <Select.Item value='planned' label='Planned' />
                <Select.Item value='active' label='In progress' />
                <Select.Item value='shipped' label='Shipped' />
              </Select>
            </Modal.Body>
            <Modal.Footer>
              <Button
                appearance='outline'
                color='neutral'
                onPress={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onPress={saveProject}>
                {editingId === null ? 'Create project' : 'Save changes'}
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Overlay>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [theme, setTheme] = useState<NativeTheme>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(themeStorageKey)
      .then((saved) => {
        if (!mounted) return;
        if (saved === 'light' || saved === 'dark' || saved === 'highContrast') {
          setTheme(saved);
        }
      })
      .catch(() => {
        // Defaults still work when persistence is unavailable.
      })
      .finally(() => {
        if (mounted) setThemeLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    AsyncStorage.setItem(themeStorageKey, theme).catch(() => {
      // Theme switching remains usable without persistence.
    });
  }, [theme, themeLoaded]);

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme} onThemeChange={setTheme}>
        <WorkspaceScreen />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
