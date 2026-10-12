import { toTemplateLiteral, toTsLiteral } from '../helpers/format';
import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp, Platform } from '../model/types';
import {
  indentBlock,
  normalizePropFragments,
  normalizeSetupStatements,
} from './renderer-format';

export function renderUsage(params: {
  componentName: string;
  componentConfig: ComponentPageMetadata;
  playgroundProps: readonly ExtractedProp[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
  generatedFileHeader: string;
  getDemoProps(platform: Platform): string;
}) {
  const {
    componentName,
    componentConfig,
    playgroundProps,
    reactApiProps,
    nativeApiProps,
    generatedFileHeader,
    getDemoProps,
  } = params;

  function hasApiProp(platform: Platform, propName: string) {
    const apiProps = platform === 'react' ? reactApiProps : nativeApiProps;

    return apiProps.some((prop) => prop.name === propName);
  }

  function hasPropBinding(source: string, propName: string) {
    return new RegExp(`(^|\\s)${propName}\\s*=`).test(source);
  }

  function encodeStaticShortcut(name: string, value: string) {
    // Static preview strings are markup, not trusted JSX source. Keep the
    // existing concise single-quoted form for safe literals.
    return /['\r\n\t&<>{}]/.test(value)
      ? `${name}={${JSON.stringify(value)}}`
      : `${name}='${value}'`;
  }
  const controlledProps = new Set(playgroundProps.map((prop) => prop.name));

  function createUsageStaticProps(platform: Platform) {
    const demoProps = getDemoProps(platform);

    return normalizePropFragments(
      [
        demoProps || null,
        componentConfig.demo?.label &&
        !controlledProps.has('label') &&
        hasApiProp(platform, 'label') &&
        !hasPropBinding(demoProps, 'label')
          ? encodeStaticShortcut('label', componentConfig.demo.label)
          : null,
        componentConfig.demo?.description &&
        !controlledProps.has('description') &&
        hasApiProp(platform, 'description') &&
        !hasPropBinding(demoProps, 'description')
          ? encodeStaticShortcut(
              'description',
              componentConfig.demo.description
            )
          : null,
      ].filter((prop): prop is string => Boolean(prop))
    )
      .map((prop) => `        ${toTemplateLiteral(prop)},`)
      .join('\n');
  }

  function createUsageChildren(platform: Platform) {
    const children =
      platform === 'react'
        ? (componentConfig.react?.children ?? '')
        : (componentConfig.native?.children ?? '');

    if (!children) {
      return '';
    }

    return children
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
  }

  function createPlatformImports(platform: Platform) {
    const imports =
      platform === 'react'
        ? (componentConfig.react?.imports ?? [])
        : (componentConfig.native?.imports ?? []);

    return imports.length > 0 ? `\n${imports.join('\n')}` : '';
  }

  function createPlatformSetup(platform: Platform) {
    const setup =
      platform === 'react'
        ? (componentConfig.react?.setup ?? [])
        : (componentConfig.native?.setup ?? []);

    return normalizeSetupStatements(setup)
      .map((statement) => indentBlock(statement, '  '))
      .join('\n');
  }

  const reactUsageStaticProps = createUsageStaticProps('react');
  const nativeUsageStaticProps = createUsageStaticProps('react-native');
  const reactUsageChildren = createUsageChildren('react');
  const nativeUsageChildren = createUsageChildren('react-native');
  const reactPlatformImports = createPlatformImports('react');
  const nativePlatformImports = createPlatformImports('react-native');
  const reactPlatformSetup = createPlatformSetup('react');
  const nativePlatformSetup = createPlatformSetup('react-native');
  const hasPlatformSetup = Boolean(reactPlatformSetup || nativePlatformSetup);
  const hasPlaygroundState = playgroundProps.length > 0;
  const usageValueParameter = hasPlaygroundState
    ? `,\n  value: ${componentName}PlaygroundValue`
    : '';
  const usageValueArgument = hasPlaygroundState ? ', value' : '';
  const demoStateImport = hasPlaygroundState
    ? `import { useComponentDemoState } from '../../shared/ComponentDemoStateProvider';\n\nimport {\n  initial${componentName}PlaygroundValue,\n  type ${componentName}PlaygroundValue,\n} from './${componentName}Playground';\n\n`
    : '';
  const demoStateUsage = hasPlaygroundState
    ? `  const [value] =\n    useComponentDemoState<${componentName}PlaygroundValue>(\n      initial${componentName}PlaygroundValue\n    );\n\n`
    : '';
  const setupAwareCode = hasPlatformSetup
    ? `
  const imports = \`import { ${componentName} } from '\${packageName}';\${platform === 'react' ? ${toTemplateLiteral(reactPlatformImports)} : ${toTemplateLiteral(nativePlatformImports)}}\`;

  const setup =
    platform === 'react'
      ? ${toTemplateLiteral(reactPlatformSetup)}
      : ${toTemplateLiteral(nativePlatformSetup)};

  const root = !children
    ? \`<${componentName}\${propsText}/>\`
    : \`<${componentName}\${propsText}>
\${children}
</${componentName}>\`;

  if (setup) {
    const indentedRoot = root
      .split('\\n')
      .map((line) => \`    \${line}\`)
      .join('\\n');

    return \`\${imports}

function Example() {
\${setup}

  return (
\${indentedRoot}
  );
}\`;
  }

  return \`\${imports}

\${root}\`;`
    : `
  if (!children) {
    return \`import { ${componentName} } from '\${packageName}';
\${platform === 'react' ? ${toTemplateLiteral(reactPlatformImports)} : ${toTemplateLiteral(nativePlatformImports)}}

<${componentName}\${propsText}/>\`;
  }

  return \`import { ${componentName} } from '\${packageName}';
\${platform === 'react' ? ${toTemplateLiteral(reactPlatformImports)} : ${toTemplateLiteral(nativePlatformImports)}}

<${componentName}\${propsText}>
\${children}
</${componentName}>\`;`;

  function omissionDefault(prop: ExtractedProp, platform: Platform) {
    return (
      (platform === 'react'
        ? componentConfig.defaults?.react?.[prop.name]
        : componentConfig.defaults?.native?.[prop.name]) ??
      componentConfig.defaults?.shared?.[prop.name]
    );
  }

  function renderDynamicProp(prop: ExtractedProp) {
    const react = reactApiProps.find(
      (candidate) => candidate.name === prop.name
    );
    const native = nativeApiProps.find(
      (candidate) => candidate.name === prop.name
    );
    const onReact = Boolean(react);
    const onNative = Boolean(native);
    const platformGuard =
      onReact && onNative
        ? ''
        : onReact
          ? "platform === 'react'"
          : "platform === 'react-native'";
    const value = `value.${prop.name}`;
    const reactDefault = omissionDefault(prop, 'react');
    const nativeDefault = omissionDefault(prop, 'react-native');

    function differentFromOmissionDefault() {
      const compare = (known: string | number | boolean | undefined) =>
        known === undefined ? 'true' : `${value} !== ${toTsLiteral(known)}`;
      if (onReact && onNative) {
        if (reactDefault === nativeDefault) return compare(reactDefault);
        return `(platform === 'react' ? ${compare(reactDefault)} : ${compare(nativeDefault)})`;
      }
      return compare(onReact ? reactDefault : nativeDefault);
    }

    function emit(statement: string, condition?: string) {
      const checks = [platformGuard, condition].filter(
        (part): part is string => Boolean(part) && part !== 'true'
      );
      return checks.length
        ? `  if (${checks.join(' && ')}) {\n    ${statement}\n  }`
        : `  ${statement}`;
    }

    const required = Boolean(react?.required || native?.required);
    if (prop.kind === 'boolean') {
      if (required || reactDefault === true || nativeDefault === true) {
        const statement = `props.push(\`${prop.name}={\${${value}}}\`);`;
        return emit(
          statement,
          required ? undefined : differentFromOmissionDefault()
        );
      }
      return emit(`props.push('${prop.name}');`, value);
    }

    if (prop.kind === 'string') {
      // Serialize the actual string as a JSX expression, not an unescaped
      // quoted attribute. Quotes, apostrophes, braces and newlines stay safe.
      const statement = `props.push(\`${prop.name}={\${JSON.stringify(${value})}}\`);`;
      if (required) {
        const requiredOnlyOnOnePlatform =
          (react?.required && native && !native.required) ||
          (native?.required && react && !react.required);
        const condition = requiredOnlyOnOnePlatform
          ? `(${react?.required ? "platform === 'react'" : "platform === 'react-native'"} || ${value})`
          : undefined;
        return emit(statement, condition);
      }
      // Playground maps an empty optional string to undefined. Copying an
      // explicit empty value would break parity with the visible preview.
      return emit(statement, value);
    }

    // Never use a demo's initial value as omission authority. Required
    // numeric/select values must be serialized even if configured metadata
    // happens to have the same value.
    const statement = `props.push(\`${prop.name}={\${JSON.stringify(${value})}}\`);`;
    if (react?.required && native?.required) return emit(statement);
    if (react?.required && onNative) {
      return emit(
        statement,
        `(platform === 'react' || ${differentFromOmissionDefault()})`
      );
    }
    if (native?.required && onReact) {
      return emit(
        statement,
        `(platform === 'react-native' || ${differentFromOmissionDefault()})`
      );
    }
    return emit(
      statement,
      required ? undefined : differentFromOmissionDefault()
    );
  }

  const dynamicPropHandlers = playgroundProps
    .map(renderDynamicProp)
    .join('\n\n');
  const requiredStringControls = playgroundProps.flatMap((prop) => {
    if (prop.kind !== 'string') return [];
    const onReact = reactApiProps.some(
      (candidate) => candidate.name === prop.name && candidate.required
    );
    const onNative = nativeApiProps.some(
      (candidate) => candidate.name === prop.name && candidate.required
    );
    if (!onReact && !onNative) return [];
    const platform =
      onReact && onNative
        ? ''
        : onReact
          ? "platform === 'react' && "
          : "platform === 'react-native' && ";
    return [`(${platform}!value.${prop.name}.trim())`];
  });
  const missingRequiredDeclaration = requiredStringControls.length
    ? `  const hasMissingRequiredValue = ${requiredStringControls.join(' || ')};\n\n`
    : '';
  const codeBlock = requiredStringControls.length
    ? `      {hasMissingRequiredValue && (\n        <p role='alert' className={styles.description}>\n          Complete the required fields before copying this example.\n        </p>\n      )}\n      <ComponentCodeBlock code={code} copyEnabled={!hasMissingRequiredValue} />`
    : '      <ComponentCodeBlock code={code} />';
  const content = `${generatedFileHeader}'use client';

import type { ComponentPlatform } from '../../types';

import { ComponentCodeBlock } from '../../shared/ComponentCodeBlock';
${demoStateImport}import styles from '../../shared/ComponentUsage.module.css';

type ${componentName}UsageProps = {
  platform: ComponentPlatform;
};

function create${componentName}Code(
  platform: ComponentPlatform${usageValueParameter}
) {
  const packageName =
    platform === 'react' ? '@vellira-ui/react' : '@vellira-ui/react-native';

  const props: string[] =
    platform === 'react'
      ? [
${reactUsageStaticProps}
        ]
      : [
${nativeUsageStaticProps}
        ];

  const children =
    platform === 'react'
      ? ${toTemplateLiteral(reactUsageChildren)}
      : ${toTemplateLiteral(nativeUsageChildren)};

${dynamicPropHandlers}

  const propsText =
    props.length === 0 ? '' : \`\\n  \${props.join('\\n  ')}\\n\`;
${setupAwareCode}
}

export function ${componentName}Usage({
  platform,
}: ${componentName}UsageProps) {
${demoStateUsage}${missingRequiredDeclaration}  const code = create${componentName}Code(platform${usageValueArgument});

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Usage</h2>

        <p className={styles.description}>
          Import the component and configure it with the same props used in the
          playground.
        </p>
      </div>

${codeBlock}
    </section>
  );
}
`;

  return {
    content,
    children: {
      react: reactUsageChildren,
      'react-native': nativeUsageChildren,
    },
  };
}
