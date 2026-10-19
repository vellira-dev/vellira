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
type Project = {
  id: number;
  name: string;
  status: Status;
  completed: boolean;
};
type Workspace = {
  name: string;
  notifications: boolean;
  projects: Project[];
};

const storageKey = 'vellira-workspace-native-starter-v1';
const initialWorkspace: Workspace = {
  name: 'Demo Workspace',
  notifications: true,
  projects: [
    { id: 1, name: 'Design token refresh', status: 'active', completed: false },
    { id: 2, name: 'Mobile onboarding', status: 'planned', completed: false },
    { id: 3, name: 'Dashboard rollout', status: 'shipped', completed: true },
  ],
};

function isSection(value: string): value is Section {
  return value === 'overview' || value === 'projects' || value === 'settings';
}

function isStatus(value: string): value is Status {
  return value === 'planned' || value === 'active' || value === 'shipped';
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
      typeof item.completed !== 'boolean'
    ) {
      return null;
    }
    ids.add(item.id);
  }
  return data as Workspace;
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
  const [name, setName] = useState('');
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
    padding: 18,
    borderRadius: 18,
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
      project.name.toLowerCase().includes(query.trim().toLowerCase())
    );
  });

  function createProject() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a project name.');
      return;
    }
    setData((current) => ({
      ...current,
      projects: [
        {
          id: nextId(current.projects),
          name: trimmed,
          status: 'planned',
          completed: false,
        },
        ...current.projects,
      ],
    }));
    setName('');
    setError('');
    setCreateOpen(false);
    setSection('projects');
    setNotice('Project created in your local workspace.');
  }

  function toggleProject(id: number, completed: boolean) {
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              completed,
              status: completed ? 'shipped' : 'active',
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
            name: project.name + ' copy',
            completed: false,
            status: 'planned',
          },
          ...current.projects,
        ],
      };
    });
    setNotice('Project duplicated.');
  }

  function deleteProject(id: number) {
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
        contentContainerStyle={{ gap: 22, padding: 20, paddingBottom: 55 }}
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
          <Button onPress={() => setCreateOpen(true)}>New project</Button>
        </View>

        {notice ? (
          <Text accessibilityLiveRegion='polite' style={{ color: mainText }}>
            {notice}
          </Text>
        ) : null}

        <Tabs
          value={section}
          onValueChange={(value) => {
            if (isSection(value)) setSection(value);
          }}
        >
          <Tabs.List scrollable>
            <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
            <Tabs.Trigger value='projects'>Projects</Tabs.Trigger>
            <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value='overview'>
            <View style={{ gap: 14, paddingTop: 20 }}>
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
                    <Text style={{ color: subtleText }}>
                      {project.status}
                    </Text>
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
            <View style={{ gap: 16, paddingTop: 20 }}>
              <Input
                label='Search projects'
                value={query}
                onValueChange={setQuery}
                placeholder='Project name'
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
                  </View>
                  <Checkbox
                    label='Mark completed'
                    checked={project.completed}
                    onCheckedChange={(value) =>
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
                <Text style={{ color: subtleText }}>
                  No matching projects.
                </Text>
              )}
            </View>
          </Tabs.Content>

          <Tabs.Content value='settings'>
            <View style={{ paddingTop: 20, gap: 16 }}>
              <View style={cardStyle}>
                <Text
                  style={{ fontWeight: '700', fontSize: 22, color: mainText }}
                >
                  Workspace settings
                </Text>
                <Input
                  label='Workspace name'
                  value={data.name}
                  onValueChange={(next) =>
                    setData((current) => ({ ...current, name: next }))
                  }
                />
                <Checkbox
                  label='Product notifications'
                  description='Local preference only; no emails are sent.'
                  checked={data.notifications}
                  onCheckedChange={(notifications) =>
                    setData((current) => ({ ...current, notifications }))
                  }
                />
                <View style={{ gap: 8 }}>
                  <Text style={{ color: mainText, fontWeight: '600' }}>
                    Appearance
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(['light', 'dark', 'highContrast'] as const).map(
                      (option) => (
                        <Button
                          key={option}
                          appearance={
                            themeName === option ? 'solid' : 'outline'
                          }
                          color={
                            themeName === option ? 'primary' : 'neutral'
                          }
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
                  onPress={() => {
                    setData(initialWorkspace);
                    setTheme('light');
                    setNotice('Sample data restored.');
                  }}
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

      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError('');
        }}
      >
        <Modal.Overlay>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Create a project</Modal.Title>
              <Modal.Description>Local project, no backend.</Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <Input
                label='Project name'
                value={name}
                error={error || undefined}
                onValueChange={(value) => {
                  setName(value);
                  setError('');
                }}
                placeholder='New project name'
              />
            </Modal.Body>
            <Modal.Footer>
              <Button
                appearance='outline'
                color='neutral'
                onPress={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onPress={createProject}>Create project</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Overlay>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [theme, setTheme] = useState<NativeTheme>('light');

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme} onThemeChange={setTheme}>
        <WorkspaceScreen />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
