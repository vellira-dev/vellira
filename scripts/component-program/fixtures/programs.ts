import type { ComponentProductionInputV1 } from '../../component-production/contracts';
import type { ComponentProgramDecisionsV1 } from '../../../packages/metadata/src/componentProgram';

const both = ['react', 'react-native'] as const;
const selection = (
  id: string,
  bindings: Record<string, string> = {},
  parameters?: Record<string, string | number>
) => ({
  id,
  platforms: both,
  bindings,
  ...(parameters ? { parameters } : {}),
});
const root = { id: 'Root', role: 'root', parent: null } as const;

export function mediaProgram(): ComponentProgramDecisionsV1 {
  return {
    schemaVersion: '1',
    anatomy: [
      root,
      { id: 'Picture', role: 'image', parent: 'Root' },
      { id: 'Alternative', role: 'fallback', parent: 'Root' },
    ],
    states: [
      {
        id: 'sourceStatus',
        domain: 'image-status',
        ownership: 'internal',
        api: 'none',
      },
    ],
    transitions: [
      {
        state: 'sourceStatus',
        event: 'source-change',
        action: 'reset',
        platforms: both,
      },
      {
        state: 'sourceStatus',
        event: 'load',
        action: 'resolve',
        platforms: both,
      },
      {
        state: 'sourceStatus',
        event: 'error',
        action: 'reject',
        platforms: both,
      },
    ],
    modules: [
      selection('image-source', { image: 'sourceStatus' }),
      selection('image-fallback', { image: 'sourceStatus' }),
      selection('accessible-name'),
      selection('size-variants'),
    ],
  };
}

export function mediaSpec(): ComponentProductionInputV1 {
  return {
    schemaVersion: '1',
    componentName: 'PortraitProbe',
    platform: 'both',
    layer: 'primitives',
    category: 'data-display',
    profile: 'base',
    capabilities: [],
    semanticCapabilities: [
      'image-source',
      'fallback',
      'size-variants',
      'accessible-name',
    ],
    parts: [],
    componentTokens: 'standard',
    componentProgram: mediaProgram(),
  };
}

export function formProgram(): ComponentProgramDecisionsV1 {
  return {
    schemaVersion: '1',
    anatomy: [root, { id: 'Editor', role: 'input', parent: 'Root' }],
    states: [
      {
        id: 'text',
        domain: 'text',
        ownership: 'controlled-uncontrolled',
        api: 'value',
      },
    ],
    transitions: [
      {
        state: 'text',
        event: 'value-change',
        action: 'request-change',
        platforms: both,
      },
    ],
    modules: [
      selection('state-control'),
      selection('field-state'),
      selection('multiline', { value: 'text' }),
      selection('accessible-name'),
    ],
  };
}

export function formSpec(): ComponentProductionInputV1 {
  return {
    schemaVersion: '1',
    componentName: 'EditorProbe',
    platform: 'both',
    layer: 'primitives',
    category: 'form',
    profile: 'form-control',
    control: 'text',
    capabilities: [
      'controlled',
      'uncontrolled',
      'disabled',
      'required',
      'invalid',
    ],
    semanticCapabilities: ['multiline', 'accessible-name'],
    parts: [],
    componentTokens: 'standard',
    componentProgram: formProgram(),
  };
}

export function temporalProgram(): ComponentProgramDecisionsV1 {
  return {
    schemaVersion: '1',
    anatomy: [
      root,
      { id: 'Body', role: 'content', parent: 'Root' },
      { id: 'Stack', role: 'viewport', parent: 'Root' },
      { id: 'Dismiss', role: 'close', parent: 'Root' },
    ],
    states: [
      {
        id: 'visible',
        domain: 'boolean',
        ownership: 'controlled-uncontrolled',
        api: 'open',
      },
      {
        id: 'deadline',
        domain: 'deadline',
        ownership: 'internal',
        api: 'none',
      },
      {
        id: 'pauses',
        domain: 'pause-reasons',
        ownership: 'internal',
        api: 'none',
      },
      { id: 'items', domain: 'collection', ownership: 'internal', api: 'none' },
    ],
    transitions: [
      { state: 'visible', event: 'timeout', action: 'close', platforms: both },
      { state: 'visible', event: 'press', action: 'close', platforms: both },
      { state: 'deadline', event: 'open', action: 'reset', platforms: both },
      { state: 'deadline', event: 'close', action: 'cleanup', platforms: both },
      {
        state: 'deadline',
        event: 'unmount',
        action: 'cleanup',
        platforms: both,
      },
      {
        state: 'pauses',
        event: 'pointer-enter',
        action: 'pause',
        platforms: ['react'],
      },
      {
        state: 'pauses',
        event: 'pointer-leave',
        action: 'resume',
        platforms: ['react'],
      },
      {
        state: 'pauses',
        event: 'focus',
        action: 'pause',
        platforms: ['react'],
      },
      {
        state: 'pauses',
        event: 'blur',
        action: 'resume',
        platforms: ['react'],
      },
    ],
    modules: [
      selection('state-control'),
      selection(
        'auto-dismiss',
        {
          open: 'visible',
          clock: 'deadline',
          pause: 'pauses',
        },
        { 'default-duration-ms': 5000 }
      ),
      selection(
        'stacking',
        { items: 'items' },
        { 'maximum-visible': 3, overflow: 'queue' }
      ),
      selection('announcement'),
      selection('reduced-motion'),
    ],
  };
}

export function temporalSpec(): ComponentProductionInputV1 {
  return {
    schemaVersion: '1',
    componentName: 'TransientProbe',
    platform: 'both',
    layer: 'components',
    category: 'feedback',
    profile: 'overlay',
    capabilities: ['controlled', 'uncontrolled'],
    semanticCapabilities: [
      'auto-dismiss',
      'dismissible',
      'stacking',
      'announcement',
      'reduced-motion',
    ],
    parts: [],
    componentTokens: 'standard',
    componentProgram: temporalProgram(),
  };
}

export function overlaySpec(): ComponentProductionInputV1 {
  return {
    schemaVersion: '1',
    componentName: 'SurfaceProbe',
    platform: 'both',
    layer: 'components',
    category: 'overlay',
    profile: 'overlay',
    capabilities: [
      'controlled',
      'uncontrolled',
      'compound-api',
      'portal',
      'keyboard',
      'focus-management',
    ],
    semanticCapabilities: ['dismissible'],
    parts: ['Root', 'Trigger', 'Content'],
    componentTokens: 'standard',
    componentProgram: {
      schemaVersion: '1',
      anatomy: [
        root,
        { id: 'Trigger', role: 'trigger', parent: 'Root' },
        { id: 'Content', role: 'content', parent: 'Root' },
      ],
      states: [
        {
          id: 'visible',
          domain: 'boolean',
          ownership: 'controlled-uncontrolled',
          api: 'open',
        },
      ],
      transitions: [
        { state: 'visible', event: 'press', action: 'open', platforms: both },
        {
          state: 'visible',
          event: 'escape',
          action: 'close',
          platforms: ['react'],
        },
        {
          state: 'visible',
          event: 'back',
          action: 'close',
          platforms: ['react-native'],
        },
      ],
      modules: [
        selection('state-control'),
        selection('compound'),
        selection('presentation'),
        selection('focus-management'),
        selection('keyboard-navigation'),
        selection('dismissible', { open: 'visible' }),
      ],
    },
  };
}

export function collectionSpec(): ComponentProductionInputV1 {
  return {
    schemaVersion: '1',
    componentName: 'CollectionProbe',
    platform: 'both',
    layer: 'components',
    category: 'navigation',
    profile: 'compound',
    capabilities: [
      'controlled',
      'uncontrolled',
      'compound-api',
      'keyboard',
      'focus-management',
    ],
    parts: ['Root', 'Item'],
    componentTokens: 'standard',
    componentProgram: {
      schemaVersion: '1',
      anatomy: [root, { id: 'Item', role: 'item', parent: 'Root' }],
      states: [
        {
          id: 'selected',
          domain: 'selection',
          ownership: 'controlled-uncontrolled',
          api: 'value',
        },
        {
          id: 'active',
          domain: 'selection',
          ownership: 'internal',
          api: 'none',
        },
      ],
      transitions: [
        {
          state: 'selected',
          event: 'value-change',
          action: 'request-change',
          platforms: both,
        },
        {
          state: 'active',
          event: 'keyboard',
          action: 'update',
          platforms: both,
        },
      ],
      modules: [
        selection('state-control'),
        selection('compound'),
        selection('selection', { value: 'selected' }),
        selection('keyboard-navigation'),
        selection('focus-management'),
      ],
    },
  };
}
