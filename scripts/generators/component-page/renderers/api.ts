import path from 'node:path';

import {
  createPackageProgram,
  extractExportedProps,
  findPlatformExportSourceFile,
  getSectionExportName,
} from '../extractors/source';
import {
  identifierFromSlug,
  isPathInside,
  toTsString,
} from '../helpers/format';
import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp, Platform } from '../model/types';

export type ApiSectionData = {
  name: string;
  ownedProps: ExtractedProp[];
};

function cleanApiType(type: string) {
  return type
    .replace(/\s*\|\s*undefined\b/g, '')
    .replace(/\bundefined\s*\|\s*/g, '')
    .trim();
}

export function getApiDefaultValue(
  prop: ExtractedProp,
  componentConfig: ComponentPageMetadata,
  platform: Platform
) {
  // Required props cannot be omitted. A configured preview example is not
  // an actual runtime default, even when the sample renders successfully.
  if (prop.required) return undefined;

  const sharedValue = componentConfig.defaults?.shared?.[prop.name];
  const platformValue =
    platform === 'react'
      ? componentConfig.defaults?.react?.[prop.name]
      : componentConfig.defaults?.native?.[prop.name];
  const value = platformValue ?? sharedValue;
  if (value === undefined) return undefined;
  return typeof value === 'string' ? `'${value}'` : String(value);
}
export function buildApiFile(params: {
  root: string;
  componentName: string;
  slug: string;
  componentConfig: ComponentPageMetadata;
  extractedProps: readonly ExtractedProp[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
  velliraApiSourceRoots: readonly string[];
  generatedFileHeader: string;
}) {
  const {
    root,
    componentName,
    slug,
    componentConfig,
    extractedProps,
    reactApiProps,
    nativeApiProps,
    velliraApiSourceRoots,
    generatedFileHeader,
  } = params;
  const slugIdentifier = identifierFromSlug(slug);

  function getSharedProp(prop: ExtractedProp) {
    return extractedProps.find((item) => item.name === prop.name);
  }

  function isExternalProp(prop: ExtractedProp) {
    if (!prop.sourceFilePath) {
      return false;
    }

    const normalizedSource = path.normalize(prop.sourceFilePath);

    return !velliraApiSourceRoots.some((sourceRoot) =>
      isPathInside(normalizedSource, sourceRoot)
    );
  }

  function getApiType(prop: ExtractedProp) {
    const sharedProp = getSharedProp(prop);
    const apiProp = isExternalProp(prop) && sharedProp ? sharedProp : prop;

    if (apiProp.kind === 'select' && apiProp.options?.length) {
      return apiProp.options.map((option) => `'${option}'`).join(' | ');
    }

    return cleanApiType(apiProp.type);
  }

  function getFallbackApiDescription(prop: ExtractedProp, platform: Platform) {
    if (!isExternalProp(prop)) {
      return `Prop for ${componentName}.`;
    }

    if (platform === 'react') {
      return 'Forwarded React DOM prop.';
    }

    return 'Forwarded React Native prop.';
  }

  function isOwnedApiProp(prop: ExtractedProp) {
    return !isExternalProp(prop) || Boolean(getSharedProp(prop));
  }

  function createApiEntries(
    props: readonly ExtractedProp[],
    platform: Platform
  ) {
    return props
      .map((prop) => {
        const defaultValue = getApiDefaultValue(
          prop,
          componentConfig,
          platform
        );
        const sharedProp = getSharedProp(prop);

        const description =
          componentConfig.api?.descriptions?.[prop.name] ||
          (isExternalProp(prop) ? sharedProp?.description : undefined) ||
          prop.description ||
          sharedProp?.description ||
          getFallbackApiDescription(prop, platform);

        return `  {
    name: ${toTsString(prop.name)},
    type: ${toTsString(getApiType(prop))},${
      defaultValue ? `\n    defaultValue: ${toTsString(defaultValue)},` : ''
    }
    description: ${toTsString(description)},${
      prop.required ? '\n    required: true,' : ''
    }
  },`;
      })
      .join('\n');
  }

  function splitApiProps(props: readonly ExtractedProp[]) {
    const ownedProps: ExtractedProp[] = [];
    const inheritedProps: ExtractedProp[] = [];

    for (const prop of props) {
      if (isOwnedApiProp(prop)) {
        ownedProps.push(prop);
      } else {
        inheritedProps.push(prop);
      }
    }

    return { ownedProps, inheritedProps };
  }

  function createConfiguredApiSections(platform: Platform): ApiSectionData[] {
    const program = createPackageProgram({ root, platform });
    const sections: ApiSectionData[] = [];

    for (const section of componentConfig.api?.sections ?? []) {
      const exportName = getSectionExportName(section, platform);

      if (!exportName) continue;

      const sourceFilePath = findPlatformExportSourceFile({
        root,
        exportName,
        platform,
        program,
      });

      if (!sourceFilePath) {
        console.log(
          `⚠️ Export ${exportName} not found for ${platform}/${componentName}`
        );
        continue;
      }

      const props = extractExportedProps({
        sourceFilePath,
        exportName,
        program,
      });

      sections.push({
        name: section.name,
        ownedProps: splitApiProps(props).ownedProps,
      });
    }

    return sections.filter((section) => section.ownedProps.length > 0);
  }

  const reactSplit = splitApiProps(
    reactApiProps.length > 0 ? reactApiProps : extractedProps
  );

  const nativeSplit = splitApiProps(
    nativeApiProps.length > 0 ? nativeApiProps : extractedProps
  );

  const reactApiSections = [
    {
      name: componentName,
      ownedProps: reactSplit.ownedProps,
    },
    ...createConfiguredApiSections('react'),
  ];

  const nativeApiSections = [
    {
      name: componentName,
      ownedProps: nativeSplit.ownedProps,
    },
    ...createConfiguredApiSections('react-native'),
  ];

  function createApiSectionEntries(
    sections: readonly ApiSectionData[],
    platform: Platform
  ) {
    return sections
      .map(
        (section) => `  {
    name: ${toTsString(section.name)},
    props: [
${createApiEntries(section.ownedProps, platform)}
    ],
  },`
      )
      .join('\n');
  }

  const reactApiSectionEntries = createApiSectionEntries(
    reactApiSections,
    'react'
  );

  const nativeApiSectionEntries = createApiSectionEntries(
    nativeApiSections,
    'react-native'
  );

  const reactInheritedApiEntries = createApiEntries(
    reactSplit.inheritedProps,
    'react'
  );

  const nativeInheritedApiEntries = createApiEntries(
    nativeSplit.inheritedProps,
    'react-native'
  );

  const content = `${generatedFileHeader}import type {
  ComponentApiProp,
  ComponentApiSection,
} from '../../shared/ComponentApi';

const react${componentName}ApiSections: readonly ComponentApiSection[] = [
${reactApiSectionEntries}
];

const native${componentName}ApiSections: readonly ComponentApiSection[] = [
${nativeApiSectionEntries}
];

const inheritedReact${componentName}Api: readonly ComponentApiProp[] = [
${reactInheritedApiEntries}
];

const inheritedNative${componentName}Api: readonly ComponentApiProp[] = [
${nativeInheritedApiEntries}
];

export const ${slugIdentifier}Api = {
  react: {
    sections: react${componentName}ApiSections,
    inheritedProps: inheritedReact${componentName}Api,
  },
  'react-native': {
    sections: native${componentName}ApiSections,
    inheritedProps: inheritedNative${componentName}Api,
  },
} as const;
`;

  return {
    content,
    reactSplit,
    nativeSplit,
    reactApiSections,
    nativeApiSections,
  };
}
