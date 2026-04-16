import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders as a div element', () => {
    const { container } = render(<Badge>Status</Badge>);
    const div = container.querySelector('div');
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent('Status');
  });

  it('applies default variant classes (bg-primary)', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('bg-primary');
    expect(badge).toHaveClass('text-primary-foreground');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('bg-secondary');
    expect(badge).toHaveClass('text-secondary-foreground');
  });

  it('applies destructive variant classes', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('bg-destructive');
    expect(badge).toHaveClass('text-destructive-foreground');
  });

  it('applies outline variant classes', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('text-foreground');
    // Outline should NOT have bg-primary
    expect(badge).not.toHaveClass('bg-primary');
  });

  it('applies base badge classes regardless of variant', () => {
    const { container } = render(<Badge>Base</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('items-center');
    expect(badge).toHaveClass('rounded-md');
    expect(badge).toHaveClass('text-xs');
    expect(badge).toHaveClass('font-semibold');
  });

  it('forwards custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>);
    const badge = container.querySelector('div');
    expect(badge).toHaveClass('custom-badge');
  });

  it('forwards additional HTML attributes', () => {
    const { container } = render(<Badge data-testid="my-badge">Test</Badge>);
    expect(screen.getByTestId('my-badge')).toBeInTheDocument();
  });
});
