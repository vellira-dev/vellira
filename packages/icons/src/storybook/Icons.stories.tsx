import type { Meta, StoryObj } from '@storybook/react-vite';
import * as staticIcons from '@vellira-ui/icons';
import {
  type AnimatedIconData,
  animatedIconManifest,
  type AnimatedIconName,
  animatedIcons,
} from '@vellira-ui/icons/lottie';
import type { ComponentType, CSSProperties, SVGProps } from 'react';

import { AnimatedIconPreview } from './AnimatedIconPreview';

type StaticIconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    color?: string;
  }
>;

type StaticIconName = keyof typeof staticIcons;

const meta = {
  title: 'Icons/Overview',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Static SVG icons and animated lottie icons from @vellira-ui/icons.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pageStyle = {
  minHeight: '100vh',
  padding: 32,
  color: 'var(--text-primary)',
  background: 'var(--background-primary)',
} satisfies CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: 16,
  marginBottom: 40,
} satisfies CSSProperties;

const headingStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
} satisfies CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))',
  gap: 8,
} satisfies CSSProperties;

const cardStyle = {
  display: 'grid',
  gridTemplateRows: '44px auto',
  alignItems: 'center',
  justifyItems: 'center',
  minWidth: 0,
  minHeight: 84,
  padding: 12,
  border: '1px solid var(--border-muted)',
  borderRadius: 8,
  color: 'var(--text-brand)',
  background: 'color-mix(in srgb, var(--background-primary) 94%, currentColor)',
} satisfies CSSProperties;

const labelStyle = {
  maxWidth: '100%',
  overflow: 'hidden',
  color: 'var(--text-secondary)',
  fontSize: 12,
  lineHeight: '16px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties;

const categoryStyle = {
  display: 'grid',
  gap: 10,
} satisfies CSSProperties;

const categoryHeadingStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 700,
} satisfies CSSProperties;

const staticIconCategories = [
  {
    category: 'Actions',
    icons: [
      'Check',
      'Copy',
      'Download',
      'Edit',
      'Filter',
      'Minus',
      'Plus',
      'Refresh',
      'Search',
      'Share',
      'Trash',
      'Upload',
    ],
  },
  {
    category: 'Commerce',
    icons: [
      'Bag',
      'Cart',
      'CreditCard',
      'Dollar',
      'Euro',
      'Gift',
      'Package',
      'Percent',
      'Receipt',
      'Tag',
      'Truck',
      'Wallet',
    ],
  },
  {
    category: 'Communication',
    icons: [
      'At',
      'Bell',
      'BellOff',
      'Book',
      'Chat',
      'Doc',
      'Docs',
      'Inbox',
      'Mail',
      'Message',
      'Microphone',
      'MicrophoneOff',
      'Phone',
      'Send',
      'Video',
      'Website',
    ],
  },
  {
    category: 'Interface',
    icons: [
      'Grid',
      'Laptop',
      'Link',
      'List',
      'Menu',
      'Monitor',
      'MoreHorizontal',
      'MoreVertical',
      'Printer',
      'QrCode',
      'Smartphone',
      'Tablet',
    ],
  },
  {
    category: 'Media',
    icons: [
      'FastForward',
      'Headphones',
      'Pause',
      'Play',
      'Rewind',
      'SkipBack',
      'SkipForward',
      'Stop',
      'Volume',
      'VolumeHigh',
      'VolumeLow',
      'VolumeOff',
    ],
  },
  {
    category: 'Navigation',
    icons: [
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ChevronDown',
      'ChevronLeft',
      'ChevronRight',
      'ChevronUp',
      'Close',
      'Collapse',
      'Expand',
    ],
  },
  {
    category: 'Status',
    icons: [
      'Bookmark',
      'Error',
      'Eye',
      'EyeOff',
      'Heart',
      'Help',
      'Info',
      'Loader',
      'Pin',
      'Star',
      'Success',
      'Warning',
    ],
  },
  {
    category: 'System',
    icons: [
      'ArrowLeftRight',
      'ArrowTopButton',
      'Calendar',
      'Camera',
      'Clock',
      'Contrast',
      'Exit',
      'File',
      'Folder',
      'FolderOpen',
      'Home',
      'Image',
      'Lock',
      'LockOpen',
      'Moon',
      'Save',
      'Settings',
      'Sun',
      'System',
      'User',
      'Users',
    ],
  },
] satisfies Array<{ category: string; icons: StaticIconName[] }>;

function renderStaticIconCategories() {
  return staticIconCategories.map(({ category, icons }) => (
    <div key={category} style={categoryStyle}>
      <h3 style={categoryHeadingStyle}>{category}</h3>
      <div style={gridStyle}>
        {icons.map((name) => {
          const Icon = staticIcons[name] as StaticIconComponent;

          return (
            <div key={name} style={cardStyle} title={name}>
              <Icon aria-hidden='true' size={24} />
              <span style={labelStyle}>{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  ));
}

const animatedIconsByCategory = animatedIconManifest.icons.reduce<
  Record<string, Array<[AnimatedIconName, AnimatedIconData]>>
>((groups, icon) => {
  const name = icon.name as AnimatedIconName;
  const data = animatedIcons[name];

  if (!data) return groups;

  groups[icon.category] ??= [];
  groups[icon.category].push([name, data]);

  return groups;
}, {});

export const Static: Story = {
  render: () => (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Static icons</h2>
        {renderStaticIconCategories()}
      </section>
    </main>
  ),
};

export const Animated: Story = {
  render: () => (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Animated icons</h2>
        {Object.entries(animatedIconsByCategory).map(([category, icons]) => (
          <div key={category} style={categoryStyle}>
            <h3 style={categoryHeadingStyle}>{category}</h3>
            <div style={gridStyle}>
              {icons.map(([name, data]) => (
                <div
                  key={name}
                  data-animated-icon-trigger=''
                  style={cardStyle}
                  title={name}
                >
                  <AnimatedIconPreview data={data} size={24} />
                  <span style={labelStyle}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  ),
};

export const All: Story = {
  render: () => (
    <main style={pageStyle}>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Static icons</h2>
        {renderStaticIconCategories()}
      </section>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Animated icons</h2>
        {Object.entries(animatedIconsByCategory).map(([category, icons]) => (
          <div key={category} style={categoryStyle}>
            <h3 style={categoryHeadingStyle}>{category}</h3>
            <div style={gridStyle}>
              {icons.map(([name, data]) => (
                <div
                  key={name}
                  data-animated-icon-trigger=''
                  style={cardStyle}
                  title={name}
                >
                  <AnimatedIconPreview data={data} size={24} />
                  <span style={labelStyle}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  ),
};
