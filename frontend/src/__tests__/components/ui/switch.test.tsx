import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Switch } from '@/components/ui/switch';

describe('Switch', () => {
  it('renders without crashing', () => {
    const { container } = render(<Switch />);
    expect(container).toBeTruthy();
  });
});
