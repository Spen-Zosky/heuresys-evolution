import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AIChatFAB } from '@/components/ai/ai-chat';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('AIChatFAB', () => {
  it('renders without crashing', () => {
    const { container } = render(<AIChatFAB onClick={() => {}} />);
    expect(container).toBeTruthy();
  });
});
