import { RadioGroupItem } from './Item';
import { RadioGroupRoot } from './Root';

type RadioGroupComponent = typeof RadioGroupRoot & {
  Item: typeof RadioGroupItem;
};

export const RadioGroup: RadioGroupComponent = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

RadioGroup.displayName = 'RadioGroup';
