import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { ExtractedProp } from '../model/types';
import { buildGeneratedPageModel } from '../model/build-page-model';
import { renderGeneratedCatalogPreview } from './catalog-preview-registry';
import { renderExamples } from './examples';
import {
  resolveCatalogPreviewProps,
  withRequiredMetadataDefaults,
} from './required-props';

const apiProps: ExtractedProp[] = [
  {
    name: 'label',
    kind: 'string',
    required: true,
    type: 'string',
    description: '',
  },
  {
    name: 'enabled',
    kind: 'boolean',
    required: true,
    type: 'boolean',
    description: '',
  },
  {
    name: 'count',
    kind: 'number',
    required: true,
    type: 'number',
    description: '',
  },
  {
    name: 'size',
    kind: 'select',
    options: ['sm', 'lg'],
    required: false,
    type: 'Size',
    description: '',
  },
];

function attributes(source: string, name: string) {
  const file = ts.createSourceFile(
    'preview.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const roots: Record<string, string>[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(file) === name
    ) {
      const props: Record<string, string> = {};
      for (const prop of node.attributes.properties) {
        if (!ts.isJsxAttribute(prop)) throw new Error('Unexpected spread');
        const key = prop.name.getText(file);
        if (Object.hasOwn(props, key)) throw new Error('Duplicate prop');
        props[key] = prop.initializer?.getText(file) ?? 'true';
      }
      roots.push(props);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return roots;
}

describe('required preview metadata defaults', () => {
  it('renders valid catalog and both example consumers from the same configured values', () => {
    const componentConfig = {
      defaults: {
        shared: {
          label: 'Configured label',
          enabled: false,
          count: 0,
          size: 'sm',
        },
        native: { label: 'Native label' },
      },
      catalogPreview: {},
    };
    const catalog = renderGeneratedCatalogPreview({
      generatedFileHeader: '',
      model: buildGeneratedPageModel({
        componentName: 'IdentityMarker',
        slug: 'identity-marker',
        platforms: ['react'],
        reactStaticDemoProps: '',
        nativeStaticDemoProps: '',
        reactDemoChildren: '',
        nativeDemoChildren: '',
        reactImports: [],
        nativeImports: [],
        nativeResponsivePresentation: false,
        playgroundProps: [],
        playgroundInitialValues: {},
        reactUsageChildren: '',
        nativeUsageChildren: '',
        generatedExamples: [],
        reactAccessibilityItems: [],
        nativeAccessibilityItems: [],
        reactApiSections: [],
        nativeApiSections: [],
        reactInheritedProps: [],
        nativeInheritedProps: [],
        relatedComponents: [],
        catalogPreview: resolveCatalogPreviewProps({
          componentConfig,
          reactApiProps: apiProps,
        }),
      }),
    });
    expect(attributes(catalog, 'IdentityMarker')).toEqual([
      { label: '{"Configured label"}', enabled: '{false}', count: '{0}' },
    ]);
    const examples = renderExamples({
      componentName: 'IdentityMarker',
      platforms: ['react', 'react-native'],
      componentConfig,
      generatedFileHeader: '',
      reactApiProps: apiProps,
      nativeApiProps: apiProps,
      getDemoProps: () => '',
      generatedExamples: [
        { title: 'Example', description: 'Sample', props: ["size='lg'"] },
      ],
    });
    expect(attributes(examples, 'ReactIdentityMarker')).toEqual([
      {
        label: '{"Configured label"}',
        enabled: '{false}',
        count: '{0}',
        size: "'lg'",
      },
    ]);
    expect(attributes(examples, 'NativeIdentityMarker')).toEqual([
      {
        label: '{"Native label"}',
        enabled: '{false}',
        count: '{0}',
        size: "'lg'",
      },
    ]);
  });

  it('preserves explicit values, children, optional defaults and metadata bytes', () => {
    const componentConfig = {
      defaults: {
        shared: { label: 'Default', size: 'sm', children: 'Default child' },
      },
    };
    const before = JSON.stringify(componentConfig);
    const fragments = ["label='Explicit'"];
    expect(
      withRequiredMetadataDefaults({
        componentConfig,
        platform: 'react',
        apiProps: [
          ...apiProps,
          {
            name: 'children',
            kind: 'string',
            type: 'string',
            required: true,
            description: '',
          },
        ],
        fragments,
        children: 'Explicit child',
      })
    ).toEqual(fragments);
    expect(JSON.stringify(componentConfig)).toBe(before);
  });

  it('does not invent missing values or callback/complex expressions', () => {
    expect(
      withRequiredMetadataDefaults({
        componentConfig: { defaults: { shared: { onChange: 'callback' } } },
        platform: 'react',
        apiProps: [
          ...apiProps,
          {
            name: 'onChange',
            kind: 'other',
            type: '() => void',
            required: true,
            description: '',
          },
        ],
        fragments: [],
      })
    ).toEqual([]);
  });

  it.each([
    ['enabled', 'false'],
    ['count', 'zero'],
    ['label', true],
  ])('rejects incompatible configured scalar defaults for %s', (key, value) => {
    expect(() =>
      withRequiredMetadataDefaults({
        componentConfig: { defaults: { shared: { [key]: value } } },
        platform: 'react',
        apiProps,
        fragments: [],
      })
    ).toThrow(/does not match its API/);
  });

  it('serializes text as a literal expression and respects explicitly supplied booleans', () => {
    const label = "A's <label> & {value}\r\nnext";
    const props = withRequiredMetadataDefaults({
      componentConfig: { defaults: { shared: { label, enabled: false } } },
      platform: 'react',
      apiProps,
      fragments: ['enabled'],
    });
    const source = ts.createSourceFile(
      'value.tsx',
      `<Marker ${props.join(' ')} />`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const root = (source.statements[0] as ts.ExpressionStatement)
      .expression as ts.JsxSelfClosingElement;
    const attr = root.attributes.properties[0] as ts.JsxAttribute;
    const expression = (attr.initializer as ts.JsxExpression)
      .expression as ts.StringLiteral;
    expect(expression.text).toBe(label);
    expect(attributes(source.getText(), 'Marker')[0].enabled).toBe('true');
  });
});
