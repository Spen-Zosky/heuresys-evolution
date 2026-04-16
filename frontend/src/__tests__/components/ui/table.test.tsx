import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TableHeader } from '@/components/ui/table';

describe('TableHeader', () => {
  it('renders without crashing', () => {
    const { container } = render(<TableHeader />);
    expect(container).toBeTruthy();
  });
});
