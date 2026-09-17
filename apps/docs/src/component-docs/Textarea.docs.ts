import { defineComponentDocs } from './defineComponentDocs';

export const textareaDocs = defineComponentDocs({
  component: 'Textarea',
  platforms: {
    react: {
      title: 'Textarea - React',
      description:
        'Textarea for React and React Native with controlled and uncontrolled state, disabled state, required state, and validation state.',
      summary:
        'Use Textarea in React form interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when an interface needs explicit user input, selection, or form participation.',
        'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
      ],
      notes: [
        'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
      ],
      storybook: {
        story: 'Default',
        title: 'Primitives/Textarea',
      },
    },
    'react-native': {
      title: 'Textarea - React Native',
      description:
        'Textarea for React and React Native with controlled and uncontrolled state, disabled state, required state, and validation state.',
      summary:
        'Use Textarea in React Native form interfaces when you need the canonical Vellira behavior and styling for this component.',
      whenToUse: [
        'Use it when an interface needs explicit user input, selection, or form participation.',
        'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
      ],
      notes: [
        'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
      ],
      storybook: {
        story: 'Default',
        title: 'Primitives/Textarea',
      },
    },
  },
});
