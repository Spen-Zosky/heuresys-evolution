import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

describe('Collapsible', () => {
  it('renders trigger text', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle Section</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText('Toggle Section')).toBeInTheDocument();
  });

  it('hides content by default (closed state)', () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );
    const contentEl = container.querySelector('[data-state="closed"]');
    expect(contentEl).toBeInTheDocument();
  });

  it('shows content when trigger is clicked', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Visible content</CollapsibleContent>
      </Collapsible>
    );
    fireEvent.click(screen.getByText('Toggle'));
    const content = screen.getByText('Visible content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'open');
  });

  it('can be controlled with open prop', () => {
    render(
      <Collapsible open={true}>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Open content</CollapsibleContent>
      </Collapsible>
    );
    const content = screen.getByText('Open content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'open');
  });

  it('calls onOpenChange when toggled', () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible onOpenChange={onOpenChange}>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>
    );
    fireEvent.click(screen.getByText('Toggle'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('renders trigger as a button', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByRole('button', { name: /toggle/i })).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(
      <Collapsible disabled>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>
    );
    const trigger = screen.getByRole('button', { name: /toggle/i });
    expect(trigger).toBeDisabled();
  });
});
