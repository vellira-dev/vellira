import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import { qualityRoot } from '../root';

import type {
  ComponentQualityRule,
  ComponentQualityRuleContext,
} from '../types';

import { createRuleFinding as finding } from './finding';
import {
  canonicalIconExports as readCanonicalIconExports,
  canonicalIconSourcePath as resolveCanonicalIconSourcePath,
  canonicalTokenPaths as readCanonicalTokenPaths,
  canonicalTokenRegistryPath as resolveCanonicalTokenRegistryPath,
  type DesignResourcePlatform,
} from '../../../design-resources/authority';

type SourceFile = {
  filePath: string;
  source: string;
};

type ConformityException = {
  ruleId: string;
  platform?: ComponentPlatform;
  filePattern?: RegExp;
  valuePattern?: RegExp;
  reason: string;
};

const exceptions: readonly ConformityException[] = [
  {
    ruleId: 'conformity.hardcoded-geometry',
    filePattern: /Button\.(?:module\.scss|styles\.ts)$/,
    valuePattern: /\b(?:1|2|4|6|8|11|12|16|18|24|32)(?:px)?\b/,
    reason:
      'Button V1 intentionally retains established geometry values until spacing-token migration is defined.',
  },
];

function platformPackage(platform: ComponentPlatform) {
  return platform === 'react' ? 'react' : 'react-native';
}

function componentDirectory(
  root: string,
  metadata: ComponentMetadata,
  platform: ComponentPlatform
) {
  return path.join(
    root,
    'packages',
    platformPackage(platform),
    'src',
    metadata.layer,
    metadata.name
  );
}

function isImplementationStyleFile(fileName: string) {
  return (
    /\.(?:ts|tsx|css|scss)$/.test(fileName) &&
    !/(?:\.test|\.stories|\.spec)\.(?:ts|tsx)$/.test(fileName)
  );
}

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) return collectFiles(fullPath);

      return isImplementationStyleFile(entry.name) ? [fullPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readFiles(context: ComponentQualityRuleContext): SourceFile[] {
  const directory = componentDirectory(
    qualityRoot(context),
    context.metadata,
    context.platform
  );

  return collectFiles(directory).map((filePath) => ({
    filePath,
    source: fs.readFileSync(filePath, 'utf8'),
  }));
}

function isExcepted(params: {
  ruleId: string;
  context: ComponentQualityRuleContext;
  filePath: string;
  value: string;
}) {
  return exceptions.some(
    (exception) =>
      exception.ruleId === params.ruleId &&
      (!exception.platform || exception.platform === params.context.platform) &&
      (!exception.filePattern ||
        exception.filePattern.test(path.basename(params.filePath))) &&
      (!exception.valuePattern || exception.valuePattern.test(params.value))
  );
}

function lineNumberAt(source: string, index: number) {
  return source.slice(0, index).split('\n').length;
}

function sourceEvidence(
  rootDir: string,
  filePath: string,
  line: number,
  value: string
) {
  return `${path.relative(rootDir, filePath)}:${line} — ${value}`;
}

const prohibitedIconGlyphPattern = /^[▾▴▲▼▶◀→←×✕✓✔−]$/u;
const iconContextPattern =
  /(?:icon|indicator|glyph|chevron|arrow|mark|clear|close)/i;

function canonicalIconSourcePath(context: ComponentQualityRuleContext) {
  return resolveCanonicalIconSourcePath({
    root: qualityRoot(context),
    platform: context.platform as DesignResourcePlatform,
  });
}

function canonicalIconExports(context: ComponentQualityRuleContext) {
  return readCanonicalIconExports({
    root: qualityRoot(context),
    platform: context.platform as DesignResourcePlatform,
  });
}

function hasIconContext(node: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node.parent;

  for (let depth = 0; current && depth < 8; depth += 1) {
    let value = '';

    if (ts.isVariableDeclaration(current)) {
      value = current.name.getText(sourceFile);
    } else if (
      ts.isPropertyAssignment(current) ||
      ts.isPropertyDeclaration(current)
    ) {
      value = current.name.getText(sourceFile);
    } else if (ts.isJsxAttribute(current)) {
      value = current.name.getText(sourceFile);
    } else if (
      (ts.isFunctionDeclaration(current) || ts.isClassDeclaration(current)) &&
      current.name
    ) {
      value = current.name.getText(sourceFile);
    } else if (ts.isJsxElement(current)) {
      const opening = current.openingElement.getText(sourceFile);

      if (
        iconContextPattern.test(opening) ||
        /\baria-hidden\b/.test(opening) ||
        /\brole\s*=\s*['"]img['"]/.test(opening)
      ) {
        return true;
      }
    }

    if (iconContextPattern.test(value)) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function iconSourceViolations(
  context: ComponentQualityRuleContext,
  file: SourceFile
) {
  if (!/\.(?:ts|tsx)$/.test(file.filePath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    file.filePath,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    file.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations: string[] = [];

  function evidence(node: ts.Node, kind: string, value: string) {
    const line =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;

    violations.push(
      `${kind}: ${sourceEvidence(
        qualityRoot(context),
        file.filePath,
        line,
        value
      )}`
    );
  }

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const moduleName = node.moduleSpecifier.text;

      if (
        moduleName === 'react-native-svg' ||
        /\.svg(?:\?react)?$/.test(moduleName)
      ) {
        evidence(node, 'prohibited-inline-icon-resource', moduleName);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (tagName === 'svg' && hasIconContext(node, sourceFile)) {
        evidence(node, 'prohibited-inline-icon-resource', '<svg>');
      }
    }

    if (ts.isJsxText(node)) {
      const value = node.getText(sourceFile).trim();

      if (
        prohibitedIconGlyphPattern.test(value) &&
        hasIconContext(node, sourceFile)
      ) {
        evidence(node, 'prohibited-icon-glyph', JSON.stringify(value));
      }
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      prohibitedIconGlyphPattern.test(node.text.trim()) &&
      hasIconContext(node, sourceFile)
    ) {
      evidence(node, 'prohibited-icon-glyph', JSON.stringify(node.text.trim()));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function hasCanonicalIconImport(
  files: readonly SourceFile[],
  iconName: string
) {
  const escapedName = iconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `import\\s*{[^}]*\\b${escapedName}\\b[^}]*}\\s*from\\s*['"]@vellira-ui/icons(?:/(?:web|native))?['"]`
  );

  return files.some((file) => pattern.test(file.source));
}

export const iconResourceRule: ComponentQualityRule = {
  definition: {
    id: 'conformity.icon-resources',
    dimension: 'design-system',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Requires generated/component-owned UI icons to use canonical @vellira-ui/icons resources and rejects improvised glyph or inline SVG fallbacks.',
  },
  completionGuidance() {
    return {
      summary:
        'Use only canonical Vellira icon resources. Never invent a Unicode glyph, local SVG, react-native-svg icon, or third-party icon fallback.',
      evidence: [
        'import existing icons from @vellira-ui/icons',
        'requirements.icons declares required canonical icon name and semantic purpose when the component owns an icon requirement',
        'if a required icon is missing, add the canonical icon resource first and rerun generation/completion',
        'do not substitute Unicode/ASCII glyphs or inline/local SVG markup',
      ],
    };
  },
  evaluate(context) {
    const files = readFiles(context);
    const violations = files.flatMap((file) =>
      iconSourceViolations(context, file)
    );
    const requiredIcons = context.metadata.requirements.icons ?? [];

    if (requiredIcons.length > 0) {
      const exports = canonicalIconExports(context);

      if (!exports) {
        violations.push(
          `missing-icon-resource-registry: ${path.relative(
            qualityRoot(context),
            canonicalIconSourcePath(context)
          )} is missing`
        );
      } else {
        for (const requirement of requiredIcons) {
          if (!exports.has(requirement.name)) {
            violations.push(
              `missing-icon-resource: name="${requirement.name}" purpose="${requirement.purpose}" — expected canonical export from @vellira-ui/icons`
            );
            continue;
          }

          if (!hasCanonicalIconImport(files, requirement.name)) {
            violations.push(
              `missing-icon-usage: name="${requirement.name}" purpose="${requirement.purpose}" — import and use the canonical @vellira-ui/icons export`
            );
          }
        }
      }
    }

    return violations.length === 0
      ? finding(iconResourceRule, context, 'pass')
      : finding(
          iconResourceRule,
          context,
          'fail',
          'Non-canonical or missing icon resources found. Use an existing @vellira-ui/icons export; if the required resource does not exist, add it canonically before regenerating.',
          violations.slice(0, 8)
        );
  },
};

const hardcodedColorPattern =
  /(?<![-\w])(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g;

export const hardcodedColorRule: ComponentQualityRule = {
  definition: {
    id: 'conformity.hardcoded-color',
    dimension: 'design-system',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Rejects hardcoded color literals in component implementation/style files where Vellira token/theme values should be used.',
  },
  completionGuidance() {
    return {
      summary:
        'Use Vellira token/theme colors only. Never hardcode a fallback color when a semantic design token is missing.',
      evidence: [
        'Web: CSS custom properties / established @styles token integration',
        'React Native: theme.tokens.*, theme.components.*, or theme.semantic.*',
        'if the required semantic token does not exist, add the canonical token first and rerun completion',
      ],
    };
  },
  evaluate(context) {
    const violations: string[] = [];

    for (const file of readFiles(context)) {
      for (const match of file.source.matchAll(hardcodedColorPattern)) {
        const value = match[0];

        if (
          isExcepted({
            ruleId: hardcodedColorRule.definition.id,
            context,
            filePath: file.filePath,
            value,
          })
        ) {
          continue;
        }

        violations.push(
          sourceEvidence(
            qualityRoot(context),
            file.filePath,
            lineNumberAt(file.source, match.index ?? 0),
            value
          )
        );
      }
    }

    return violations.length === 0
      ? finding(hardcodedColorRule, context, 'pass')
      : finding(
          hardcodedColorRule,
          context,
          'fail',
          'Hardcoded color literals found; use Vellira tokens/theme values or register a narrow explicit exception.',
          violations.slice(0, 8)
        );
  },
};

function hasWebTokenEvidence(source: string) {
  return (
    /\bvar\(--[a-z0-9-]+\)/i.test(source) || /@use\s+['"]@styles\//.test(source)
  );
}

function hasNativeTokenEvidence(source: string) {
  return (
    /\btheme\.tokens\./.test(source) ||
    /\btheme\.components\./.test(source) ||
    /\btheme\.semantic\./.test(source)
  );
}

function hasWebTokenRelevantDesignProperties(source: string) {
  return /\b(?:color|background(?:-color)?|border(?:-color|-radius)?|font-(?:family|size|weight)|line-height|box-shadow|padding(?:-(?:inline|block|top|right|bottom|left))?|margin(?:-(?:inline|block|top|right|bottom|left))?|gap)\s*:/.test(
    source
  );
}

function hasNativeTokenRelevantDesignProperties(source: string) {
  return /\b(?:color|backgroundColor|borderColor|borderRadius|fontFamily|fontSize|fontWeight|lineHeight|shadowColor|shadowRadius|padding|paddingHorizontal|paddingVertical|margin|gap)\s*:/.test(
    source
  );
}

function canonicalTokenRegistryPath(context: ComponentQualityRuleContext) {
  return resolveCanonicalTokenRegistryPath(qualityRoot(context));
}

function canonicalTokenPaths(
  context: ComponentQualityRuleContext
): Set<string> | null {
  return readCanonicalTokenPaths(qualityRoot(context));
}

export const tokenIntegrationRule: ComponentQualityRule = {
  definition: {
    id: 'conformity.token-integration',
    dimension: 'design-system',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks platform-appropriate Vellira token/theme integration in styled components.',
  },
  completionGuidance(context) {
    return context.platform === 'react'
      ? {
          summary:
            'Use Vellira token/style integration for styled web component surfaces.',
          evidence: [
            'CSS custom property via var(--...)',
            '@use from @styles',
            'if a required semantic token is missing, add it canonically before rerunning completion; do not hardcode a substitute',
          ],
        }
      : {
          summary:
            'Use NativeTheme values for token-relevant React Native styling.',
          evidence: [
            'theme.tokens.*',
            'theme.components.*',
            'theme.semantic.*',
            'if a required semantic token is missing, add it canonically before rerunning completion; do not hardcode a substitute',
          ],
        };
  },
  evaluate(context) {
    const requiredTokens = context.metadata.requirements.tokens ?? [];

    if (requiredTokens.length > 0) {
      const registryPath = canonicalTokenRegistryPath(context);
      const tokenPaths = canonicalTokenPaths(context);

      if (!tokenPaths) {
        return finding(
          tokenIntegrationRule,
          context,
          'fail',
          'Canonical Vellira token registry is missing or unreadable; do not invent local token substitutes.',
          [
            `missing-design-token-registry: component="${context.metadata.name}" platform="${context.platform}" registry="${path.relative(
              qualityRoot(context),
              registryPath
            )}"`,
          ]
        );
      }

      const missingTokens = requiredTokens.filter(
        (token) => !tokenPaths.has(token)
      );

      if (missingTokens.length > 0) {
        return finding(
          tokenIntegrationRule,
          context,
          'fail',
          'Declared Vellira design tokens are missing from the canonical token registry; add the canonical resource before regenerating.',
          missingTokens.map(
            (token) =>
              `missing-design-token: path="${token}" component="${context.metadata.name}" part="component" platform="${context.platform}" — expected canonical token path in @vellira-ui/tokens`
          )
        );
      }
    }

    const files = readFiles(context);
    const styleFiles = files.filter((file) =>
      context.platform === 'react'
        ? /\.(?:css|scss)$/.test(file.filePath)
        : /\.styles\.ts$/.test(file.filePath)
    );

    if (styleFiles.length === 0) {
      return finding(
        tokenIntegrationRule,
        context,
        'not-applicable',
        'No implementation styling surface exists for this platform.'
      );
    }

    const source = styleFiles.map((file) => file.source).join('\n');

    const hasTokenRelevantProperties =
      context.platform === 'react'
        ? hasWebTokenRelevantDesignProperties(source)
        : hasNativeTokenRelevantDesignProperties(source);

    if (!hasTokenRelevantProperties) {
      return finding(
        tokenIntegrationRule,
        context,
        'not-applicable',
        'The implementation styling surface has no token-owned design properties.'
      );
    }

    const hasEvidence =
      context.platform === 'react'
        ? hasWebTokenEvidence(source)
        : hasNativeTokenEvidence(source);

    return hasEvidence
      ? finding(
          tokenIntegrationRule,
          context,
          'pass',
          undefined,
          styleFiles
            .slice(0, 6)
            .map((file) => path.relative(qualityRoot(context), file.filePath))
        )
      : finding(
          tokenIntegrationRule,
          context,
          'fail',
          context.platform === 'react'
            ? 'Styled Web component has no CSS custom-property/@styles token integration evidence.'
            : 'Styled React Native component has no NativeTheme token/component/semantic integration evidence.',
          styleFiles.map((file) =>
            path.relative(qualityRoot(context), file.filePath)
          )
        );
  },
};

const geometryPattern =
  /(?:padding(?:-inline|-block)?|margin(?:-inline|-block)?|gap|border-radius|borderRadius|paddingHorizontal|paddingVertical)\s*:\s*(\d+(?:\.\d+)?(?:px|rem)?)/g;

export const hardcodedGeometryRule: ComponentQualityRule = {
  definition: {
    id: 'conformity.hardcoded-geometry',
    dimension: 'design-system',
    severity: 'recommended',
    evaluation: 'automated',
    description:
      'Warns about deterministic hardcoded spacing/radius geometry while supporting narrow explicit exceptions.',
  },
  evaluate(context) {
    const violations: string[] = [];

    for (const file of readFiles(context)) {
      const isStyleSurface =
        /\.(?:css|scss)$/.test(file.filePath) ||
        /\.styles\.ts$/.test(file.filePath);

      if (!isStyleSurface) continue;

      for (const match of file.source.matchAll(geometryPattern)) {
        const value = match[1];

        if (!value || value === '0' || value === '0px') continue;

        if (
          isExcepted({
            ruleId: hardcodedGeometryRule.definition.id,
            context,
            filePath: file.filePath,
            value,
          })
        ) {
          continue;
        }

        violations.push(
          sourceEvidence(
            qualityRoot(context),
            file.filePath,
            lineNumberAt(file.source, match.index ?? 0),
            match[0]
          )
        );
      }
    }

    return violations.length === 0
      ? finding(hardcodedGeometryRule, context, 'pass')
      : finding(
          hardcodedGeometryRule,
          context,
          'warn',
          'Hardcoded spacing/radius geometry found. Prefer Vellira tokens when the value represents a reusable design decision.',
          violations.slice(0, 8)
        );
  },
};

export const conformityQualityRules: readonly ComponentQualityRule[] = [
  tokenIntegrationRule,
  iconResourceRule,
  hardcodedColorRule,
  hardcodedGeometryRule,
];
