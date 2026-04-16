import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

describe('RadioGroup', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <RadioGroup defaultValue="option1">
        <RadioGroupItem value="option1" id="option1" />
      </RadioGroup>
    );
    expect(container).toBeTruthy();
  });
});
