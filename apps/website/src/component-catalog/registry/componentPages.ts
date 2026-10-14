import type { ComponentType } from 'react';

import type { ComponentDiscoveryMetadata } from '../metadata';
import type {
  ComponentApiProp,
  ComponentApiSection,
} from '../shared/ComponentApi';
import type { ComponentPlatform } from '../types';

// component-page-imports
import {
  TextareaAccessibility,
  TextareaDemo,
  TextareaExamples,
  TextareaUsage,
  NativeTextareaDemo,
  textareaApi,
} from '../components/Textarea';
import {
  AccordionAccessibility,
  AccordionDemo,
  AccordionExamples,
  AccordionUsage,
  NativeAccordionDemo,
  accordionApi,
} from '../components/Accordion';
import {
  SwitchAccessibility,
  SwitchDemo,
  SwitchExamples,
  SwitchUsage,
  NativeSwitchDemo,
  switchApi,
} from '../components/Switch';
import {
  RadioGroupAccessibility,
  RadioGroupDemo,
  RadioGroupExamples,
  RadioGroupUsage,
  NativeRadioGroupDemo,
  radioGroupApi,
} from '../components/RadioGroup';
import {
  FormFieldAccessibility,
  FormFieldDemo,
  FormFieldExamples,
  FormFieldUsage,
  NativeFormFieldDemo,
  formFieldApi,
} from '../components/FormField';
import {
  PopoverAccessibility,
  PopoverDemo,
  PopoverExamples,
  PopoverUsage,
  NativePopoverDemo,
  popoverApi,
} from '../components/Popover';
import {
  TooltipAccessibility,
  TooltipDemo,
  TooltipExamples,
  TooltipUsage,
  NativeTooltipDemo,
  tooltipApi,
} from '../components/Tooltip';
import {
  ModalAccessibility,
  ModalDemo,
  ModalExamples,
  ModalUsage,
  NativeModalDemo,
  modalApi,
} from '../components/Modal';
import {
  TabsAccessibility,
  TabsDemo,
  TabsExamples,
  TabsUsage,
  NativeTabsDemo,
  tabsApi,
} from '../components/Tabs';
import {
  DropdownAccessibility,
  DropdownDemo,
  DropdownExamples,
  DropdownUsage,
  NativeDropdownDemo,
  dropdownApi,
} from '../components/Dropdown';
import {
  SelectAccessibility,
  SelectDemo,
  SelectExamples,
  SelectUsage,
  NativeSelectDemo,
  selectApi,
} from '../components/Select';
import {
  CheckboxAccessibility,
  CheckboxDemo,
  CheckboxExamples,
  CheckboxUsage,
  NativeCheckboxDemo,
  checkboxApi,
} from '../components/Checkbox';
import {
  RadioAccessibility,
  RadioDemo,
  RadioExamples,
  RadioUsage,
  NativeRadioDemo,
  radioApi,
} from '../components/Radio';
import {
  InputAccessibility,
  InputDemo,
  InputExamples,
  InputUsage,
  NativeInputDemo,
  inputApi,
} from '../components/Input';
import {
  ButtonAccessibility,
  ButtonDemo,
  ButtonExamples,
  ButtonUsage,
  NativeButtonDemo,
  buttonApi,
} from '../components/Button';

type PlatformSectionProps = {
  platform: ComponentPlatform;
};

type PlatformSection = ComponentType<PlatformSectionProps>;

type PlatformDemoRegistry = Partial<Record<ComponentPlatform, ComponentType>>;

type ComponentPageConfig = {
  name: string;
  discovery?: ComponentDiscoveryMetadata;
  demos: PlatformDemoRegistry;
  Usage: PlatformSection;
  Examples: PlatformSection;
  Accessibility: PlatformSection;
  api: Readonly<
    Record<
      ComponentPlatform,
      | readonly ComponentApiProp[]
      | {
          sections?: readonly ComponentApiSection[];
          props?: readonly ComponentApiProp[];
          inheritedProps?: readonly ComponentApiProp[];
        }
    >
  > & {
    inherited?: Partial<Record<ComponentPlatform, readonly ComponentApiProp[]>>;
  };
  related: readonly string[];
};

export const componentPages = {
  // component-page-entries
  textarea: {
    name: 'Textarea',
    discovery: {
      status: 'complete',
      summary:
        'Use Textarea as the canonical Vellira form component across React and React Native.',
      description:
        'Textarea for React and React Native with controlled and uncontrolled state, disabled state, required state, and validation state.',
      whenToUse: [
        'Use it when an interface needs explicit user input, selection, or form participation.',
        'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
      ],
      patterns: [
        { id: 'basic', title: 'Basic', description: 'Basic component usage.' },
        {
          id: 'controlled',
          title: 'Controlled',
          description: 'State controlled by the parent application.',
        },
        {
          id: 'uncontrolled',
          title: 'Uncontrolled',
          description: 'State initialized and then managed by the component.',
        },
        {
          id: 'disabled',
          title: 'Disabled',
          description: 'Disabled state with interaction unavailable.',
        },
        {
          id: 'required',
          title: 'Required',
          description: 'Required state for form participation.',
        },
        {
          id: 'invalid',
          title: 'Invalid',
          description: 'Invalid state with validation semantics.',
        },
      ],
      platformNotes: {
        react: [
          'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
        ],
        'react-native': [
          'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: TextareaDemo,
      'react-native': NativeTextareaDemo,
    },
    Usage: TextareaUsage,
    Examples: TextareaExamples,
    Accessibility: TextareaAccessibility,
    api: textareaApi,
    related: ['input', 'form-field', 'select'],
  },
  accordion: {
    name: 'Accordion',
    discovery: {
      status: 'complete',
      summary:
        'Use Accordion for in-place progressive disclosure in settings, FAQs, and detail screens.',
      description:
        'Accessible compound Accordion for React and React Native with single or multiple expansion, controlled and default values, collapsible behavior, disabled items, and platform-specific trigger semantics.',
      whenToUse: [
        'Reveal secondary details without leaving the current page or screen.',
        'Use single mode for one open item or multiple mode to compare sections.',
        'Use collapsible when the currently open single item may close.',
        'Choose Tabs instead for peer views that replace content rather than reveal it.',
      ],
      patterns: [
        {
          id: 'single-expansion',
          title: 'One section at a time',
          description:
            'Use single mode and defaultValue for a focused disclosure with a default open item.',
        },
        {
          id: 'multiple-expansion',
          title: 'Compare open sections',
          description:
            'Use multiple mode for settings or details that users need visible together.',
        },
        {
          id: 'controlled-state',
          title: 'Controlled expansion',
          description:
            'Use value with onValueChange when application state owns which items are expanded.',
        },
        {
          id: 'collapsible-single',
          title: 'Dismiss the open section',
          description:
            'Enable collapsible on a single accordion when every section may be closed.',
        },
      ],
      platformNotes: {
        react: [
          'Accordion.Trigger uses a native button with aria-expanded and aria-controls; Tab, Enter, and Space follow browser button semantics.',
          'Force-mount Accordion.Content only when persistent web panel state is required.',
        ],
        'react-native': [
          'Accordion.Trigger exposes native button semantics and expanded state through accessibility props, not DOM aria-controls.',
          'Wrap textual Accordion.Content children in React Native Text and verify assistive announcements on target devices.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: AccordionDemo,
      'react-native': NativeAccordionDemo,
    },
    Usage: AccordionUsage,
    Examples: AccordionExamples,
    Accessibility: AccordionAccessibility,
    api: accordionApi,
    related: ['tabs', 'dropdown', 'popover'],
  },
  switch: {
    name: 'Switch',
    discovery: {
      status: 'complete',
      summary:
        'Use Switch for immediate on/off settings such as notifications, synchronization, and saved preferences.',
      description:
        'Accessible React and React Native Switch for immediate boolean settings with controlled or default checked state, disabled, required, and invalid semantics.',
      whenToUse: [
        'Choose Switch for an on/off setting that takes effect immediately.',
        'Choose Checkbox instead for independent selections or acceptance fields in a form.',
        'Use checked with onCheckedChange when application state owns the preference; use defaultChecked for its initial local state.',
        'Provide a meaningful accessible name describing the setting being changed.',
      ],
      patterns: [
        {
          id: 'controlled-setting',
          title: 'Controlled preference',
          description:
            'Use checked and onCheckedChange when application state drives the on/off preference.',
        },
        {
          id: 'uncontrolled-setting',
          title: 'Initially enabled',
          description:
            'Use defaultChecked to initialize an on/off setting that Switch manages after mounting.',
        },
        {
          id: 'disabled-setting',
          title: 'Unavailable setting',
          description:
            'Use disabled when a setting cannot currently be changed, while keeping its label visible.',
        },
        {
          id: 'required-and-invalid',
          title: 'State and validation cues',
          description:
            'Use required and invalid to communicate state; implement any form submission or recovery separately.',
        },
      ],
      platformNotes: {
        react: [
          'React renders a button with role=switch and aria-checked; required and invalid map to aria-required and aria-invalid.',
          'Disabled is the native button disabled attribute. Switch does not submit a native form value by itself.',
        ],
        'react-native': [
          'React Native uses Pressable with accessibilityRole=switch and checked/disabled in accessibilityState.',
          'Required and invalid are conveyed through accessibilityHint rather than browser ARIA attributes; verify announcements on real devices.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: SwitchDemo,
      'react-native': NativeSwitchDemo,
    },
    Usage: SwitchUsage,
    Examples: SwitchExamples,
    Accessibility: SwitchAccessibility,
    api: switchApi,
    related: ['checkbox', 'radio', 'form-field'],
  },
  'radio-group': {
    name: 'RadioGroup',
    discovery: {
      status: 'complete',
      summary: 'Use RadioGroup for a labelled, mutually exclusive set of options.',
      description: 'React and React Native RadioGroup for controlled or default single selection, labelled items, horizontal or vertical layout, and group validation feedback.',
      whenToUse: [
        'Use RadioGroup when a person chooses exactly one item from a related set.',
        'Give each RadioGroup.Item a unique value and label the group.',
        'Use value and onValueChange for controlled selection or defaultValue for initial selection.',
        'Use required and error for group validation; use Checkbox for independent choices.',
      ],
      patterns: [
        { id: 'controlled', title: 'Controlled choice', description: 'Use value and onValueChange to manage the selected option externally.' },
        { id: 'default', title: 'Default selection', description: 'Use defaultValue to initialize selection while the group manages later updates.' },
        { id: 'layout', title: 'Orientation', description: 'Prefer vertical options; use horizontal layout when space and labels permit.' },
        { id: 'validation', title: 'Required group', description: 'Display a meaningful error and propagate disabled and invalid state to child radios.' },
      ],
      platformNotes: {
        react: [
          'React renders role=radiogroup with ARIA label, description, required and invalid semantics, and named native radio inputs.',
          'React group navigation handles keyboard behavior and orientation controls layout.',
        ],
        'react-native': [
          'React Native composes FormField with accessibilityRole=radiogroup and hints for required or invalid state.',
          'Child Pressable radios expose checked/disabled accessibilityState; orientation changes their layout.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: RadioGroupDemo,
      'react-native': NativeRadioGroupDemo,
    },
    Usage: RadioGroupUsage,
    Examples: RadioGroupExamples,
    Accessibility: RadioGroupAccessibility,
    api: radioGroupApi,
    related: ['radio', 'checkbox', 'select'],
  },
  'form-field': {
    name: 'FormField',
    discovery: {
      status: 'complete',
      summary:
        'Use FormField to compose a custom control with a label, helper text, validation, and consistent field layout.',
      description:
        'Composable React and React Native FormField with Label, Description, Control and Message slots, field state, accessible feedback, and layout options.',
      whenToUse: [
        'Wrap a custom field when its label, description, control, and validation feedback should share one layout.',
        'Prefer the existing Input shorthand when it already renders all necessary field chrome.',
        'Use compound slots when label, description, control, and supporting message need explicit composition.',
        'Show an error when the user must recover from invalid input; reserve messages for other status or guidance.',
      ],
      patterns: [
        {
          id: 'compound-field',
          title: 'Compound field anatomy',
          description:
            'Compose FormField.Label, Description, Control, and Message to structure a custom input.',
        },
        {
          id: 'error-feedback',
          title: 'Validation and recovery',
          description:
            'Provide error or invalid state to surface validation feedback; error takes precedence over status message.',
        },
        {
          id: 'status-message',
          title: 'Status and success text',
          description:
            'Use message, messageTone, and messageLive for non-error supporting feedback.',
        },
        {
          id: 'field-state',
          title: 'Field state for compatible controls',
          description:
            'Use required, disabled, invalid, and size with compatible child controls consuming FormField context.',
        },
      ],
      platformNotes: {
        react: [
          'React FormField renders a semantic label with generated IDs and by default binds required, disabled, and ARIA relationships to a compatible direct child; bindControl can opt out.',
          'React error feedback uses role=alert; messageLive=polite enables an ARIA live region for non-error status.',
        ],
        'react-native': [
          'React Native FormField renders View/Text layout and provides field context; custom controls remain responsible for their own accessibility label, role, and disabled interaction.',
          'Native error and polite status feedback use accessibilityLiveRegion=polite; compatible Vellira controls may inherit state and size from context.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: FormFieldDemo,
      'react-native': NativeFormFieldDemo,
    },
    Usage: FormFieldUsage,
    Examples: FormFieldExamples,
    Accessibility: FormFieldAccessibility,
    api: formFieldApi,
    related: ['input', 'select', 'checkbox'],
  },
  popover: {
    name: 'Popover',
    demos: {
      react: PopoverDemo,
      'react-native': NativePopoverDemo,
    },
    Usage: PopoverUsage,
    Examples: PopoverExamples,
    Accessibility: PopoverAccessibility,
    api: popoverApi,
    related: ['button', 'tooltip', 'modal'],
  },
  modal: {
    name: 'Modal',
    demos: {
      react: ModalDemo,
      'react-native': NativeModalDemo,
    },
    Usage: ModalUsage,
    Examples: ModalExamples,
    Accessibility: ModalAccessibility,
    api: modalApi,
    related: ['button', 'popover', 'tooltip'],
  },
  tooltip: {
    name: 'Tooltip',
    demos: {
      react: TooltipDemo,
      'react-native': NativeTooltipDemo,
    },
    Usage: TooltipUsage,
    Examples: TooltipExamples,
    Accessibility: TooltipAccessibility,
    api: tooltipApi,
    related: ['button', 'popover'],
  },
  tabs: {
    name: 'Tabs',
    demos: {
      react: TabsDemo,
      'react-native': NativeTabsDemo,
    },
    Usage: TabsUsage,
    Examples: TabsExamples,
    Accessibility: TabsAccessibility,
    api: tabsApi,
    related: ['radio-group', 'button'],
  },
  dropdown: {
    name: 'Dropdown',
    demos: {
      react: DropdownDemo,
      'react-native': NativeDropdownDemo,
    },
    Usage: DropdownUsage,
    Examples: DropdownExamples,
    Accessibility: DropdownAccessibility,
    api: dropdownApi,
    related: ['button', 'select', 'popover'],
  },
  select: {
    name: 'Select',
    demos: {
      react: SelectDemo,
      'react-native': NativeSelectDemo,
    },
    Usage: SelectUsage,
    Examples: SelectExamples,
    Accessibility: SelectAccessibility,
    api: selectApi,
    related: ['input', 'dropdown', 'radio-group'],
  },
  radio: {
    name: 'Radio',
    discovery: {
      status: 'complete',
      summary: 'Use Radio for one choice; use RadioGroup for mutually exclusive choices.',
      description: 'React and React Native Radio for a labelled single choice, with controlled or default selection, disabled and required states, sizes, colors, and validation feedback.',
      whenToUse: [
        'Use RadioGroup for a related set of mutually exclusive options.',
        'Use standalone Radio only when an application owns its selection behavior.',
        'Choose Checkbox for independent selections.',
        'Provide a visible label or an accessible name and explain errors.',
      ],
      patterns: [
        { id: 'group-item', title: 'Group selection', description: 'A Radio inside RadioGroup receives selected value and shared properties from group context.' },
        { id: 'standalone', title: 'Standalone state', description: 'Outside a group, checked and onCheckedChange control state; defaultChecked initializes local selection.' },
        { id: 'feedback', title: 'Validation feedback', description: 'Use error for option-specific validation and RadioGroup error for group-wide failures.' },
      ],
      platformNotes: {
        react: [
          'React renders a native input type=radio with label, description, aria-invalid and native required/disabled states.',
          'Inside RadioGroup, checked derives from group value; standalone checked and defaultChecked do not own group selection.',
        ],
        'react-native': [
          'React Native uses Pressable with accessibilityRole=radio and checked/disabled accessibilityState; string labels provide default accessibility names.',
          'Description, required state, and error can contribute to the accessibility hint; the group owns selected value when present.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: RadioDemo,
      'react-native': NativeRadioDemo,
    },
    Usage: RadioUsage,
    Examples: RadioExamples,
    Accessibility: RadioAccessibility,
    api: radioApi,
    related: ['radio-group', 'checkbox', 'select'],
  },
  checkbox: {
    name: 'Checkbox',
    discovery: {
      status: 'complete',
      summary:
        'Use Checkbox as the canonical Vellira form component across React and React Native.',
      description:
        'Checkbox for React and React Native with controlled and uncontrolled state, indeterminate state, disabled state, required state, and validation state.',
      whenToUse: [
        'Use it when an interface needs explicit user input, selection, or form participation.',
        'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
        'Use Checkbox for independent boolean choices; use RadioGroup when exactly one option must be selected.',
        'Use Checkbox for form-like independent selections; use Switch for persistent settings that apply immediately.',
      ],
      patterns: [
        { id: 'basic', title: 'Basic', description: 'Basic component usage.' },
        {
          id: 'controlled',
          title: 'Controlled',
          description: 'State controlled by the parent application.',
        },
        {
          id: 'uncontrolled',
          title: 'Uncontrolled',
          description: 'State initialized and then managed by the component.',
        },
        {
          id: 'indeterminate',
          title: 'Indeterminate',
          description: 'Mixed selection state for partial group selection.',
        },
        {
          id: 'disabled',
          title: 'Disabled',
          description: 'Disabled state with interaction unavailable.',
        },
        {
          id: 'required',
          title: 'Required',
          description: 'Required state for form participation.',
        },
        {
          id: 'invalid',
          title: 'Invalid',
          description: 'Invalid state with validation semantics.',
        },
      ],
      platformNotes: {
        react: [
          'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
        ],
        'react-native': [
          'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: CheckboxDemo,
      'react-native': NativeCheckboxDemo,
    },
    Usage: CheckboxUsage,
    Examples: CheckboxExamples,
    Accessibility: CheckboxAccessibility,
    api: checkboxApi,
    related: ['radio-group', 'switch', 'form-field'],
  },
  button: {
    name: 'Button',
    discovery: {
      status: 'complete',
      summary:
        'Use Button for explicit actions such as saving, submitting a form, or opening a menu.',
      description:
        'Accessible React and React Native actions with Vellira Button: appearances, semantic colors, sizes, loading states, icons, links, and composition.',
      whenToUse: [
        'Choose Button for an action; use a semantic link for navigation.',
        'Use appearance and color to communicate action hierarchy and intent.',
        'For asynchronous actions, use loading and loadingText to signal progress.',
        'Give icon-only controls accessible names; the icon itself is not a label.',
      ],
      patterns: [
        {
          id: 'async-action',
          title: 'Save or submit',
          description:
            'Use loading and loadingText while an action is pending.',
        },
        {
          id: 'action-hierarchy',
          title: 'Primary and secondary actions',
          description:
            'Pair solid primary actions with quieter outline or ghost actions.',
        },
        {
          id: 'icon-only',
          title: 'Accessible icon-only buttons',
          description:
            'Keep a concise accessible label when visible text is absent.',
        },
        {
          id: 'navigation',
          title: 'Link-like buttons',
          description:
            'On React, use href or asChild to preserve link semantics.',
        },
      ],
      platformNotes: {
        react: [
          'React Button supports onClick for actions and href or asChild for link semantics.',
          'For an icon-only web action, use aria-label or aria-labelledby.',
        ],
        'react-native': [
          'React Native Button handles native actions through onPress, not DOM onClick.',
          'Use accessibilityLabel for icon-only native actions; web ARIA rules do not transfer.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: ButtonDemo,
      'react-native': NativeButtonDemo,
    },
    Usage: ButtonUsage,
    Examples: ButtonExamples,
    Accessibility: ButtonAccessibility,
    api: buttonApi,
    related: ['input', 'checkbox', 'modal'],
  },
  input: {
    name: 'Input',
    discovery: {
      status: 'complete',
      summary:
        'Use Input for short free-form text in forms and search, with explicit labels and validation feedback.',
      description:
        'Accessible React and React Native text inputs with labels, controlled values, validation feedback, clearable search, and password reveal.',
      whenToUse: [
        'Use Input for short text such as email, search terms, and account names.',
        'Use Select or RadioGroup for fixed choices; use Textarea for longer messages.',
        'Choose value with onValueChange for controlled fields or defaultValue for initial state.',
        'Provide visible labels and actionable error text instead of placeholder-only instructions.',
      ],
      patterns: [
        {
          id: 'controlled',
          title: 'Controlled values',
          description:
            'Use value and onValueChange when application state owns the text.',
        },
        {
          id: 'uncontrolled',
          title: 'Default values',
          description:
            'Use defaultValue when the component can manage its initial text.',
        },
        {
          id: 'validation',
          title: 'Field validation',
          description:
            'Use error, invalid, and FormField for accessible field feedback.',
        },
        {
          id: 'clear-search',
          title: 'Clearable search',
          description:
            'Use clearable and onClear to reset a controlled search field.',
        },
        {
          id: 'password',
          title: 'Password reveal',
          description: 'Enable revealPassword only on password-type inputs.',
        },
      ],
      platformNotes: {
        react: [
          'React Input supports browser input types, onValueChange, and form label associations.',
          'When the app owns a clearable value, reset its state in onClear.',
        ],
        'react-native': [
          'React Native Input uses native text controls and keyboard behavior.',
          'Choose keyboardType and returnKeyType for the expected native text input.',
        ],
      },
      missingEvidence: [],
    },
    demos: {
      react: InputDemo,
      'react-native': NativeInputDemo,
    },
    Usage: InputUsage,
    Examples: InputExamples,
    Accessibility: InputAccessibility,
    api: inputApi,
    related: ['form-field', 'select', 'checkbox'],
  },
} satisfies Record<string, ComponentPageConfig>;
