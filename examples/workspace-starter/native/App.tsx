import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Filter,
  Folder,
  Grid,
  MoreHorizontal,
  Plus,
  Settings,
  Search,
} from '@vellira-ui/icons';
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
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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
      (project.name
        .toLowerCase()
        .includes((showSearch ? query : '').trim().toLowerCase()) ||
        project.description
          .toLowerCase()
          .includes((showSearch ? query : '').trim().toLowerCase()))
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

  const completedCount = data.projects.filter((item) => item.completed).length;
  const totalCount = data.projects.length;
  const completionRate = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;
  const palette =
    themeName === 'dark'
      ? {
          brand: '#B39AFF',
          brandBg: '#33284C',
          brandBorder: '#655095',
          success: '#79DCAB',
          successBg: '#203B34',
          successBorder: '#357356',
          amber: '#FFD07D',
          track: '#332D42',
        }
      : themeName === 'highContrast'
        ? {
            brand: '#6434C7',
            brandBg: '#FFFFFF',
            brandBorder: '#6434C7',
            success: '#006C46',
            successBg: '#FFFFFF',
            successBorder: '#006C46',
            amber: '#996000',
            track: '#D2CADE',
          }
        : {
            brand: '#7050ED',
            brandBg: '#F2ECFF',
            brandBorder: '#DCCFFF',
            success: '#087B55',
            successBg: '#EAF9F1',
            successBorder: '#B8E7D0',
            amber: '#C7831B',
            track: '#F0ECF8',
          };
  const statuses = [
    {
      key: 'planned',
      name: 'Planned',
      count: data.projects.filter((p) => p.status === 'planned').length,
      color: '#B8A5FA',
    },
    {
      key: 'active',
      name: 'In progress',
      count: data.projects.filter((p) => p.status === 'active').length,
      color: palette.amber,
    },
    {
      key: 'shipped',
      name: 'Shipped',
      count: data.projects.filter((p) => p.status === 'shipped').length,
      color: palette.brand,
    },
  ];
  const chartMax = Math.max(
    4,
    Math.ceil(Math.max(...statuses.map((item) => item.count)) / 4) * 4
  );
  const chartColor = themeName === 'dark' ? '#85B6FF' : '#5797F6';
  function showProjectActions(project: Project) {
    const edit = () => openEdit(project);
    const duplicate = () => duplicateProject(project.id);
    const remove = () => deleteProject(project.id);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: project.name,
          options: ['Cancel', 'Edit', 'Duplicate', 'Remove'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) edit();
          if (buttonIndex === 2) duplicate();
          if (buttonIndex === 3) remove();
        }
      );
      return;
    }
    // Android fallback uses platform-native actions pending a verified anchored menu.
    Alert.alert(project.name, 'Choose an action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: edit },
      { text: 'Duplicate', onPress: duplicate },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  }

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
                ? 'Dashboard'
                : section === 'projects'
                  ? 'Projects'
                  : 'Settings'}
            </Text>
            <Text numberOfLines={1} style={{ color: subtleText, fontSize: 13 }}>
              {data.name.trim() || 'Untitled workspace'}
            </Text>
          </View>
          {section !== 'settings' ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Create project'
              onPress={openCreate}
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                backgroundColor: palette.brand,
              }}
            >
              <Plus size={24} color='#FFFFFF' />
            </Pressable>
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
          <View style={{ gap: 18 }}>
            <Text style={{ color: subtleText, fontSize: 15 }}>
              Your projects at a glance
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[
                {
                  label: 'Total projects',
                  value: totalCount,
                  caption: 'All projects',
                  bg: palette.brandBg,
                  outline: palette.brandBorder,
                  accent: palette.brand,
                },
                {
                  label: 'Completed',
                  value: completedCount,
                  caption: completionRate + '% completion',
                  bg: palette.successBg,
                  outline: palette.successBorder,
                  accent: palette.success,
                },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: 16,
                    borderRadius: theme.tokens.radius.lg,
                    backgroundColor: metric.bg,
                    borderWidth: 1,
                    borderColor: metric.outline,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: metric.accent,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {metric.label}
                  </Text>
                  <Text
                    style={{ color: mainText, fontSize: 35, fontWeight: '700' }}
                  >
                    {metric.value}
                  </Text>
                  <Text style={{ color: subtleText, fontSize: 12 }}>
                    {metric.caption}
                  </Text>
                </View>
              ))}
            </View>
            <View style={cardStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{ color: mainText, fontSize: 19, fontWeight: '700' }}
                >
                  Project progress
                </Text>
                <Text style={{ color: palette.brand, fontWeight: '700' }}>
                  {completionRate}%
                </Text>
              </View>
              <View
                accessibilityLabel={
                  completedCount + ' of ' + totalCount + ' projects completed'
                }
                style={{
                  height: 14,
                  borderRadius: 7,
                  overflow: 'hidden',
                  backgroundColor: palette.track,
                }}
              >
                <View
                  style={{
                    width: (completionRate + '%') as `${number}%`,
                    height: '100%',
                    backgroundColor: palette.brand,
                    borderRadius: 7,
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text style={{ color: subtleText, fontSize: 12 }}>
                  Completed · {completedCount}
                </Text>
                <Text style={{ color: subtleText, fontSize: 12 }}>
                  Remaining · {totalCount - completedCount}
                </Text>
              </View>
            </View>
            <View style={cardStyle}>
              <Text
                style={{ color: mainText, fontSize: 19, fontWeight: '700' }}
              >
                Projects by status
              </Text>
              <View
                accessibilityLabel={
                  'Projects by status: ' +
                  statuses
                    .map((item) => item.name + ' ' + item.count)
                    .join(', ')
                }
                style={{ gap: 10 }}
              >
                <View style={{ flexDirection: 'row', height: 214, gap: 8 }}>
                  <View
                    style={{
                      width: 25,
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                    }}
                  >
                    {[4, 3, 2, 1, 0].map((tick) => (
                      <Text
                        key={tick}
                        style={{ color: subtleText, fontSize: 11 }}
                      >
                        {(chartMax * tick) / 4}
                      </Text>
                    ))}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      position: 'relative',
                      height: 200,
                      marginTop: 7,
                    }}
                  >
                    {[0, 1, 2, 3, 4].map((tick) => (
                      <View
                        key={tick}
                        style={{
                          position: 'absolute',
                          top: tick * 50,
                          left: 0,
                          right: 0,
                          borderTopWidth: 1,
                          borderColor: border,
                          opacity: 0.6,
                        }}
                      />
                    ))}
                    <View
                      style={{
                        flexDirection: 'row',
                        flex: 1,
                        justifyContent: 'space-around',
                        alignItems: 'flex-end',
                      }}
                    >
                      {statuses.map((status) => (
                        <View
                          key={status.key}
                          style={{
                            width: '23%',
                            height: '100%',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
                          {status.count > 0 ? (
                            <View
                              style={{
                                width: '100%',
                                height: ((status.count / chartMax) * 100 +
                                  '%') as `${number}%`,
                                backgroundColor: chartColor,
                                borderRadius: 9,
                                borderBottomLeftRadius: 3,
                                borderBottomRightRadius: 3,
                              }}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <View
                  style={{
                    marginLeft: 33,
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                  }}
                >
                  {statuses.map((status) => (
                    <Text
                      key={status.key}
                      numberOfLines={2}
                      style={{
                        width: '31%',
                        textAlign: 'center',
                        color: subtleText,
                        fontSize: 12,
                      }}
                    >
                      {status.name}
                    </Text>
                  ))}
                </View>
              </View>
              {totalCount === 0 ? (
                <Text style={{ color: subtleText }}>
                  Create your first project to populate the chart.
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {section === 'projects' ? (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{ color: mainText, fontSize: 17, fontWeight: '700' }}
              >
                All projects · {visibleProjects.length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Search projects'
                  accessibilityState={{ expanded: showSearch }}
                  onPress={() => {
                    setShowSearch(!showSearch);
                    if (showSearch) setQuery('');
                  }}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Search size={22} color={mainText} />
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Filter projects'
                  accessibilityState={{ expanded: showFilters }}
                  onPress={() => setShowFilters(!showFilters)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Filter size={22} color={mainText} />
                </Pressable>
              </View>
            </View>
            {showSearch ? (
              <Input
                label='Search projects'
                value={query}
                onValueChange={setQuery}
                placeholder='Search projects'
              />
            ) : null}
            {showFilters ? (
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
                    onPress={() => setStatusFilter(value)}
                    style={{
                      paddingHorizontal: 15,
                      minHeight: 44,
                      justifyContent: 'center',
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: statusFilter === value ? mainText : border,
                      backgroundColor:
                        statusFilter === value
                          ? surface.subtle
                          : surface.canvas,
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
            ) : null}
            {visibleProjects.map((project) => (
              <View
                key={project.id}
                style={{
                  backgroundColor: surface.subtle,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: theme.tokens.radius.lg,
                  padding: 12,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View
                    accessibilityLabel={'Team: ' + project.team}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: surface.canvas,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: mainText,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {project.team === 'design'
                        ? 'DS'
                        : project.team === 'mobile'
                          ? 'MB'
                          : 'PL'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole='button'
                    accessibilityLabel={'Edit ' + project.name}
                    onPress={() => openEdit(project)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      justifyContent: 'center',
                      gap: 4,
                      minHeight: 44,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: mainText,
                        fontSize: 15,
                        fontWeight: '700',
                      }}
                    >
                      {project.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: subtleText, fontSize: 12 }}
                    >
                      {project.description || 'No description'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole='button'
                    accessibilityLabel={'Actions for ' + project.name}
                    onPress={() => showProjectActions(project)}
                    hitSlop={8}
                    style={{
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MoreHorizontal size={24} color={mainText} />
                  </Pressable>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ width: 38 }} />
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      alignItems: 'flex-start',
                    }}
                  >
                    <View
                      style={{
                        borderRadius: 12,
                        paddingHorizontal: 10,
                      paddingVertical: 5,
                      backgroundColor:
                        project.status === 'shipped'
                          ? palette.successBg
                          : project.status === 'active'
                            ? palette.brandBg
                            : palette.track,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color:
                          project.status === 'shipped'
                            ? palette.success
                            : project.status === 'active'
                              ? palette.brand
                              : mainText,
                      }}
                    >
                      {project.status === 'shipped'
                        ? 'Shipped'
                        : project.status === 'active'
                          ? 'In progress'
                          : 'Planned'}
                    </Text>
                  </View>
                  </View>
                  <Pressable
                    accessibilityRole='checkbox'
                    accessibilityLabel={'Complete ' + project.name}
                    accessibilityState={{ checked: project.completed }}
                    onPress={() =>
                      toggleProject(project.id, !project.completed)
                    }
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderWidth: 2,
                        borderRadius: 5,
                        borderColor: project.completed ? palette.brand : border,
                        backgroundColor: project.completed
                          ? palette.brand
                          : surface.canvas,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {project.completed ? (
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 14,
                            fontWeight: '700',
                          }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
            {visibleProjects.length === 0 ? (
              <View style={{ ...cardStyle, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: mainText, fontWeight: '700' }}>
                  No matching projects
                </Text>
                <Button
                  appearance='outline'
                  color='neutral'
                  onPress={() => {
                    setQuery('');
                    setStatusFilter('all');
                    setShowSearch(false);
                    setShowFilters(false);
                  }}
                >
                  Clear filters
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {section === 'settings' ? (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text
                accessibilityRole='header'
                style={{ color: subtleText, fontWeight: '700', fontSize: 13 }}
              >
                WORKSPACE
              </Text>
              <View style={cardStyle}>
                <Input
                  label='Workspace name'
                  value={data.name}
                  onValueChange={(next: string) =>
                    setData((current) => ({ ...current, name: next }))
                  }
                />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text
                accessibilityRole='header'
                style={{ color: subtleText, fontWeight: '700', fontSize: 13 }}
              >
                APPEARANCE
              </Text>
              <View style={cardStyle}>
                {(['light', 'dark', 'highContrast'] as const).map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole='radio'
                    accessibilityState={{ checked: themeName === option }}
                    onPress={() => setTheme(option)}
                    style={{
                      minHeight: 48,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottomWidth: option === 'highContrast' ? 0 : 1,
                      borderColor: border,
                    }}
                  >
                    <Text style={{ color: mainText }}>
                      {option === 'highContrast'
                        ? 'High contrast'
                        : option === 'light'
                          ? 'Light'
                          : 'Dark'}
                    </Text>
                    <Text style={{ color: mainText }}>
                      {themeName === option ? '✓' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text
                accessibilityRole='header'
                style={{ color: subtleText, fontWeight: '700', fontSize: 13 }}
              >
                PREFERENCES
              </Text>
              <View style={cardStyle}>
                <Checkbox
                  label='Product notifications'
                  description='Saved locally. No emails are sent.'
                  checked={data.notifications}
                  onCheckedChange={(notifications: boolean) =>
                    setData((current) => ({ ...current, notifications }))
                  }
                />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text
                accessibilityRole='header'
                style={{ color: subtleText, fontWeight: '700', fontSize: 13 }}
              >
                DATA
              </Text>
              <View style={cardStyle}>
                <Pressable
                  accessibilityRole='button'
                  onPress={() => setResetOpen(true)}
                  style={{ minHeight: 48, justifyContent: 'center' }}
                >
                  <Text style={{ color: mainText, fontWeight: '600' }}>
                    Restore sample data
                  </Text>
                </Pressable>
                <Text style={{ color: subtleText, fontSize: 12 }}>
                  This replaces your locally saved demo projects and settings.
                </Text>
              </View>
            </View>
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
            ['overview', 'Dashboard', Grid],
            ['projects', 'Projects', Folder],
            ['settings', 'Settings', Settings],
          ] as const
        ).map(([value, label, IconComponent]) => (
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
            }}
          >
            <IconComponent
              size={22}
              color={section === value ? palette.brand : subtleText}
            />
            <Text
              style={{
                color: section === value ? palette.brand : subtleText,
                fontSize: 11,
                fontWeight: section === value ? '700' : '500',
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
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
