import type { ComponentExpansionTarget } from './expansion';

export const componentExpansionCatalog = [
  {
    name: 'Textarea',
    layer: 'primitives',
    category: 'form',
    platforms: ['react', 'react-native'],
    profile: 'form-control',
    componentTokens: 'standard',
    role: 'form-control',
  },
  {
    name: 'Accordion',
    layer: 'components',
    category: 'layout',
    platforms: ['react', 'react-native'],
    profile: 'compound',
    componentTokens: 'disclosure',
    role: 'catalog',
  },
  {
    name: 'Avatar',
    layer: 'primitives',
    category: 'data-display',
    platforms: ['react', 'react-native'],
    profile: 'base',
    componentTokens: 'standard',
    role: 'foundational',
  },
  {
    name: 'Badge',
    layer: 'primitives',
    category: 'data-display',
    platforms: ['react', 'react-native'],
    profile: 'base',
    componentTokens: 'standard',
    role: 'foundational',
  },
] as const satisfies readonly ComponentExpansionTarget[];
