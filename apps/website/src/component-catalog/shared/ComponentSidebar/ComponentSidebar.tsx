'use client';

import Link from 'next/link';
import { Grid } from '@vellira-ui/icons';

import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
} from '@/components/navigation/Sidebar';

import { componentGroups } from '../../registry/componentGroups';
import { useComponentNavigation } from '../ComponentNavigationProvider';

interface ComponentSidebarProps {
  activeSlug?: string;
  onNavigate?: () => void;
}

export function ComponentSidebar({
  activeSlug,
  onNavigate,
}: ComponentSidebarProps) {
  const { fromWorkspace } = useComponentNavigation();

  return (
    <Sidebar ariaLabel='Component navigation'>
      {fromWorkspace && (
        <SidebarGroup label='Workspace'>
          <SidebarItem>
            <Link href='/app' onClick={onNavigate}>
              <Grid size={18} aria-hidden='true' />
              <span>Overview</span>
            </Link>
          </SidebarItem>
        </SidebarGroup>
      )}
      {componentGroups.map((group) => (
        <SidebarGroup key={group.category} label={group.label}>
          {group.components.map((component) => (
            <SidebarItem
              key={component.slug}
              active={component.slug === activeSlug}
            >
              <Link
                href={`/components/${component.slug}${fromWorkspace ? '?from=app' : ''}`}
                prefetch={false}
                aria-current={
                  component.slug === activeSlug ? 'page' : undefined
                }
                onClick={onNavigate}
              >
                <span>{component.name}</span>

                {/*{component.status === 'beta' && <span>Beta</span>}*/}
              </Link>
            </SidebarItem>
          ))}
        </SidebarGroup>
      ))}
    </Sidebar>
  );
}
