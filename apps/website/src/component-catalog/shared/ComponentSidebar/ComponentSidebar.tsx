import Link from 'next/link';

import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
} from '@/components/navigation/Sidebar';

import { componentGroups } from '../../registry/componentGroups';

interface ComponentSidebarProps {
  activeSlug?: string;
  onNavigate?: () => void;
}

export function ComponentSidebar({
  activeSlug,
  onNavigate,
}: ComponentSidebarProps) {
  return (
    <Sidebar ariaLabel='Component navigation'>
      {componentGroups.map((group) => (
        <SidebarGroup key={group.category} label={group.label}>
          {group.components.map((component) => (
            <SidebarItem
              key={component.slug}
              active={component.slug === activeSlug}
            >
              <Link
                href={`/components/${component.slug}`}
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
