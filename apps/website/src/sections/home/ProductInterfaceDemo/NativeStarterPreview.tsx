'use client';

import { useMemo, useState } from 'react';

import {
  Check,
  Contrast,
  Copy,
  Edit,
  Filter,
  Folder,
  Grid,
  Moon,
  MoreHorizontal,
  Plus,
  Refresh,
  Search,
  Settings,
  Sun,
  Trash,
} from '@vellira-ui/icons';
import { Switch, useTheme } from '@vellira-ui/react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { nextUniqueDuplicateName } from '../../../../../../examples/workspace-starter/native/projectUx';

import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';

import styles from './NativeStarterPreview.module.css';

type Section = 'overview' | 'projects' | 'settings';
type Status = 'planned' | 'active' | 'shipped';
type Project = {
  id: number;
  name: string;
  description: string;
  status: Status;
  completed: boolean;
};

// Mirrors the public Native Starter seed, not the separate React Web dashboard.
// Its actual runtime is Expo on iOS/Android; this uses React Native Web in-browser.
const seedProjects: Project[] = [
  {
    id: 1,
    name: 'Design token refresh',
    description: 'Unify semantic colors and spacing.',
    status: 'active',
    completed: false,
  },
  {
    id: 2,
    name: 'Mobile onboarding',
    description: 'Bring the first-run experience to native.',
    status: 'planned',
    completed: false,
  },
  {
    id: 3,
    name: 'Dashboard rollout',
    description: 'Ship the verified workspace interface.',
    status: 'shipped',
    completed: true,
  },
];

const statusLabel: Record<Status, string> = {
  planned: 'Planned',
  active: 'In progress',
  shipped: 'Shipped',
};

export function NativeStarterPreview() {
  const { theme, themeName } = useTheme();
  const { setPreference } = useWebsiteThemeContext();
  const [section, setSection] = useState<Section>('overview');
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [workspaceName, setWorkspaceName] = useState('Demo Workspace');
  const [notifications, setNotifications] = useState(true);
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [removed, setRemoved] = useState<Project | null>(null);

  const surface = theme.semantic.surface;
  const text = theme.semantic.text;
  const border = theme.semantic.border.muted;
  const dark = themeName === 'dark';
  const contrast = themeName === 'highContrast';
  const palette = dark
    ? {
        brand: '#B39AFF',
        brandBg: '#33284C',
        brandBorder: '#655095',
        success: '#79DCAB',
        successBg: '#203B34',
        successBorder: '#357356',
        track: '#332D42',
      }
    : contrast
      ? {
          brand: '#6434C7',
          brandBg: '#1C2736',
          brandBorder: '#A77BFF',
          success: '#006C46',
          successBg: '#1C2736',
          successBorder: '#30D5A0',
          track: '#D2CADE',
        }
      : {
          brand: '#7050ED',
          brandBg: '#F2ECFF',
          brandBorder: '#DCCFFF',
          success: '#087B55',
          successBg: '#EAF9F1',
          successBorder: '#B8E7D0',
          track: '#F0ECF8',
        };

  const total = projects.length;
  const completed = projects.filter((item) => item.completed).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const statuses = useMemo(
    () =>
      (['planned', 'active', 'shipped'] as const).map((value) => ({
        value,
        label: statusLabel[value],
        count: projects.filter((item) => item.status === value).length,
      })),
    [projects]
  );
  const chartMax = Math.max(
    4,
    Math.ceil(Math.max(...statuses.map((item) => item.count)) / 4) * 4
  );
  const visible = projects.filter(
    (item) =>
      (filter === 'all' || item.status === filter) &&
      (item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()))
  );
  const card = {
    backgroundColor: surface.subtle,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  } as const;

  const removeProject = (project: Project) => {
    setRemoved(project);
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setMenuId(null);
  };

  return (
    <div className={styles.device} aria-label='React Native Starter design preview'>
      <div className={styles.screen} data-testid='native-starter-preview'>
        <div className={styles.island} aria-hidden='true' />
        <div className={styles.statusBar} aria-hidden='true'>
          <span>9:41</span>
          <span className={styles.signal}>●●● ▰</span>
        </div>
        <View style={{ flex: 1, minHeight: 0, backgroundColor: surface.canvas }}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 12,
              gap: 3,
              borderBottomWidth: 1,
              borderColor: border,
            }}
          >
            <Text
              style={{
                color: text.subtle,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.1,
              }}
            >
              VELLIRA / WORKSPACE
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  accessibilityRole='header'
                  style={{ fontSize: 27, fontWeight: '700', color: text.primary }}
                >
                  {section === 'overview'
                    ? 'Dashboard'
                    : section === 'projects'
                      ? 'Projects'
                      : 'Settings'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: text.secondary, fontSize: 12 }}
                >
                  {workspaceName || 'Untitled workspace'}
                </Text>
              </View>
              {section !== 'settings' ? (
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Create project'
                  onPress={() => {
                    setDraftName('');
                    setEditingId(null);
                    setCreateOpen(true);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: palette.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 22,
                  }}
                >
                  <Plus size={22} color='#FFFFFF' />
                </Pressable>
              ) : null}
            </View>
          </View>
          <ScrollView
            key={section}
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}
          >
            {removed ? (
              <View
                style={{
                  ...card,
                  padding: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ flex: 1, fontSize: 12, color: text.primary }}
                >
                  Project removed.
                </Text>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Undo project removal'
                  onPress={() => {
                    setProjects((current) => [removed, ...current]);
                    setRemoved(null);
                  }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: palette.brand, fontWeight: '700' }}>
                    Undo
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {section === 'overview' ? (
              <View style={{ gap: 18 }}>
                <Text style={{ color: text.secondary, fontSize: 14 }}>
                  Your projects at a glance
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    {
                      label: 'Total projects',
                      value: total,
                      caption: 'All projects',
                      color: contrast ? '#C5A8FF' : palette.brand,
                      background: palette.brandBg,
                      outline: palette.brandBorder,
                    },
                    {
                      label: 'Completed',
                      value: completed,
                      caption: rate + '% completion',
                      color: contrast ? '#6BF2BF' : palette.success,
                      background: palette.successBg,
                      outline: palette.successBorder,
                    },
                  ].map((metric) => (
                    <View
                      key={metric.label}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 138,
                        borderWidth: 1,
                        borderColor: metric.outline,
                        backgroundColor: metric.background,
                        borderRadius: 18,
                        padding: 13,
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: metric.color,
                        }}
                      >
                        {metric.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 34,
                          fontWeight: '700',
                          color: contrast ? '#FFFFFF' : text.primary,
                        }}
                      >
                        {metric.value}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: contrast ? '#D6E0ED' : text.secondary,
                        }}
                      >
                        {metric.caption}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={card}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: text.primary,
                      }}
                    >
                      Project progress
                    </Text>
                    <Text style={{ fontWeight: '700', color: palette.brand }}>
                      {rate}%
                    </Text>
                  </View>
                  <View
                    accessibilityLabel={completed + ' of ' + total + ' completed'}
                    style={{
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: palette.track,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: (rate + '%') as `${number}%`,
                        height: '100%',
                        borderRadius: 6,
                        backgroundColor: palette.brand,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: text.secondary, fontSize: 11 }}>
                      Completed · {completed}
                    </Text>
                    <Text style={{ color: text.secondary, fontSize: 11 }}>
                      Remaining · {total - completed}
                    </Text>
                  </View>
                </View>
                <View style={card}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: text.primary,
                    }}
                  >
                    Projects by status
                  </Text>
                  <View
                    accessible
                    accessibilityLabel={
                      'Projects by status: ' +
                      statuses.map((item) => item.label + ' ' + item.count).join(', ')
                    }
                    style={{ gap: 9 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        height: 214,
                        gap: 8,
                      }}
                    >
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
                            style={{ color: text.secondary, fontSize: 10 }}
                          >
                            {(chartMax * tick) / 4}
                          </Text>
                        ))}
                      </View>
                      <View
                        style={{
                          flex: 1,
                          height: 200,
                          marginTop: 7,
                          position: 'relative',
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
                              key={status.value}
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
                                    height: ((status.count / chartMax) * 100 + '%') as `${number}%`,
                                    width: '100%',
                                    borderRadius: 8,
                                    backgroundColor: dark ? '#85B6FF' : '#5797F6',
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
                          key={status.value}
                          numberOfLines={1}
                          style={{
                            width: '31%',
                            textAlign: 'center',
                            color: text.secondary,
                            fontSize: 10,
                          }}
                        >
                          {status.label}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {section === 'projects' ? (
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      color: text.primary,
                      fontSize: 18,
                      fontWeight: '700',
                    }}
                  >
                    All projects · {visible.length}
                  </Text>
                  <View style={{ flexDirection: 'row' }}>
                    <Pressable
                      accessibilityRole='button'
                      accessibilityLabel='Search projects'
                      onPress={() => setShowSearch((old) => !old)}
                      style={{ padding: 10 }}
                    >
                      <Search size={20} color={text.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole='button'
                      accessibilityLabel='Filter projects'
                      onPress={() =>
                        setFilter((old) =>
                          old === 'all'
                            ? 'planned'
                            : old === 'planned'
                              ? 'active'
                              : old === 'active'
                                ? 'shipped'
                                : 'all'
                        )
                      }
                      style={{ padding: 10 }}
                    >
                      <Filter size={20} color={filter === 'all' ? text.primary : palette.brand} />
                    </Pressable>
                  </View>
                </View>
                {showSearch ? (
                  <TextInput
                    accessibilityLabel='Search projects'
                    value={query}
                    onChangeText={setQuery}
                    placeholder='Search projects'
                    placeholderTextColor={text.subtle}
                    style={{
                      color: text.primary,
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                    }}
                  />
                ) : null}
                {visible.map((project) => (
                  <View
                    key={project.id}
                    style={{
                      ...card,
                      position: 'relative',
                      zIndex: menuId === project.id ? 2 : 0,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          borderWidth: 1,
                          borderColor: border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: text.primary, fontWeight: '700' }}>
                          {project.name
                            .split(' ')
                            .map((part) => part.charAt(0))
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: text.primary,
                            fontWeight: '700',
                            fontSize: 14,
                          }}
                        >
                          {project.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ color: text.secondary, fontSize: 11 }}
                        >
                          {project.description || 'No description'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole='button'
                        accessibilityLabel={'Actions for ' + project.name}
                        accessibilityState={{ expanded: menuId === project.id }}
                        onPress={() =>
                          setMenuId(menuId === project.id ? null : project.id)
                        }
                        style={{ padding: 8 }}
                      >
                        <MoreHorizontal size={20} color={text.primary} />
                      </Pressable>
                    </View>
                    {menuId === project.id ? (
                      <View
                        accessibilityRole='menu'
                        accessibilityLabel={'Project actions for ' + project.name}
                        style={{
                          position: 'absolute',
                          top: 55,
                          right: 14,
                          width: 196,
                          zIndex: 3,
                          borderWidth: 1,
                          borderColor: border,
                          borderRadius: 18,
                          padding: 8,
                          backgroundColor: surface.panel,
                          shadowColor: '#000000',
                          shadowOpacity: 0.22,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 8 },
                          elevation: 12,
                          gap: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: text.secondary,
                            fontSize: 10,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                          }}
                        >
                          PROJECT ACTIONS
                        </Text>
                        {[
                          {
                            label: 'Edit',
                            Icon: Edit,
                            action: () => {
                              setEditingId(project.id);
                              setDraftName(project.name);
                              setCreateOpen(true);
                              setMenuId(null);
                            },
                          },
                          {
                            label: 'Duplicate',
                            Icon: Copy,
                            action: () => {
                              setProjects((current) => [
                                {
                                  ...project,
                                  id: Math.max(...current.map((item) => item.id), 0) + 1,
                                  name: nextUniqueDuplicateName(
                                    project.name,
                                    current.map((item) => item.name)
                                  ),
                                },
                                ...current,
                              ]);
                              setMenuId(null);
                            },
                          },
                          {
                            label: 'Remove',
                            Icon: Trash,
                            action: () => removeProject(project),
                          },
                        ].map(({ label, action, Icon }) => (
                          <Pressable
                            key={label}
                            accessibilityRole='menuitem'
                            accessibilityLabel={label}
                            onPress={action}
                            style={{
                              minHeight: 40,
                              flexDirection: 'row',
                              gap: 10,
                              alignItems: 'center',
                              paddingHorizontal: 8,
                            }}
                          >
                            <Icon
                              size={17}
                              color={label === 'Remove' ? '#D40043' : text.primary}
                            />
                            <Text
                              style={{
                                color: label === 'Remove' ? '#D40043' : text.primary,
                              }}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginLeft: 50,
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 12,
                          paddingHorizontal: 9,
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
                            fontSize: 11,
                            fontWeight: '700',
                            color:
                              project.status === 'shipped'
                                ? palette.success
                                : project.status === 'active'
                                  ? palette.brand
                                  : text.primary,
                          }}
                        >
                          {statusLabel[project.status]}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole='checkbox'
                        accessibilityLabel={'Complete ' + project.name}
                        accessibilityState={{ checked: project.completed }}
                        onPress={() =>
                          setProjects((current) =>
                            current.map((item) =>
                              item.id === project.id
                                ? {
                                    ...item,
                                    completed: !item.completed,
                                    status: item.completed ? 'active' : 'shipped',
                                  }
                                : item
                            )
                          )
                        }
                        style={{
                          width: 36,
                          height: 36,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            borderWidth: 2,
                            borderColor: project.completed ? palette.brand : border,
                            backgroundColor: project.completed
                              ? palette.brand
                              : surface.canvas,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {project.completed ? <Check size={15} color='#FFFFFF' /> : null}
                        </View>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {visible.length === 0 ? (
                  <Text style={{ color: text.secondary }}>No matching projects</Text>
                ) : null}
              </View>
            ) : null}

            {section === 'settings' ? (
              <View style={{ gap: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: text.subtle,
                  }}
                >
                  WORKSPACE
                </Text>
                <View style={card}>
                  <Text style={{ color: text.primary, fontWeight: '700' }}>
                    Your workspace
                  </Text>
                  <Text style={{ color: text.secondary, fontSize: 12 }}>
                    Name shown across the dashboard
                  </Text>
                  <TextInput
                    accessibilityLabel='Workspace name'
                    value={workspaceName}
                    onChangeText={setWorkspaceName}
                    style={{
                      color: text.primary,
                      backgroundColor: surface.panel,
                      paddingHorizontal: 12,
                      minHeight: 42,
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 10,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: text.subtle,
                  }}
                >
                  APPEARANCE
                </Text>
                <View style={{ ...card, padding: 0, gap: 0 }}>
                  {[
                    { key: 'light', label: 'Light', Icon: Sun },
                    { key: 'dark', label: 'Dark', Icon: Moon },
                    { key: 'highContrast', label: 'High contrast', Icon: Contrast },
                  ].map(({ key, label, Icon }) => (
                    <Pressable
                      key={key}
                      accessibilityRole='radio'
                      accessibilityLabel={label}
                      accessibilityState={{ checked: themeName === key }}
                      onPress={() =>
                        setPreference(
                          key === 'highContrast'
                            ? 'high-contrast'
                            : (key as 'light' | 'dark')
                        )
                      }
                      style={{
                        minHeight: 58,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        gap: 12,
                        borderBottomWidth: key === 'highContrast' ? 0 : 1,
                        borderColor: border,
                        backgroundColor:
                          themeName === key ? palette.brandBg : surface.panel,
                      }}
                    >
                      <Icon size={19} color={text.primary} />
                      <Text style={{ flex: 1, color: text.primary }}>{label}</Text>
                      {themeName === key ? (
                        <Check size={18} color={palette.brand} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: text.subtle,
                  }}
                >
                  PREFERENCES
                </Text>
                <View
                  style={{
                    ...card,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: text.primary, fontWeight: '700' }}>
                    Product notifications
                  </Text>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                    accessibilityLabel='Product notifications'
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: text.subtle,
                  }}
                >
                  DATA
                </Text>
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel='Restore sample data'
                  onPress={() => {
                    setProjects(seedProjects);
                    setWorkspaceName('Demo Workspace');
                    setNotifications(true);
                    setFilter('all');
                    setQuery('');
                    setRemoved(null);
                  }}
                  style={{
                    ...card,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Refresh size={20} color={palette.brand} />
                  <Text style={{ color: text.primary }}>Restore sample data</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <View
            accessibilityRole='tablist'
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderColor: border,
              paddingVertical: 8,
              paddingHorizontal: 8,
              justifyContent: 'space-around',
              backgroundColor: surface.canvas,
            }}
          >
            {[
              { key: 'overview' as const, label: 'Dashboard', Icon: Grid },
              { key: 'projects' as const, label: 'Projects', Icon: Folder },
              { key: 'settings' as const, label: 'Settings', Icon: Settings },
            ].map(({ key, label, Icon }) => (
              <Pressable
                key={key}
                accessibilityRole='tab'
                accessibilityLabel={label}
                accessibilityState={{ selected: section === key }}
                onPress={() => {
                  setSection(key);
                  setMenuId(null);
                }}
                style={{
                  flex: 1,
                  height: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  size={21}
                  color={section === key ? palette.brand : text.subtle}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {createOpen ? (
          <div className={styles.sheetBackdrop}>
            <div
              className={styles.editorSheet}
              role='dialog'
              aria-modal='true'
              aria-label={editingId === null ? 'New project' : 'Edit project'}
              style={{
                backgroundColor: surface.panel,
                color: text.primary,
                borderColor: border,
              }}
            >
              <div className={styles.sheetHeader}>
                <button
                  type='button'
                  onClick={() => setCreateOpen(false)}
                >
                  Close
                </button>
                <strong>{editingId === null ? 'New project' : 'Edit project'}</strong>
                <button
                  type='button'
                  disabled={!draftName.trim()}
                  onClick={() => {
                    setProjects((current) =>
                      editingId === null
                        ? [
                            {
                              id: Math.max(...current.map((item) => item.id), 0) + 1,
                              name: draftName.trim(),
                              description: '',
                              status: 'planned',
                              completed: false,
                            },
                            ...current,
                          ]
                        : current.map((project) =>
                            project.id === editingId
                              ? { ...project, name: draftName.trim() }
                              : project
                          )
                    );
                    setSection('projects');
                    setCreateOpen(false);
                    setEditingId(null);
                  }}
                >
                  {editingId === null ? 'Create' : 'Save'}
                </button>
              </div>
              <label className={styles.sheetField}>
                Project name
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder='New project name'
                  autoFocus
                />
              </label>
              <p>New projects are created locally for this browser preview.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

NativeStarterPreview.displayName = 'NativeStarterPreview';
