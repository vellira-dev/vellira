import { useRef, useState } from 'react';

import { Modal } from './components/Modal';
import { RadioGroup } from './components/RadioGroup';
import { Select } from './components/Select';

import { FormField } from '#patterns/FormField';
import { Checkbox } from '#primitives/Checkbox';
import { Input } from '#primitives/Input';
import { Radio } from '#primitives/Radio';

// Regression: a normal React ref has a nullable current before the DOM mounts.
export function WebModalNullableFocusRefsExample() {
  const initialFocus = useRef<HTMLInputElement | null>(null);
  const finalFocus = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button type='button' ref={finalFocus}>
        Open dialog
      </button>
      <Modal open={false} initialFocus={initialFocus} finalFocus={finalFocus}>
        <Modal.Content ariaLabel='Focusable dialog'>
          <input ref={initialFocus} aria-label='Dialog field' />
        </Modal.Content>
      </Modal>
    </>
  );
}

export function WebInputValueChangeExample() {
  const [email, setEmail] = useState('');

  return (
    <Input
      label='Email'
      value={email}
      onValueChange={setEmail}
      type='email'
      placeholder='name@example.com'
    />
  );
}

export function WebCheckboxCheckedChangeExample() {
  const [accepted, setAccepted] = useState(false);

  return (
    <Checkbox
      label='Accept terms'
      description='Required to continue.'
      checked={accepted}
      onCheckedChange={setAccepted}
      required
      color='primary'
      size='md'
    />
  );
}

export function WebRadioCheckedChangeExample() {
  const [checked, setChecked] = useState(false);

  return (
    <Radio
      value='email'
      label='Email'
      description='Send notifications by email.'
      checked={checked}
      onCheckedChange={setChecked}
      color='primary'
      size='md'
    />
  );
}

export function WebRadioGroupValueChangeExample() {
  const [plan, setPlan] = useState('pro');

  return (
    <RadioGroup
      name='plan'
      label='Plan'
      description='Choose the billing plan.'
      value={plan}
      onValueChange={setPlan}
      color='primary'
      size='md'
      orientation='vertical'
    >
      <Radio value='starter' label='Starter' />
      <Radio value='pro' label='Pro' />
      <Radio value='enterprise' label='Enterprise' />
    </RadioGroup>
  );
}

export function WebFormFieldBindControlExample() {
  return (
    <FormField
      label='Workspace'
      description='Connected through generated id and aria props.'
      error='Use lowercase letters, numbers and hyphens.'
      required
      size='md'
      orientation='vertical'
      bindControl
    >
      <input placeholder='vellira-design' />
    </FormField>
  );
}

const countryOptions = [
  { label: 'France', value: 'fr' },
  { label: 'Germany', value: 'de' },
  { label: 'Spain', value: 'es' },
];

function CountryItems() {
  return (
    <>
      {countryOptions.map((option) => (
        <Select.Item key={option.value} value={option.value}>
          {option.label}
        </Select.Item>
      ))}
    </>
  );
}

export function WebSelectValueChangeExample() {
  const [country, setCountry] = useState<string | null>('fr');

  return (
    <Select
      label='Country'
      value={country}
      onValueChange={setCountry}
      color='primary'
      variant='outline'
      size='md'
      placeholder='Choose country'
      disabled={false}
      required
      invalid={false}
      clearable
      searchable
      loading={false}
      open={false}
      defaultOpen={false}
      onOpenChange={() => undefined}
    >
      <Select.Trigger />
      <Select.Content>
        <CountryItems />
      </Select.Content>
    </Select>
  );
}

export function WebSelectMultipleValueChangeExample() {
  const [countries, setCountries] = useState<string[]>(['fr']);

  return (
    <Select
      label='Countries'
      multiple
      value={countries}
      onValueChange={setCountries}
      maxSelected={2}
      closeOnSelect={false}
    >
      <CountryItems />
    </Select>
  );
}

export function WebSelectAdvancedContractExample() {
  const [teams, setTeams] = useState<string[]>(['product']);

  return (
    <Select
      label='Teams'
      description='Choose up to two teams.'
      value={teams}
      onValueChange={setTeams}
      multiple
      maxSelected={2}
      closeOnSelect={false}
      searchable
      clearable
      color='primary'
      variant='outline'
      onSearch={() => undefined}
      empty='Nothing found'
      loadingText='Searching...'
    >
      <Select.Group label='Core teams'>
        <Select.Item value='product'>Product</Select.Item>
        <Select.Item value='engineering'>Engineering</Select.Item>
      </Select.Group>
      <Select.Separator />
      <Select.Item value='support' badge='NEW'>
        Support
      </Select.Item>
    </Select>
  );
}
