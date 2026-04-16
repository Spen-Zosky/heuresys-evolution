import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HeuresysLogo } from '@/components/branding/HeuresysLogo';

describe('HeuresysLogo', () => {
  it('renders without crashing', () => {
    const { container } = render(<HeuresysLogo />);
    expect(container).toBeTruthy();
  });
});
