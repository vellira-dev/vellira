import { defineComponentDocs } from './defineComponentDocs';

export const avatarDocs = defineComponentDocs({
  component: 'Avatar',
  platforms: {
    react: {
      title: 'Avatar - React',
      description:
        'Avatar for React with canonical Vellira behavior and styling.',
      summary:
        'Use Avatar in React data display interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when structured application data needs a reusable visual presentation.',
      ],
      notes: [
        'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
      ],
      storybook: {
        story: 'Default',
        title: 'Primitives/Avatar',
      },
    },
    'react-native': {
      title: 'Avatar - React Native',
      description:
        'Avatar for React Native with canonical Vellira behavior and styling.',
      summary:
        'Use Avatar in React Native data display interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when structured application data needs a reusable visual presentation.',
      ],
      notes: [
        'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
      ],
      storybook: {
        story: 'Default',
        title: 'Primitives/Avatar',
      },
    },
  },
});
