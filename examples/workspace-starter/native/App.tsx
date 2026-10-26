import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
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
  const [actionProjectId, setActionProjectId] = useState<number | null>(null);
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

  const actionProject = data.projects.find(
    (item) => item.id === actionProjectId
  );
  const completedCount = data.projects.filter((item) => item.completed).length;
  const activeCount = data.projects.filter(
    (item) => item.status === 'active'
  ).length;
  const accent = theme.semantic.text.primary;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: surface.canvas }}
      edges={['top', 'bottom']}
    >
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 12,
          gap: 4,
          borderBottomWidth: 1,
          borderColor: border,
        }}
      >
        <Text
          style={{
            color: subtleText,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.2,
          }}
        >
          VELLIRA / WORKSPACE
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole='header'
              numberOfLines={1}
              style={{
                color: mainText,
                fontSize: 27,
                lineHeight: 34,
                fontWeight: '700',
              }}
            >
              {section === 'overview'
                ? 'Overview'
                : section === 'projects'
                  ? 'Projects'
                  : 'Settings'}
            </Text>
            <Text numberOfLines={1} style={{ color: subtleText, fontSize: 13 }}>
              {data.name.trim() || 'Untitled workspace'}
            </Text>
          </View>
          {section !== 'settings' ? (
            <Button onPress={openCreate}>+ New</Button>
          ) : null}
        </View>
      </View>

      <ScrollView
        key={section}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        {notice ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderWidth: 1,
              borderColor: border,
              borderRadius: theme.tokens.radius.md,
            }}
          >
            <Text
              accessibilityLiveRegion='polite'
              style={{ color: mainText, flexGrow: 1, flexShrink: 1 }}
            >
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
            <Button
              appearance='ghost'
              color='neutral'
              onPress={() => {
                setNotice('');
                setRemovedProject(null);
              }}
            >
              Dismiss
            </Button>
          </View>
        ) : null}

        {section === 'overview' ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: mainText, fontSize: 20, fontWeight: '700' }}>
              Your workspace at a glance
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Total', value: data.projects.length },
                { label: 'In progress', value: activeCount },
                { label: 'Completed', value: completedCount },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: border,
                    borderRadius: theme.tokens.radius.lg,
                    backgroundColor: surface.subtle,
                    gap: 6,
                  }}
                >
                  <Text
                    style={{ color: mainText, fontSize: 28, fontWeight: '700' }}
                  >
                    {metric.value}
                  </Text>
                  <Text style={{ color: subtleText, fontSize: 12 }}>
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={cardStyle}>
              <Text
                style={{ color: mainText, fontSize: 18, fontWeight: '700' }}
              >
                Recent projects
              </Text>
              {data.projects.slice(0, 4).map((project) => (
                <Pressable
                  key={project.id}
                  accessibilityRole='button'
                  accessibilityLabel={`View ${project.name} in Projects`}
                  onPress={() => {
                    setQuery(project.name);
                    setStatusFilter('all');
                    setSection('projects');
                  }}
                  style={{
                    minHeight: 48,
                    gap: 3,
                    justifyContent: 'center',
                    borderTopWidth: 1,
                    borderColor: border,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: mainText, fontWeight: '600' }}
                  >
                    {project.name}
                  </Text>
                  <Text style={{ color: subtleText, fontSize: 12 }}>
                    {project.status} · {project.team}
                  </Text>
                </Pressable>
              ))}
              {data.projects.length === 0 ? (
                <Text style={{ color: subtleText }}>
                  No projects yet. Create your first one.
                </Text>
              ) : null}
              <Button
                appearance='outline'
                color='neutral'
                onPress={() => {
                  setQuery('');
                  setStatusFilter('all');
                  setSection('projects');
                }}
              >
                See all projects
              </Button>
            </View>
          </View>
        ) : null}

        {section === 'projects' ? (
          <View style={{ gap: 12 }}>
            <Input
              label='Search projects'
              value={query}
              onValueChange={setQuery}
              placeholder='Search by name or description'
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {(
                [
                  ['all', 'All'],
                  ['planned', 'Planned'],
                  ['active', 'In progress'],
                  ['shipped', 'Shipped'],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole='button'
                  accessibilityState={{ selected: statusFilter === value }}
                  accessibilityLabel={`Filter: ${label}`}
                  onPress={() => setStatusFilter(value)}
                  style={{
                    paddingHorizontal: 16,
                    minHeight: 44,
                    justifyContent: 'center',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: statusFilter === value ? accent : border,
                    backgroundColor:
                      statusFilter === value ? surface.subtle : surface.canvas,
                  }}
                >
                  <Text
                    style={{
                      color: mainText,
                      fontWeight: statusFilter === value ? '700' : '500',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={{ color: subtleText, fontSize: 12 }}>
              {visibleProjects.length}{' '}
              {visibleProjects.length === 1 ? 'project' : 'projects'}
            </Text>
            {visibleProjects.map((project) => (
              <View key={project.id} style={{ ...cardStyle, gap: 10 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <Text
                      style={{
                        color: mainText,
                        fontSize: 17,
                        fontWeight: '700',
                      }}
                    >
                      {project.name}
                    </Text>
                    <Text style={{ color: subtleText, fontSize: 12 }}>
                      {project.status === 'active'
                        ? 'In progress'
                        : project.status === 'shipped'
                          ? 'Shipped'
                          : 'Planned'}{' '}
                      · {project.team}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole='button'
                    accessibilityLabel={`Actions for ${project.name}`}
                    accessibilityHint='Edit, duplicate, or remove this project'
                    onPress={() => setActionProjectId(project.id)}
                    hitSlop={8}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <Text style={{ fontSize: 23, color: mainText }}>⋯</Text>
                  </Pressable>
                </View>
                {project.description ? (
                  <Text
                    numberOfLines={2}
                    style={{ color: subtleText, lineHeight: 20 }}
                  >
                    {project.description}
                  </Text>
                ) : null}
                <Checkbox
                  label='Mark completed'
                  checked={project.completed}
                  onCheckedChange={(value: boolean) =>
                    toggleProject(project.id, value)
                  }
                />
              </View>
            ))}
            {visibleProjects.length === 0 ? (
              <View style={{ ...cardStyle, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: mainText, fontWeight: '700' }}>
                  No matching projects
                </Text>
                <Text style={{ color: subtleText, textAlign: 'center' }}>
                  Try another search or clear the status filter.
                </Text>
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {section === 'settings' ? (
          <View style={{ gap: 14 }}>
            <View style={cardStyle}>
              <Text
                style={{ color: mainText, fontSize: 18, fontWeight: '700' }}
              >
                Workspace
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
            </View>
            <View style={cardStyle}>
              <Text
                style={{ color: mainText, fontSize: 18, fontWeight: '700' }}
              >
                Appearance
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['light', 'dark', 'highContrast'] as const).map((option) => (
                  <Button
                    key={option}
                    appearance={themeName === option ? 'solid' : 'outline'}
                    color={themeName === option ? 'primary' : 'neutral'}
                    onPress={() => setTheme(option)}
                  >
                    {option === 'highContrast'
                      ? 'High contrast'
                      : option === 'light'
                        ? 'Light'
                        : 'Dark'}
                  </Button>
                ))}
              </View>
            </View>
            <Button
              appearance='outline'
              color='danger'
              onPress={() => setResetOpen(true)}
            >
              Restore sample data
            </Button>
            <Text
              style={{ color: subtleText, textAlign: 'center', fontSize: 12 }}
            >
              Vellira Native Starter · Offline demo
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        accessibilityRole='tablist'
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderColor: border,
          paddingHorizontal: 8,
          paddingTop: 7,
          paddingBottom: 4,
          backgroundColor: surface.canvas,
        }}
      >
        {(
          [
            ['overview', 'Overview', '⌂'],
            ['projects', 'Projects', '▦'],
            ['settings', 'Settings', '⚙'],
          ] as const
        ).map(([value, label, glyph]) => (
          <Pressable
            key={value}
            accessibilityRole='tab'
            accessibilityLabel={label}
            accessibilityState={{ selected: section === value }}
            onPress={() => setSection(value)}
            style={{
              flex: 1,
              minHeight: 54,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              borderRadius: theme.tokens.radius.md,
              backgroundColor:
                section === value ? surface.subtle : surface.canvas,
            }}
          >
            <Text style={{ color: mainText, fontSize: 21 }}>{glyph}</Text>
            <Text
              style={{
                color: mainText,
                fontSize: 11,
                fontWeight: section === value ? '700' : '500',
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal
        open={actionProjectId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setActionProjectId(null);
        }}
      >
        <Modal.Overlay>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Project actions</Modal.Title>
              <Modal.Description>
                {actionProject?.name ?? 'Select an action'}
              </Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <View style={{ gap: 12 }}>
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => {
                    if (actionProject) openEdit(actionProject);
                    setActionProjectId(null);
                  }}
                >
                  Edit project
                </Button>
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => {
                    if (actionProject) duplicateProject(actionProject.id);
                    setActionProjectId(null);
                  }}
                >
                  Duplicate project
                </Button>
                <Button
                  color='danger'
                  onPress={() => {
                    if (actionProject) deleteProject(actionProject.id);
                    setActionProjectId(null);
                  }}
                >
                  Remove project
                </Button>
              </View>
            </Modal.Body>
            <Modal.Footer>
              <Button
                appearance='outline'
                color='neutral'
                onPress={() => setActionProjectId(null)}
              >
                Cancel
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Overlay>
      </Modal>

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
