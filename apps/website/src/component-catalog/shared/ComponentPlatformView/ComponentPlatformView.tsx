'use client';

import { Fragment, useMemo, useState } from 'react';

import type { ComponentDiscoveryMetadata } from '../../metadata';
import type { ComponentCatalogEntry, ComponentPlatform } from '../../types';
import { ComponentAccessibility as ComponentGuidance } from '../ComponentAccessibility';
import { ComponentHeader } from '../ComponentHeader';
import { ComponentDemoStateProvider } from '../ComponentDemoStateProvider';
import { componentPages } from '../../registry/componentPages';
import {
  ComponentApi,
  type ComponentApiProp,
  type ComponentApiSection,
} from '../ComponentApi';
import { RelatedComponents } from '../RelatedComponents';
import { webComponents } from '../../registry/components';

type ComponentPlatformViewProps = {
  component: ComponentCatalogEntry;
};

type ComponentPlatformApi =
  | readonly ComponentApiProp[]
  | {
      sections?: readonly ComponentApiSection[];
      props?: readonly ComponentApiProp[];
      inheritedProps?: readonly ComponentApiProp[];
    };

type ApiWithPlatformSections = Record<
  ComponentPlatform,
  ComponentPlatformApi
> & {
  inherited?: Partial<Record<ComponentPlatform, readonly ComponentApiProp[]>>;
};

type SectionedPlatformApi = Exclude<
  ComponentPlatformApi,
  readonly ComponentApiProp[]
>;

function isSectionedPlatformApi(
  api: ComponentPlatformApi
): api is SectionedPlatformApi {
  return !Array.isArray(api);
}

function getPlatformApi(
  api: ApiWithPlatformSections,
  platform: ComponentPlatform
) {
  const platformApi = api[platform];

  if (!isSectionedPlatformApi(platformApi)) {
    return {
      props: platformApi,
      sections: undefined,
      inheritedProps: api.inherited?.[platform],
    };
  }

  return {
    props: platformApi.props ?? [],
    sections: platformApi.sections,
    inheritedProps: platformApi.inheritedProps ?? api.inherited?.[platform],
  };
}

function getDiscoveryItems(
  discovery: ComponentDiscoveryMetadata | undefined,
  platform: ComponentPlatform
) {
  if (!discovery) {
    return [];
  }

  return [
    ...(discovery.whenToUse && discovery.whenToUse.length > 0
      ? [
          {
            title: 'When to use',
            description: (
              <ul>
                {discovery.whenToUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(discovery.patterns ?? []).map((pattern) => ({
      title: pattern.title,
      description: pattern.description,
    })),
    ...((discovery.platformNotes?.[platform] ?? []).length > 0
      ? [
          {
            title: platform === 'react' ? 'React notes' : 'React Native notes',
            description: (
              <ul>
                {(discovery.platformNotes?.[platform] ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
  ];
}

export function ComponentPlatformView({
  component,
}: ComponentPlatformViewProps) {
  const [platform, setPlatform] = useState<ComponentPlatform>(
    component.platforms[0] ?? 'react'
  );

  const page = componentPages[component.slug as keyof typeof componentPages];
  const discovery = (
    page as { discovery?: ComponentDiscoveryMetadata } | undefined
  )?.discovery;

  const Demo = page?.demos[platform];
  const platformApi = page
    ? getPlatformApi(page.api as ApiWithPlatformSections, platform)
    : null;
  const discoveryItems = getDiscoveryItems(discovery, platform);

  const relatedSlugs = page?.related ?? [];
  const transientStateKeys = useMemo(
    () => ['open', 'defaultOpen', 'expanded', 'defaultExpanded'],
    []
  );

  const relatedComponents: ComponentCatalogEntry[] = [];

  for (const slug of relatedSlugs) {
    const relatedComponent = webComponents.find((item) => item.slug === slug);

    if (relatedComponent) {
      relatedComponents.push(relatedComponent);
    }
  }

  return (
    <>
      <ComponentHeader
        component={component}
        platform={platform}
        onPlatformChange={setPlatform}
      />

      <ComponentDemoStateProvider
        resetKey={`${component.slug}:${platform}`}
        transientStateKeys={transientStateKeys}
      >
        <Fragment key={`${component.slug}:${platform}:demo`}>
          {Demo ? <Demo /> : null}
        </Fragment>

        {page && (
          <>
            {discovery && discoveryItems.length > 0 && (
              <ComponentGuidance
                title='Usage guidance'
                description={
                  discovery.summary ??
                  `Capability-grounded guidance for ${page.name}.`
                }
                items={discoveryItems}
              />
            )}

            <page.Usage platform={platform} />
            <Fragment key={`${component.slug}:${platform}:examples`}>
              <page.Examples platform={platform} />
            </Fragment>

            <ComponentApi
              description={`Props available for the ${
                platform === 'react' ? 'React' : 'React Native'
              } ${page.name}.`}
              inheritedProps={platformApi?.inheritedProps}
              platform={platform}
              props={platformApi?.props}
              sections={platformApi?.sections}
            />

            <page.Accessibility platform={platform} />
            <RelatedComponents components={relatedComponents} />
          </>
        )}
      </ComponentDemoStateProvider>
    </>
  );
}
