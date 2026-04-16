import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea', () => {
  it('renders without crashing', () => {
    const { container } = render(<Textarea />);
    expect(container).toBeTruthy();
  });
});
