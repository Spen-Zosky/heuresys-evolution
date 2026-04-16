import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Slider } from '@/components/ui/slider';

describe('Slider', () => {
  it('renders without crashing', () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} step={1} />);
    expect(container).toBeTruthy();
  });
});
