import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PluginSlotRenderer } from '@/components/plugins/PluginSlotRenderer';

describe('PluginSlotRenderer', () => {
  it('renders without crashing', () => {
    const { container } = render(<PluginSlotRenderer slotName="test-slot" />);
    expect(container).toBeTruthy();
  });
});
