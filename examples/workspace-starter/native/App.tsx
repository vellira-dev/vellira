import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Copy,
  Check,
  Edit,
  Filter,
  Folder,
  Grid,
  MoreHorizontal,
  Plus,
  Settings,
  Search,
  Trash,
} from '@vellira-ui/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Button,
  Dropdown,
  Input,
  Select,
  ThemeProvider,
  useTheme,
} from '@vellira-ui/react-native';
import {
  canSubmitProjectEditor,
  hasActiveProjectFilters,
  nextUniqueDuplicateName,
} from './projectUx';
import { WorkspaceNotice, type WorkspaceNoticeData } from './WorkspaceNotice';
import { WorkspaceSettings } from './WorkspaceSettings';

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

type LargeTextChoiceFieldProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
};

/**
 * Keep the published native Select sheet at every text size.
 * Only the label, trigger and option typography are capped for large text.
 */
function LargeTextChoiceField({
  label,
  value,
  options,
  onSelect,
}: LargeTextChoiceFieldProps) {
  const { theme } = useTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const primary = theme.semantic.text.primary;
  const selectedColor = theme.components.select.primary.outline.option.selected.fg;

  return (
    <View style={{ gap: 8 }}>
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ color: primary, fontSize: 14, fontWeight: '600' }}
      >
        {label}
        <Text style={{ color: theme.semantic.status.error.fg }}> *</Text>
      </Text>
      <Select
        accessibilityLabel={label}
        accessibilityHint={'Required. Opens ' + label + ' choices'}
        value={value}
        onValueChange={(next) => {
          if (typeof next === 'string') onSelect(next);
        }}
        options={options.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        presentation='sheet'
        virtual={{ estimatedItemSize: 52 }}
        contentStyle={{ maxHeight: Math.min(viewportHeight * 0.7, 360) }}
        triggerStyle={{
          minHeight: 52,
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
        optionStyle={{
          minHeight: 52,
          paddingVertical: 8,
        }}
        renderValue={({ option, placeholder }) => (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.5}
            style={{ color: primary, fontSize: 15 }}
          >
            {option?.label ?? placeholder}
          </Text>
        )}
        renderOption={({ option, selected }) => (
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.5}
              style={{
                flex: 1,
                minWidth: 0,
                color: selected ? selectedColor : primary,
                fontSize: 15,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
            {selected ? <Check size={18} color={selectedColor} /> : null}
          </View>
        )}
      />
    </View>
  );
}

function WorkspaceScreen() {
  const { theme, themeName, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
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
  const [notice, setNotice] = useState<WorkspaceNoticeData | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (!mounted || !value) return;
        const restored = restoreWorkspace(JSON.parse(value));
        if (restored) setData(restored);
      })
      .catch(() => {
        // Preserve the in-memory demo, but make the storage failure visible.
        if (mounted) {
          setNotice({
            tone: 'error',
            message: 'Could not load saved projects on this device.',
          });
        }
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
      // In-memory interactions continue, but persistence is unavailable.
      setNotice({
        tone: 'error',
        message: 'Could not save changes on this device.',
      });
    });
  }, [loaded, data]);

  // Success feedback expires after four seconds; errors and undoable removals remain visible.
  useEffect(() => {
    if (!notice || notice.tone !== 'success' || removedProject) return;

    const timeout = setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, 4000);
    return () => clearTimeout(timeout);
  }, [notice, removedProject]);

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

  const activeFilters = hasActiveProjectFilters(
    showSearch,
    query,
    statusFilter
  );
  const projectListTitle = activeFilters ? 'Matching projects' : 'All projects';
  const editingProject = data.projects.find(
    (project) => project.id === editingId
  );
  const canSubmitProject = canSubmitProjectEditor(
    { name, description, team, status },
    editingId === null ? undefined : (editingProject ?? null)
  );
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
    if (!canSubmitProject) return;
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
    setNotice({
      tone: 'success',
      message:
        editingId === null
          ? 'Project created locally.'
          : 'Project updated locally.',
    });
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
            name: nextUniqueDuplicateName(
              project.name,
              current.projects.map((existing) => existing.name)
            ),
            completed: false,
            status: 'planned',
            previousStatus: undefined,
          },
          ...current.projects,
        ],
      };
    });
    setRemovedProject(null);
    setNotice({ tone: 'success', message: 'Project duplicated.' });
  }

  function deleteProject(id: number) {
    const selected = data.projects.find((project) => project.id === id);
    if (!selected) return;
    setRemovedProject(selected);
    setData((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
    }));
    setNotice({ tone: 'neutral', message: 'Project removed.' });
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

  // Keep the workspace mounted behind the large material editor sheet so its
  // navigation context remains visible, while interactions behind it are inert.
  const isEditing = editingId !== null;
  const actionLabel = isEditing ? 'Save' : 'Create';
  // The published Select reserves room for its entire short list. Cap only
  // the sheet surface to its toolbar, handle and three rows so no oversized
  // blank footer remains; never force a height or change library internals.
  // Scale the cap for larger system text and respect the native viewport.
  const compactSheetMaxHeight = Math.min(
    windowHeight * 0.74,
    (52 + 16 + 3 * 46) * Math.max(1, fontScale) +
      theme.tokens.spacing[2] * 2 +
      2
  );
  const compactSheetStyle = { maxHeight: compactSheetMaxHeight };
  // A single-line native TextInput needs font-metric-based vertical centering.
  // Do not force the shared Input lineHeight into this fixed-height editor field.
  const editorInputStyle = {
    lineHeight: undefined,
    paddingVertical: 0,
    textAlignVertical: 'center' as const,
  };
  // Match the published md Input's 46pt control height. Select otherwise
  // grows taller from its own vertical padding, despite shared FormField labels.
  const editorSelectTriggerStyle = {
    height: 46,
    minHeight: 46,
    paddingVertical: 0,
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: surface.canvas }}
      edges={['top', 'bottom']}
    >
      <View
        pointerEvents={createOpen || resetOpen ? 'none' : 'auto'}
        accessibilityElementsHidden={createOpen || resetOpen}
        importantForAccessibility={
          createOpen || resetOpen ? 'no-hide-descendants' : 'auto'
        }
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
          maxFontSizeMultiplier={1.4}
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
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.5}
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
            <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={{ color: subtleText, fontSize: 13 }}>
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
        pointerEvents={createOpen || resetOpen ? 'none' : 'auto'}
        accessibilityElementsHidden={createOpen || resetOpen}
        importantForAccessibility={
          createOpen || resetOpen ? 'no-hide-descendants' : 'auto'
        }
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        {notice ? (
          <WorkspaceNotice
            notice={notice}
            onUndo={
              removedProject
                ? () => {
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
                    setNotice({
                      tone: 'success',
                      message: 'Project restored.',
                    });
                  }
                : undefined
            }
            onDismiss={() => {
              setNotice(null);
              setRemovedProject(null);
            }}
          />
        ) : null}

        {section === 'overview' ? (
          <View style={{ gap: 18 }}>
            <Text maxFontSizeMultiplier={1.6} style={{ color: subtleText, fontSize: 15 }}>
              Your projects at a glance
            </Text>
            <View style={{ flexDirection: largeText ? 'column' : 'row', gap: 12 }}>
              {[
                {
                  label: 'Total projects',
                  value: totalCount,
                  caption: 'All projects',
                  bg:
                    themeName === 'highContrast' ? '#1C2736' : palette.brandBg,
                  outline:
                    themeName === 'highContrast'
                      ? '#A77BFF'
                      : palette.brandBorder,
                  accent:
                    themeName === 'highContrast' ? '#C5A8FF' : palette.brand,
                },
                {
                  label: 'Completed',
                  value: completedCount,
                  caption: completionRate + '% completion',
                  bg:
                    themeName === 'highContrast'
                      ? '#1C2736'
                      : palette.successBg,
                  outline:
                    themeName === 'highContrast'
                      ? '#30D5A0'
                      : palette.successBorder,
                  accent:
                    themeName === 'highContrast' ? '#6BF2BF' : palette.success,
                },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={{
                    flex: largeText ? undefined : 1,
                    minWidth: 0,
                    padding: 16,
                    borderRadius: theme.tokens.radius.lg,
                    backgroundColor: metric.bg,
                    borderWidth: 1,
                    borderColor: metric.outline,
                    gap: 8,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.6}
                    style={{
                      color: metric.accent,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {metric.label}
                  </Text>
                  <Text maxFontSizeMultiplier={1.6}
                    style={{
                      color:
                        themeName === 'highContrast' ? '#FFFFFF' : mainText,
                      fontSize: 35,
                      fontWeight: '700',
                    }}
                  >
                    {metric.value}
                  </Text>
                  <Text maxFontSizeMultiplier={1.6}
                    style={{
                      color:
                        themeName === 'highContrast' ? '#D6E0ED' : subtleText,
                      fontSize: 12,
                    }}
                  >
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
                <Text maxFontSizeMultiplier={1.6}
                  style={{ color: mainText, fontSize: 19, fontWeight: '700' }}
                >
                  Project progress
                </Text>
                <Text maxFontSizeMultiplier={1.6} style={{ color: palette.brand, fontWeight: '700' }}>
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
                <Text maxFontSizeMultiplier={1.6} style={{ color: subtleText, fontSize: 12 }}>
                  Completed · {completedCount}
                </Text>
                <Text maxFontSizeMultiplier={1.6} style={{ color: subtleText, fontSize: 12 }}>
                  Remaining · {totalCount - completedCount}
                </Text>
              </View>
            </View>
            <View style={cardStyle}>
              <Text maxFontSizeMultiplier={1.6}
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
                      <Text maxFontSizeMultiplier={1.6}
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
                      numberOfLines={largeText ? 1 : 2}
                      maxFontSizeMultiplier={1.4}
                      accessibilityLabel={status.name}
                      style={{
                        width: '31%',
                        textAlign: 'center',
                        color: subtleText,
                        fontSize: 12,
                      }}
                    >
                      {largeText
                        ? status.key === 'planned'
                          ? 'Plan'
                          : status.key === 'active'
                            ? 'Active'
                            : 'Shipped'
                        : status.name}
                    </Text>
                  ))}
                </View>
              </View>
              {totalCount === 0 ? (
                <Text maxFontSizeMultiplier={1.6} style={{ color: subtleText }}>
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
              <Text maxFontSizeMultiplier={1.6}
                style={{ color: mainText, fontSize: 17, fontWeight: '700' }}
              >
                {projectListTitle} · {visibleProjects.length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Search projects'
                  accessibilityState={{
                    expanded: showSearch,
                    selected: showSearch && query.trim().length > 0,
                  }}
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
                  <Search
                    size={22}
                    color={
                      showSearch && query.trim() ? palette.brand : mainText
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Filter projects'
                  accessibilityState={{
                    expanded: showFilters,
                    selected: statusFilter !== 'all',
                  }}
                  onPress={() => setShowFilters(!showFilters)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Filter
                    size={22}
                    color={statusFilter !== 'all' ? palette.brand : mainText}
                  />
                </Pressable>
              </View>
            </View>
            {showSearch ? (
              largeText ? (
                <View style={{ gap: 8 }}>
                  <Text maxFontSizeMultiplier={1.5} style={{ color: mainText, fontSize: 14, fontWeight: '600' }}>
                    Search projects
                  </Text>
                  <TextInput
                    accessibilityLabel='Search projects'
                    value={query}
                    onChangeText={setQuery}
                    placeholder='Search projects'
                    placeholderTextColor={subtleText}
                    maxFontSizeMultiplier={1.5}
                    style={{ minHeight: 48, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: mainText }}
                  />
                </View>
              ) : (
                <Input
                  label='Search projects'
                  value={query}
                  onValueChange={setQuery}
                  placeholder='Search projects'
                />
              )
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
                      paddingHorizontal: 14,
                      minHeight: 40,
                      justifyContent: 'center',
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor:
                        statusFilter === value ? palette.brand : border,
                      backgroundColor:
                        statusFilter === value
                          ? palette.brandBg
                          : surface.canvas,
                    }}
                  >
                    <Text maxFontSizeMultiplier={1.6}
                      style={{
                        color:
                          statusFilter === value ? palette.brand : subtleText,
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
                    <Text maxFontSizeMultiplier={1.6}
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
                    <Text maxFontSizeMultiplier={1.6}
                      numberOfLines={1}
                      style={{
                        color: mainText,
                        fontSize: 15,
                        fontWeight: '700',
                      }}
                    >
                      {project.name}
                    </Text>
                    <Text maxFontSizeMultiplier={1.6}
                      numberOfLines={1}
                      style={{ color: subtleText, fontSize: 12 }}
                    >
                      {project.description || 'No description'}
                    </Text>
                  </Pressable>
                  <Dropdown
                    accessibilityLabel={'Actions for ' + project.name}
                    showArrow={false}
                    presentation='popover'
                    placement='bottom-end'
                    offset={-44}
                    closeOnSelect
                    textStyle={largeText ? {
                      fontSize: 16 * Math.min(1, 1.5 / fontScale),
                      lineHeight: 22 * Math.min(1, 1.5 / fontScale),
                    } : undefined}
                    itemStyle={largeText ? { minHeight: 52 } : undefined}
                    popoverBackground={
                      Platform.OS === 'ios' && themeName !== 'highContrast' ? (
                        <BlurView
                          intensity={25}
                          tint={
                            themeName === 'dark'
                              ? 'systemUltraThinMaterialDark'
                              : 'systemUltraThinMaterialLight'
                          }
                          style={{
                            flex: 1,
                            borderRadius: 22,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            pointerEvents='none'
                            style={{
                              flex: 1,
                              backgroundColor:
                                themeName === 'dark'
                                  ? 'rgba(20, 18, 30, 0.24)'
                                  : 'rgba(255, 255, 255, 0.75)',
                            }}
                          />
                        </BlurView>
                      ) : undefined
                    }
                    contentStyle={{
                      width: largeText ? 268 : 216,
                      maxWidth: largeText ? 280 : 236,
                      borderRadius: 22,
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      borderWidth:
                        Platform.OS === 'ios' && themeName !== 'highContrast'
                          ? 0
                          : 1,
                      borderColor: border,
                      backgroundColor:
                        Platform.OS === 'ios' && themeName !== 'highContrast'
                          ? 'transparent'
                          : surface.panel,
                      shadowColor: '#000000',
                      shadowOpacity: themeName === 'dark' ? 0.42 : 0.24,
                      shadowRadius: 24,
                      shadowOffset: { width: 0, height: 12 },
                      elevation: 16,
                    }}
                  >
                    <Dropdown.Trigger asChild>
                      <Pressable
                        accessibilityRole='button'
                        accessibilityLabel={'Actions for ' + project.name}
                        style={{
                          width: 44,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MoreHorizontal size={24} color={mainText} />
                      </Pressable>
                    </Dropdown.Trigger>
                    <Dropdown.Content>
                      {!largeText ? <Dropdown.Label>Project actions</Dropdown.Label> : null}
                      <Dropdown.Item
                        value='edit'
                        icon={<Edit size={18} />}
                        onSelect={() => openEdit(project)}
                      >
                        Edit
                      </Dropdown.Item>
                      <Dropdown.Item
                        value='duplicate'
                        icon={<Copy size={18} />}
                        onSelect={() => duplicateProject(project.id)}
                      >
                        Duplicate
                      </Dropdown.Item>
                      <Dropdown.Separator />
                      <Dropdown.Item
                        value='remove'
                        icon={<Trash size={18} />}
                        color='danger'
                        onSelect={() => deleteProject(project.id)}
                      >
                        Remove
                      </Dropdown.Item>
                    </Dropdown.Content>
                  </Dropdown>
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
                              : themeName === 'highContrast'
                                ? '#FFFFFF'
                                : palette.track,
                        borderWidth: themeName === 'highContrast' ? 1 : 0,
                        borderColor:
                          project.status === 'shipped'
                            ? palette.successBorder
                            : project.status === 'active'
                              ? palette.brandBorder
                              : '#1A102B',
                      }}
                    >
                      <Text maxFontSizeMultiplier={1.6}
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color:
                            project.status === 'shipped'
                              ? palette.success
                              : project.status === 'active'
                                ? palette.brand
                                : themeName === 'highContrast'
                                  ? '#1A102B'
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
                        <Check size={16} color='#FFFFFF' />
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
            {visibleProjects.length === 0 ? (
              <View style={{ ...cardStyle, alignItems: 'center', gap: 10 }}>
                <Text maxFontSizeMultiplier={1.6} style={{ color: mainText, fontWeight: '700' }}>
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
          <WorkspaceSettings
            workspaceName={data.name}
            onWorkspaceNameChange={(next: string) =>
              setData((current) => ({ ...current, name: next }))
            }
            notifications={data.notifications}
            onNotificationsChange={(notifications: boolean) =>
              setData((current) => ({ ...current, notifications }))
            }
            onRestore={() => setResetOpen(true)}
          />
        ) : null}
      </ScrollView>

      <View
        pointerEvents={createOpen || resetOpen ? 'none' : 'auto'}
        accessibilityElementsHidden={createOpen || resetOpen}
        importantForAccessibility={
          createOpen || resetOpen ? 'no-hide-descendants' : 'auto'
        }
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
            accessibilityHint={largeText ? 'Navigation tab' : undefined}
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
            {!largeText ? (
              <Text maxFontSizeMultiplier={1.6}
                style={{
                  color: section === value ? palette.brand : subtleText,
                  fontSize: 11,
                  fontWeight: section === value ? '700' : '500',
                }}
              >
                {label}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      {resetOpen ? (
        <View
          accessibilityViewIsModal
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 50, elevation: 24, paddingTop: insets.top + 8 },
          ]}
        >
          <View
            pointerEvents='auto'
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  themeName === 'dark'
                    ? 'rgba(10, 8, 22, 0.38)'
                    : 'rgba(33, 25, 62, 0.16)',
              },
            ]}
          />
          <View
            style={{
              flex: 1,
              marginHorizontal: 0,
              marginBottom: 0,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              shadowColor: '#000000',
              shadowOpacity: themeName === 'dark' ? 0.42 : 0.24,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 16,
            }}
          >
            <View
              style={{
                flex: 1,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: border,
                backgroundColor:
                  Platform.OS === 'ios' && themeName !== 'highContrast'
                    ? 'transparent'
                    : surface.canvas,
              }}
            >
              {Platform.OS === 'ios' && themeName !== 'highContrast' ? (
                <BlurView
                  pointerEvents='none'
                  intensity={25}
                  tint={
                    themeName === 'dark'
                      ? 'systemUltraThinMaterialDark'
                      : 'systemUltraThinMaterialLight'
                  }
                  style={StyleSheet.absoluteFill}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor:
                        themeName === 'dark'
                          ? 'rgba(20, 18, 30, 0.24)'
                          : 'rgba(255, 255, 255, 0.75)',
                    }}
                  />
                </BlurView>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 16,
                  gap: 8,
                }}
              >
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Close restore confirmation'
                  onPress={() => setResetOpen(false)}
                  style={{
                    minWidth: 78,
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.6}
                    style={{ color: mainText, fontSize: 16, fontWeight: '600' }}
                  >
                    Close
                  </Text>
                </Pressable>
                <Text maxFontSizeMultiplier={1.6}
                  accessibilityRole='header'
                  style={{
                    flex: 1,
                    color: mainText,
                    textAlign: 'center',
                    fontSize: 17,
                    fontWeight: '700',
                  }}
                >
                  Restore data
                </Text>
                <View style={{ minWidth: 78 }} />
              </View>
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingTop: 22,
                  paddingBottom: 40,
                  flexGrow: 1,
                }}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: 560,
                    alignSelf: 'center',
                    flex: 1,
                    justifyContent: 'space-between',
                    gap: 24,
                  }}
                >
                  <View style={{ gap: 10 }}>
                    <Text maxFontSizeMultiplier={1.6}
                      accessibilityRole='header'
                      style={{
                        paddingHorizontal: 6,
                        color: subtleText,
                        fontSize: 13,
                        fontWeight: '700',
                        letterSpacing: 0.8,
                      }}
                    >
                      DATA RESTORE
                    </Text>
                    <View
                      style={{
                        padding: 20,
                        gap: 12,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: border,
                        backgroundColor: surface.subtle,
                      }}
                    >
                      <Text maxFontSizeMultiplier={1.6}
                        style={{
                          color: mainText,
                          fontSize: 19,
                          fontWeight: '700',
                        }}
                      >
                        Restore sample data?
                      </Text>
                      <Text maxFontSizeMultiplier={1.6}
                        style={{
                          color: theme.semantic.text.secondary,
                          fontSize: 15,
                          lineHeight: 23,
                        }}
                      >
                        This replaces saved projects and settings. It cannot be
                        undone.
                      </Text>
                    </View>
                  </View>
                  {largeText ? (
                    <Pressable
                      accessibilityRole='button'
                      accessibilityLabel='Restore sample data'
                      onPress={() => {
                        setData(initialWorkspace);
                        setRemovedProject(null);
                        setTheme('light');
                        setResetOpen(false);
                        setNotice({ tone: 'success', message: 'Sample data restored.' });
                      }}
                      style={{ minHeight: 52, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.semantic.status.error.fg }}
                    >
                      <Text maxFontSizeMultiplier={1.4} style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                        Restore sample data
                      </Text>
                    </Pressable>
                  ) : (
                  <Button
                    color='danger'
                    onPress={() => {
                      setData(initialWorkspace);
                      setRemovedProject(null);
                      setTheme('light');
                      setResetOpen(false);
                      setNotice({
                        tone: 'success',
                        message: 'Sample data restored.',
                      });
                    }}
                  >
                    Restore sample data
                  </Button>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      ) : null}
      {createOpen ? (
        <View
          accessibilityViewIsModal
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 50, elevation: 24, paddingTop: insets.top + 8 },
          ]}
        >
          <View
            pointerEvents='auto'
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  themeName === 'dark'
                    ? 'rgba(10, 8, 22, 0.38)'
                    : 'rgba(33, 25, 62, 0.16)',
              },
            ]}
          />
          <View
            style={{
              flex: 1,
              marginTop: 0,
              marginHorizontal: 0,
              marginBottom: 0,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              shadowColor: '#000000',
              shadowOpacity: themeName === 'dark' ? 0.42 : 0.24,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 16,
            }}
          >
            <View
              style={{
                flex: 1,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: border,
                backgroundColor:
                  Platform.OS === 'ios' && themeName !== 'highContrast'
                    ? 'transparent'
                    : surface.canvas,
              }}
            >
              {Platform.OS === 'ios' && themeName !== 'highContrast' ? (
                <BlurView
                  pointerEvents='none'
                  intensity={25}
                  tint={
                    themeName === 'dark'
                      ? 'systemUltraThinMaterialDark'
                      : 'systemUltraThinMaterialLight'
                  }
                  style={StyleSheet.absoluteFill}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor:
                        themeName === 'dark'
                          ? 'rgba(20, 18, 30, 0.24)'
                          : 'rgba(255, 255, 255, 0.75)',
                    }}
                  />
                </BlurView>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 16,
                  gap: 8,
                }}
              >
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Close project editor'
                  accessibilityHint='Discard changes and return to the workspace'
                  onPress={() => {
                    setCreateOpen(false);
                    setError('');
                  }}
                  style={{
                    minWidth: 78,
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.6}
                    style={{ color: mainText, fontSize: 16, fontWeight: '600' }}
                  >
                    Close
                  </Text>
                </Pressable>
                <Text maxFontSizeMultiplier={1.6}
                  accessibilityRole='header'
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: mainText,
                    textAlign: 'center',
                    fontSize: 17,
                    fontWeight: '700',
                  }}
                >
                  {isEditing ? 'Edit project' : 'New project'}
                </Text>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel={
                    isEditing ? 'Save project changes' : 'Create project'
                  }
                  onPress={saveProject}
                  disabled={!canSubmitProject}
                  accessibilityState={{ disabled: !canSubmitProject }}
                  accessibilityHint={
                    canSubmitProject
                      ? undefined
                      : isEditing
                        ? 'Enter a valid name and make a change to save'
                        : 'Enter a project name to create'
                  }
                  style={{
                    minWidth: 78,
                    minHeight: 44,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 22,
                    backgroundColor: canSubmitProject
                      ? palette.brand
                      : surface.subtle,
                    borderWidth: 1,
                    borderColor: canSubmitProject ? palette.brand : border,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.6}
                    style={{
                      color: canSubmitProject ? '#FFFFFF' : subtleText,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    {actionLabel}
                  </Text>
                </Pressable>
              </View>

              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <ScrollView
                  keyboardShouldPersistTaps='handled'
                  keyboardDismissMode='on-drag'
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: 22,
                    paddingBottom: 40,
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 560,
                      alignSelf: 'center',
                      gap: 26,
                    }}
                  >
                    <View style={{ gap: 10 }}>
                      <Text maxFontSizeMultiplier={1.6}
                        accessibilityRole='header'
                        style={{
                          paddingHorizontal: 6,
                          color: subtleText,
                          fontSize: 13,
                          fontWeight: '700',
                          letterSpacing: 0.8,
                        }}
                      >
                        PROJECT DETAILS
                      </Text>
                      <View
                        style={{
                          padding: 18,
                          gap: 18,
                          backgroundColor: surface.subtle,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: border,
                        }}
                      >
                        {largeText ? (
                          <View style={{ gap: 8 }}>
                            <Text maxFontSizeMultiplier={1.5} style={{ color: mainText, fontSize: 14, fontWeight: '600' }}>Project name *</Text>
                            <TextInput
                              accessibilityLabel='Project name'
                              value={name}
                              onChangeText={(value) => { setName(value); setError(''); }}
                              placeholder='New project name'
                              placeholderTextColor={subtleText}
                              maxFontSizeMultiplier={1.5}
                              style={{ minHeight: 48, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: mainText }}
                            />
                            {error ? <Text maxFontSizeMultiplier={1.5} style={{ color: theme.semantic.status.error.fg }}>{error}</Text> : null}
                            <Text maxFontSizeMultiplier={1.5} style={{ color: mainText, fontSize: 14, fontWeight: '600' }}>Description</Text>
                            <TextInput
                              accessibilityLabel='Description'
                              value={description}
                              onChangeText={setDescription}
                              placeholder='Describe the project'
                              placeholderTextColor={subtleText}
                              maxFontSizeMultiplier={1.5}
                              style={{ minHeight: 48, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: mainText }}
                            />
                          </View>
                        ) : (
                          <>
                        <Input
                          label='Project name'
                          required
                          value={name}
                          error={error || undefined}
                          onValueChange={(value: string) => {
                            setName(value);
                            setError('');
                          }}
                          placeholder='New project name'
                          inputStyle={editorInputStyle}
                        />
                        <Input
                          label='Description'
                          value={description}
                          onValueChange={setDescription}
                          placeholder='Describe the project'
                          inputStyle={editorInputStyle}
                        />
                          </>
                        )}
                      </View>
                    </View>
                    <View style={{ gap: 10 }}>
                      <Text maxFontSizeMultiplier={1.6}
                        accessibilityRole='header'
                        style={{
                          paddingHorizontal: 6,
                          color: subtleText,
                          fontSize: 13,
                          fontWeight: '700',
                          letterSpacing: 0.8,
                        }}
                      >
                        ORGANIZATION
                      </Text>
                      <View
                        style={{
                          padding: 18,
                          gap: 18,
                          backgroundColor: surface.subtle,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: border,
                        }}
                      >
                        {largeText ? (
                          <>
                            <LargeTextChoiceField
                              label='Team'
                              value={team}
                              options={[
                                { value: 'design', label: 'Design' },
                                { value: 'platform', label: 'Platform' },
                                { value: 'mobile', label: 'Mobile' },
                              ]}
                              onSelect={(value) => {
                                if (isTeam(value)) setTeam(value);
                              }}
                            />
                            <LargeTextChoiceField
                              label='Status'
                              value={status}
                              options={[
                                { value: 'planned', label: 'Planned' },
                                { value: 'active', label: 'In progress' },
                                { value: 'shipped', label: 'Shipped' },
                              ]}
                              onSelect={(value) => {
                                if (isStatus(value)) setStatus(value);
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <Select
                              label='Team'
                              required
                              value={team}
                              onValueChange={(value: string | null) => {
                                if (isTeam(value)) setTeam(value);
                              }}
                              presentation='sheet'
                              triggerStyle={editorSelectTriggerStyle}
                              contentStyle={compactSheetStyle}
                            >
                              <Select.Item value='design' label='Design' />
                              <Select.Item value='platform' label='Platform' />
                              <Select.Item value='mobile' label='Mobile' />
                            </Select>
                            <Select
                              label='Status'
                              required
                              value={status}
                              onValueChange={(value: string | null) => {
                                if (typeof value === 'string' && isStatus(value)) {
                                  setStatus(value);
                                }
                              }}
                              presentation='sheet'
                              triggerStyle={editorSelectTriggerStyle}
                              contentStyle={compactSheetStyle}
                            >
                              <Select.Item value='planned' label='Planned' />
                              <Select.Item value='active' label='In progress' />
                              <Select.Item value='shipped' label='Shipped' />
                            </Select>
                          </>
                        )}
                      </View>
                    </View>
                    <Text maxFontSizeMultiplier={1.6}
                      style={{
                        paddingHorizontal: 6,
                        color: subtleText,
                        fontSize: 13,
                        lineHeight: 19,
                      }}
                    >
                      Changes stay on this device.
                    </Text>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </View>
        </View>
      ) : null}
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
