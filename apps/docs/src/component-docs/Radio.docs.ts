import { defineComponentDocs } from './defineComponentDocs';

/** Canonical standalone Radio documentation for both public platforms. */
export const radioDocs = defineComponentDocs({
  component: 'Radio',
  platforms: {
    react: {
      title: 'Radio – React Radio Control',
      description:
        'Build accessible React radio controls with checked state, labels, descriptions, validation feedback, and RadioGroup composition.',
      summary:
        'Radio represents one labeled option; RadioGroup coordinates mutually exclusive options and their shared selected value.',
      whenToUse: [
        'Use Radio inside RadioGroup when several mutually exclusive options belong to one choice.',
        'For standalone controlled selection, pass checked and onCheckedChange, or initialize an uncontrolled radio with defaultChecked.',
        'Choose Checkbox instead for independent selections that do not form a single-choice set.',
      ],
      accessibility: [
        'Radio renders a native radio input and clickable label; supply a meaningful visible label.',
        'Connect descriptions and errors to the control and preserve keyboard focus visibility.',
        'Use RadioGroup for related options so they share the group name, selection state, and keyboard interaction.',
        'Keep required, disabled, and invalid states consistent with the surrounding form.',
      ],
      seeAlso: [
        {
          component: 'RadioGroup',
          label: 'RadioGroup for mutually exclusive selection.',
        },
        {
          component: 'Checkbox',
          label: 'Checkbox for independent choices.',
        },
        {
          component: 'FormField',
          label: 'FormField for field descriptions and errors.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Radio',
      description:
        'Build accessible React Native radio controls with selected state, descriptive labels, validation feedback, and RadioGroup composition.',
      summary:
        'Native Radio presents an individual choice through a pressable control; RadioGroup owns selection across related options.',
      whenToUse: [
        'Use Radio inside RadioGroup when users choose exactly one of several visible options.',
        'Use checked and onCheckedChange for application-controlled standalone selection; defaultChecked initializes an uncontrolled radio.',
        'Choose Checkbox for independent choices rather than a shared exclusive selection.',
      ],
      accessibility: [
        'Radio exposes the radio accessibility role and checked and disabled accessibility state.',
        'Provide visible text or accessibilityLabel; a string label supplies the default accessible name.',
        'Use descriptions and validation errors to provide relevant accessibility hints.',
        'Test selected-state announcements and interactions with VoiceOver and TalkBack.',
      ],
      seeAlso: [
        {
          component: 'RadioGroup',
          label: 'RadioGroup for one selection among multiple options.',
        },
        {
          component: 'Checkbox',
          label: 'Checkbox for independent native choices.',
        },
        {
          component: 'FormField',
          label: 'FormField for field validation and guidance.',
        },
      ],
    },
  },
});
