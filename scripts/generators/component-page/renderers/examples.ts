import { toLabel, toTemplateLiteral, toTsString } from '../helpers/format';
import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp, GeneratedExample, Platform } from '../model/types';
import type { ComponentProfile } from '../profiles/profiles';
import {
  indentBlock,
  normalizePropFragments,
  normalizeSetupStatements,
} from './renderer-format';

export function buildExamples(params: {
  componentName: string;
  componentConfig: ComponentPageMetadata;
  componentProfile: ComponentProfile;
  extractedProps: readonly ExtractedProp[];
  playgroundProps: readonly ExtractedProp[];
}) {
  const { componentConfig, componentProfile, extractedProps, playgroundProps } =
    params;

  function hasBooleanExtractedProp(name: string) {
    return extractedProps.some(
      (prop) => prop.name === name && prop.kind === 'boolean'
    );
  }

  function hasExtractedProp(name: string) {
    return extractedProps.some((prop) => prop.name === name);
  }

  function getSelectExample() {
    const prop = playgroundProps.find(
      (item) => item.kind === 'select' && item.options.length > 1
    );

    if (!prop || prop.kind !== 'select') {
      return null;
    }

    const initialValue =
      componentConfig.demo?.initialValues?.[prop.name] ?? prop.options[0];

    const alternative = prop.options.find((option) => option !== initialValue);

    if (!alternative) {
      return null;
    }

    return {
      title: toLabel(prop.name),
      description: `Alternative ${toLabel(prop.name).toLowerCase()} option.`,
      props: [`${prop.name}='${alternative}'`],
    } satisfies GeneratedExample;
  }

  if (componentConfig.examples) {
    return [...componentConfig.examples];
  }

  const examples: GeneratedExample[] = [
    {
      title: 'Basic',
      description:
        componentProfile === 'overlay'
          ? 'Basic trigger and floating content.'
          : componentProfile === 'navigation'
            ? 'Basic navigation structure.'
            : componentProfile === 'form-control'
              ? 'Basic form control usage.'
              : 'Basic component usage.',
      props: [],
    },
  ];

  if (hasBooleanExtractedProp('disabled')) {
    examples.push({
      title: 'Disabled',
      description: 'Disabled state.',
      props: ['disabled'],
    });
  }

  if (hasBooleanExtractedProp('checked')) {
    examples.push({
      title: 'Selected',
      description: 'Selected state.',
      props: ['checked'],
    });
  } else if (hasBooleanExtractedProp('loading')) {
    examples.push({
      title: 'Loading',
      description: 'Loading state.',
      props: ['loading'],
    });
  } else if (hasBooleanExtractedProp('open')) {
    examples.push({
      title: 'Open',
      description: 'Open state.',
      props: ['open'],
    });
  }

  if (hasExtractedProp('error')) {
    examples.push({
      title: 'Error',
      description: 'Validation error state.',
      props: [`error='Please review this option.'`],
    });
  }

  const selectExample = getSelectExample();

  if (selectExample) {
    examples.push(selectExample);
  }

  if (hasBooleanExtractedProp('required')) {
    examples.push({
      title: 'Required',
      description: 'Required form control.',
      props: ['required'],
    });
  }

  return examples;
}

function uniqueImports(imports: readonly string[]) {
  return Array.from(new Set(imports));
}

function hasPropBinding(source: string, propName: string) {
  return new RegExp(`(^|\\s)${propName}\\s*=`).test(source);
}

function isBarePropFragment(fragment: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(fragment);
}

export function renderExamples(params: {
  componentName: string;
  platforms: readonly Platform[];
  componentConfig: ComponentPageMetadata;
  generatedExamples: readonly GeneratedExample[];
  generatedFileHeader: string;
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
  getDemoProps(platform: Platform): string;
}) {
  const {
    componentName,
    platforms,
    componentConfig,
    generatedExamples,
    generatedFileHeader,
    reactApiProps,
    nativeApiProps,
    getDemoProps,
  } = params;

  function getApiProps(platform: Platform) {
    return platform === 'react' ? reactApiProps : nativeApiProps;
  }

  function hasApiProp(platform: Platform, propName: string) {
    return getApiProps(platform).some((prop) => prop.name === propName);
  }

  function validateMetadataPropFragments(
    platform: Platform,
    example: GeneratedExample,
    fragments: readonly string[]
  ) {
    for (const fragment of fragments) {
      if (!isBarePropFragment(fragment)) {
        continue;
      }

      const apiProp = getApiProps(platform).find(
        (prop) => prop.name === fragment
      );

      if (!apiProp) {
        throw new Error(
          `Example "${example.title}" ${platform} prop fragment "${fragment}" does not match the component API. Use an explicit JSX prop fragment for forwarded attributes.`
        );
      }

      if (apiProp.kind !== 'boolean') {
        throw new Error(
          `Example "${example.title}" ${platform} prop fragment "${fragment}" uses bare JSX syntax for non-boolean prop "${fragment}". Provide an explicit assignment such as ${fragment}='value' or ${fragment}={value}.`
        );
      }
    }
  }

  function getExampleMetadataProps(
    platform: Platform,
    example: GeneratedExample
  ) {
    const fragments = normalizePropFragments([
      ...example.props,
      ...(platform === 'react'
        ? (example.reactProps ?? [])
        : (example.nativeProps ?? [])),
    ]);

    validateMetadataPropFragments(platform, example, fragments);

    return fragments;
  }

  function getExampleSetup(platform: Platform, example: GeneratedExample) {
    const platformSetup =
      platform === 'react'
        ? (componentConfig.react?.setup ?? [])
        : (componentConfig.native?.setup ?? []);

    return normalizeSetupStatements([
      ...platformSetup,
      ...(example.setup ?? []),
      ...(platform === 'react'
        ? (example.reactSetup ?? [])
        : (example.nativeSetup ?? [])),
    ]);
  }

  function containsGeneratedComponentRoot(source: string) {
    const marker = `<${componentName}`;
    let index = source.indexOf(marker);

    while (index !== -1) {
      const nextCharacter = source[index + marker.length];

      if (
        nextCharacter === '>' ||
        (nextCharacter !== undefined && nextCharacter.trim() === '')
      ) {
        return true;
      }

      index = source.indexOf(marker, index + marker.length);
    }

    return false;
  }

  function getExampleChildren(platform: Platform, example: GeneratedExample) {
    const platformChildren =
      platform === 'react' ? example.reactChildren : example.nativeChildren;

    if (platformChildren && containsGeneratedComponentRoot(platformChildren)) {
      const field = platform === 'react' ? 'reactChildren' : 'nativeChildren';

      throw new Error(
        `Example "${example.title}" ${field} must contain inner child markup, not a second <${componentName}> root. Put root props in ${platform === 'react' ? 'reactProps' : 'nativeProps'}.`
      );
    }

    return platform === 'react'
      ? (example.reactChildren ?? componentConfig.react?.children ?? '')
      : (example.nativeChildren ?? componentConfig.native?.children ?? '');
  }

  function getExampleProps(platform: Platform, example: GeneratedExample) {
    const inheritedDemoProps =
      example.inheritDemoProps === false ? '' : getDemoProps(platform);
    const metadataProps = getExampleMetadataProps(platform, example);
    const existingBindings = [inheritedDemoProps, ...metadataProps].join('\n');

    const shortcutProps =
      example.inheritDemoProps === false
        ? []
        : [
            componentConfig.demo?.label &&
            hasApiProp(platform, 'label') &&
            !hasPropBinding(existingBindings, 'label')
              ? `label=${toTsString(componentConfig.demo.label)}`
              : '',
            componentConfig.demo?.description &&
            hasApiProp(platform, 'description') &&
            !hasPropBinding(existingBindings, 'description')
              ? `description=${toTsString(componentConfig.demo.description)}`
              : '',
          ].filter(Boolean);

    return normalizePropFragments([
      inheritedDemoProps,
      ...shortcutProps,
      ...metadataProps,
    ]);
  }

  function createExampleJsx(
    platform: Platform,
    example: GeneratedExample,
    indentation: string
  ) {
    const componentAlias =
      platform === 'react' ? `React${componentName}` : `Native${componentName}`;

    const props = getExampleProps(platform, example);
    const exampleChildren = getExampleChildren(platform, example);
    const childIndentation = `${indentation}  `;

    const propsText =
      props.length === 0
        ? ''
        : `\n${childIndentation}${props.join(`\n${childIndentation}`)}`;

    if (!exampleChildren) {
      return `${indentation}<${componentAlias}${propsText}\n${indentation}/>`;
    }

    const aliasedChildren = exampleChildren
      .replaceAll(`<${componentName}.`, `<${componentAlias}.`)
      .replaceAll(`</${componentName}.`, `</${componentAlias}.`);

    const formattedChildren = aliasedChildren
      .split('\n')
      .map((line) => `${childIndentation}${line}`)
      .join('\n');

    return `${indentation}<${componentAlias}${propsText}\n${indentation}>\n${formattedChildren}\n${indentation}</${componentAlias}>`;
  }

  function createExampleCodeJsx(platform: Platform, example: GeneratedExample) {
    const props = getExampleProps(platform, example);
    const propsText = props.length === 0 ? '' : `\n  ${props.join('\n  ')}\n`;
    const exampleChildren = getExampleChildren(platform, example);

    if (!exampleChildren) {
      return `<${componentName}${propsText}/>`;
    }

    const formattedChildren = exampleChildren
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');

    return `<${componentName}${propsText}>\n${formattedChildren}\n</${componentName}>`;
  }

  function createExampleCode(platform: Platform, example: GeneratedExample) {
    const packageName =
      platform === 'react' ? '@vellira-ui/react' : '@vellira-ui/react-native';

    const imports = uniqueImports([
      `import { ${componentName} } from '${packageName}';`,
      ...(platform === 'react'
        ? (componentConfig.react?.imports ?? [])
        : (componentConfig.native?.imports ?? [])),
      ...(example.imports ?? []),
      ...(platform === 'react'
        ? (example.reactImports ?? [])
        : (example.nativeImports ?? [])),
    ]).join('\n');

    const jsx = createExampleCodeJsx(platform, example);
    const setup = getExampleSetup(platform, example);

    if (setup.length === 0) {
      return `${imports}\n\n${jsx}`;
    }

    const setupText = setup
      .map((statement) => indentBlock(statement, '  '))
      .join('\n');

    return `${imports}\n\nfunction Example() {\n${setupText}\n\n  return (\n${indentBlock(jsx, '    ')}\n  );\n}`;
  }

  function getExamplesForPlatform(platform: Platform) {
    if (!platforms.includes(platform)) {
      return [];
    }

    return generatedExamples.filter(
      (example) => !example.platforms || example.platforms.includes(platform)
    );
  }

  function getPreviewComponentName(platform: Platform, index: number) {
    const prefix = platform === 'react' ? 'React' : 'Native';
    return `${prefix}${componentName}Example${index + 1}Preview`;
  }

  function createPreviewComponent(
    platform: Platform,
    example: GeneratedExample,
    index: number
  ) {
    const setup = getExampleSetup(platform, example);

    if (setup.length === 0) {
      return '';
    }

    const setupText = setup
      .map((statement) => indentBlock(statement, '  '))
      .join('\n');
    const previewName = getPreviewComponentName(platform, index);

    return `function ${previewName}() {\n${setupText}\n\n  return (\n${createExampleJsx(platform, example, '    ')}\n  );\n}`;
  }

  function createPreview(
    platform: Platform,
    example: GeneratedExample,
    index: number
  ) {
    if (getExampleSetup(platform, example).length > 0) {
      return `<${getPreviewComponentName(platform, index)} />`;
    }

    return `(\n${createExampleJsx(platform, example, '        ')}\n      )`;
  }

  const exampleImports = Array.from(
    new Set(
      generatedExamples.flatMap((example) => {
        const examplePlatforms = platforms.filter(
          (platform) =>
            !example.platforms || example.platforms.includes(platform)
        );

        if (examplePlatforms.length === 0) {
          return [];
        }

        return [
          ...(example.imports ?? []),
          ...(examplePlatforms.includes('react')
            ? (example.reactImports ?? [])
            : []),
          ...(examplePlatforms.includes('react-native')
            ? (example.nativeImports ?? [])
            : []),
          ...(examplePlatforms.includes('react')
            ? (componentConfig.react?.imports ?? [])
            : []),
          ...(examplePlatforms.includes('react-native')
            ? (componentConfig.native?.imports ?? [])
            : []),
        ];
      })
    )
  );

  const reactExamples = getExamplesForPlatform('react');
  const nativeExamples = getExamplesForPlatform('react-native');

  const previewComponents = [
    ...reactExamples.map((example, index) =>
      createPreviewComponent('react', example, index)
    ),
    ...nativeExamples.map((example, index) =>
      createPreviewComponent('react-native', example, index)
    ),
  ]
    .filter(Boolean)
    .join('\n\n');

  const reactGeneratedExamples = reactExamples
    .map(
      (example, index) => `    {
      title: ${toTsString(example.title)},
      description: ${toTsString(example.description)},
      preview: ${createPreview('react', example, index)},
      code: ${toTemplateLiteral(createExampleCode('react', example))},
    },`
    )
    .join('\n');

  const nativeGeneratedExamples = nativeExamples
    .map(
      (example, index) => `    {
      title: ${toTsString(example.title)},
      description: ${toTsString(example.description)},
      preview: ${createPreview('react-native', example, index)},
      code: ${toTemplateLiteral(createExampleCode('react-native', example))},
    },`
    )
    .join('\n');

  const componentImports = [
    ...(platforms.includes('react')
      ? [
          `import { ${componentName} as React${componentName} } from '@vellira-ui/react';`,
        ]
      : []),
    ...(platforms.includes('react-native')
      ? [
          `import { ${componentName} as Native${componentName} } from '@vellira-ui/react-native';`,
        ]
      : []),
  ];

  return `${generatedFileHeader}'use client';

${componentImports.join('\n')}
${exampleImports.join('\n')}

import { ComponentExamples } from '../../shared/ComponentExamples';
import type { ComponentPlatform } from '../../types';

${previewComponents ? `${previewComponents}\n\n` : ''}type ${componentName}ExamplesProps = {
  platform: ComponentPlatform;
};

export function ${componentName}Examples({
  platform,
}: ${componentName}ExamplesProps) {
  const reactExamples = [
${reactGeneratedExamples}
  ] as const;

  const nativeExamples = [
${nativeGeneratedExamples}
  ] as const;

  return (
    <ComponentExamples
      items={platform === 'react' ? reactExamples : nativeExamples}
    />
  );
}
`;
}
