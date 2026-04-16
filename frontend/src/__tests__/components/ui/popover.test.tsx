import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

describe('Popover', () => {
  it('renders trigger element', () => {
    render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
      </Popover>
    );
    expect(screen.getByText('Open Popover')).toBeInTheDocument();
  });

  it('shows content when open is controlled', () => {
    render(
      <Popover open={true}>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Popover body')).toBeInTheDocument();
  });

  it('hides content when closed', () => {
    render(
      <Popover open={false}>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Hidden body</PopoverContent>
      </Popover>
    );
    expect(screen.queryByText('Hidden body')).not.toBeInTheDocument();
  });

  it('opens when trigger is clicked', async () => {
    render(
      <Popover>
        <PopoverTrigger>Click Me</PopoverTrigger>
        <PopoverContent>Content here</PopoverContent>
      </Popover>
    );
    fireEvent.click(screen.getByText('Click Me'));
    await waitFor(() => {
      expect(screen.getByText('Content here')).toBeInTheDocument();
    });
  });

  it('PopoverContent applies custom className', () => {
    render(
      <Popover open={true}>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent className="custom-popover">Styled content</PopoverContent>
      </Popover>
    );
    const content = screen.getByText('Styled content');
    expect(content.closest('[data-state]')).toHaveClass('custom-popover');
  });

  it('renders complex content within popover', () => {
    render(
      <Popover open={true}>
        <PopoverTrigger>Info</PopoverTrigger>
        <PopoverContent>
          <h3>Title</h3>
          <p>Description text</p>
          <button>Action</button>
        </PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('calls onOpenChange when state changes', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popover open={true} onOpenChange={onOpenChange}>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
