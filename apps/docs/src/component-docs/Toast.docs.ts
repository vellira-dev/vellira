import { defineComponentDocs } from './defineComponentDocs';

export const toastDocs = defineComponentDocs({
  component: 'Toast',
  platforms: {
    react: {
      title: 'Toast - React',
      description:
        'Toast for React and React Native with controlled and uncontrolled state, keyboard interaction, focus management, compound composition, and portal rendering.',
      summary:
        'Use Toast in React feedback interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when the interface needs to communicate status, progress, or feedback.',
        'Keep open state, focus, dismissal, and rendering behavior inside the documented overlay contract.',
      ],
      notes: [
        'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
      ],
      storybook: {
        story: 'Default',
        title: 'Components/Toast',
      },
    },
    'react-native': {
      title: 'Toast - React Native',
      description:
        'Toast for React and React Native with controlled and uncontrolled state, keyboard interaction, focus management, compound composition, and portal rendering.',
      summary:
        'Use Toast in React Native feedback interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when the interface needs to communicate status, progress, or feedback.',
        'Keep open state, focus, dismissal, and rendering behavior inside the documented overlay contract.',
      ],
      notes: [
        'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
      ],
      storybook: {
        story: 'Default',
        title: 'Components/Toast',
      },
    },
  },
});
