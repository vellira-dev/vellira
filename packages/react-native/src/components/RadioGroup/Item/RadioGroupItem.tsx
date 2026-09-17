import { forwardRef } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

import type { ViewInstance } from 'react-native';

import { Radio } from '../../../primitives/Radio';

import type { RadioGroupItemProps } from './types';

export const RadioGroupItem: ForwardRefExoticComponent<
  RadioGroupItemProps & RefAttributes<ViewInstance>
> = forwardRef<ViewInstance, RadioGroupItemProps>((props, ref) => (
  <Radio {...props} ref={ref} />
));

RadioGroupItem.displayName = 'RadioGroup.Item';
