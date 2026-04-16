import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeuresysBrandText } from '@/components/branding/HeuresysBrandText';

describe('HeuresysBrandText', () => {
  it('renders without crashing', () => {
    const { container } = render(<HeuresysBrandText />);
    expect(container).toBeTruthy();
  });
});
