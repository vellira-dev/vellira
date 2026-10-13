import fs from 'node:fs';
import path from 'node:path';

import { transform } from '@svgr/core';
import fg from 'fast-glob';
import { format } from 'prettier';

const ROOT = process.cwd();

const SVG_ASSETS = path.join(ROOT, 'svg');
const LOTTIE_ASSETS = path.join(ROOT, 'lottie');
const ICONS = path.join(ROOT, 'src/generated');
const PRETTIER_OPTIONS = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  jsxSingleQuote: true,
  printWidth: 80,
  useTabs: false,
  tabWidth: 2,
  endOfLine: 'lf',
  parser: 'typescript',
} as const;

function writeFileIfChanged(filePath: string, content: string): void {
  const current = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : '';

  if (current !== content) {
    fs.writeFileSync(filePath, content);
  }
}

function toGeneratedConst(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toName(file: string): string {
  return path.basename(file, '.svg');
}

function assertIconName(file: string, name: string): void {
  if (/^[A-Z][A-Za-z0-9]*$/.test(name)) return;

  throw new Error(
    `Invalid icon file name "${file}". Use PascalCase ASCII names, for example "Close.svg".`
  );
}

function withIconProps(code: string, native: boolean): string {
  const nextCode = native
    ? code
        .replace(/\s+xmlns=['"]http:\/\/www\.w3\.org\/2000\/svg['"]/g, '')
        .replace(/\s+xmlnsXlink=['"][^'"]+['"]/g, '')
        .replace(
          'import type { SvgProps } from "react-native-svg";',
          `import type { SvgProps } from "react-native-svg";

type IconProps = SvgProps & {
  size?: number | string;
  color?: string;
};`
        )
        .replace(
          /const (\w+) = \(props: SvgProps\) =>/,
          `const $1 = ({ size = 16, color = 'currentColor', ...props }: IconProps) =>`
        )
    : code
        // HTML elements inside SVG foreignObject inherit the XHTML namespace.
        // React div props do not accept the SVG source xmlns attribute.
        .replace(/\s+xmlns=['"]http:\/\/www\.w3\.org\/1999\/xhtml['"]/g, '')
        .replace(
          'import type { SVGProps } from "react";',
          `import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  color?: string;
};`
        )
        .replace(
          /const (\w+) = \(props: SVGProps<SVGSVGElement>\) =>/,
          `const $1 = ({ size = 16, color = 'currentColor', ...props }: IconProps) =>`
        );

  return nextCode
    .replace(/props\.size \?\? 16/g, 'size')
    .replace(/props\.color \?\? ['"]currentColor['"]/g, 'color');
}

async function compile(
  svg: string,
  componentName: string,
  native: boolean
): Promise<string> {
  const code = await transform(
    svg,
    {
      native,
      plugins: ['@svgr/plugin-jsx'],
      typescript: true,
      jsxRuntime: 'automatic',
      exportType: 'default',
      expandProps: 'end',
      svgProps: {
        width: '{props.size ?? 16}',
        height: '{props.size ?? 16}',
        fill: '{props.color ?? "currentColor"}',
      },
      replaceAttrValues: {
        '#000': '{props.color ?? "currentColor"}',
        '#000000': '{props.color ?? "currentColor"}',
        black: '{props.color ?? "currentColor"}',
        currentColor: '{props.color ?? "currentColor"}',
      },
    },
    {
      componentName,
    }
  );

  return withIconProps(code, native);
}

async function run(): Promise<void> {
  fs.mkdirSync(ICONS, {
    recursive: true,
  });

  const files = (
    await fg('**/*.svg', {
      cwd: SVG_ASSETS,
    })
  ).sort((first, second) => toName(first).localeCompare(toName(second)));

  if (files.length === 0) {
    console.warn('⚠️ No SVG icons found');
    return;
  }

  const webExports: string[] = [];
  const nativeExports: string[] = [];
  const webSourceExports: string[] = [];
  const nativeSourceExports: string[] = [];
  const generatedFiles = new Set<string>();

  for (const file of files) {
    const svg = fs.readFileSync(path.join(SVG_ASSETS, file), 'utf8');

    const name = toName(file);

    assertIconName(file, name);

    const webComponent = await format(
      await compile(svg, name, false),
      PRETTIER_OPTIONS
    );
    const nativeComponent = await format(
      await compile(svg, name, true),
      PRETTIER_OPTIONS
    );

    writeFileIfChanged(path.join(ICONS, `${name}.web.tsx`), webComponent);
    writeFileIfChanged(path.join(ICONS, `${name}.native.tsx`), nativeComponent);
    generatedFiles.add(`${name}.web.tsx`);
    generatedFiles.add(`${name}.native.tsx`);

    webExports.push(
      `export { default as ${name} } from './generated/${name}.web.js';`
    );

    nativeExports.push(
      `export { default as ${name} } from './generated/${name}.native.js';`
    );

    webSourceExports.push(
      `export { default as ${name} } from './generated/${name}.web';`
    );

    nativeSourceExports.push(
      `export { default as ${name} } from './generated/${name}.native';`
    );
  }

  for (const file of fs.readdirSync(ICONS)) {
    if (/\.tsx$/.test(file) && !generatedFiles.has(file)) {
      fs.rmSync(path.join(ICONS, file));
    }
  }

  writeFileIfChanged(
    path.join(ROOT, 'src/web.ts'),
    await format(`${webExports.join('\n')}\n`, PRETTIER_OPTIONS)
  );

  writeFileIfChanged(
    path.join(ROOT, 'src/native.ts'),
    await format(`${nativeExports.join('\n')}\n`, PRETTIER_OPTIONS)
  );

  writeFileIfChanged(
    path.join(ROOT, 'src/web.source.ts'),
    await format(`${webSourceExports.join('\n')}\n`, PRETTIER_OPTIONS)
  );

  writeFileIfChanged(
    path.join(ROOT, 'src/native.source.ts'),
    await format(`${nativeSourceExports.join('\n')}\n`, PRETTIER_OPTIONS)
  );

  const lottieManifestPath = path.join(LOTTIE_ASSETS, 'manifest.json');

  if (fs.existsSync(lottieManifestPath)) {
    const lottieManifest = JSON.parse(
      fs.readFileSync(lottieManifestPath, 'utf8')
    ) as {
      icons?: Array<{ name: string; file: string }>;
    };

    const animatedIcons: Record<string, unknown> = {};

    for (const icon of lottieManifest.icons ?? []) {
      assertIconName(icon.file, icon.name);

      animatedIcons[icon.name] = JSON.parse(
        fs.readFileSync(path.join(LOTTIE_ASSETS, icon.file), 'utf8')
      );
    }

    const lottieSource = `
export const animatedIconManifest = ${toGeneratedConst(lottieManifest)} as const;

export const animatedIcons = ${toGeneratedConst(animatedIcons)} as const;

export type AnimatedIconName = keyof typeof animatedIcons;
export type AnimatedIconData = (typeof animatedIcons)[AnimatedIconName];
export type AnimatedIconManifest = typeof animatedIconManifest;
`;

    writeFileIfChanged(
      path.join(ROOT, 'src/lottie.ts'),
      await format(lottieSource, PRETTIER_OPTIONS)
    );
  }

  console.log(`✅ Generated ${files.length} icons`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
