import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion to avoid animation complexities in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.Ref<HTMLDivElement>
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
    span: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.Ref<HTMLSpanElement>
      ) => (
        <span ref={ref} {...props}>
          {children}
        </span>
      )
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { Callout, HelpTooltip, FeatureBadge } from '@/components/ui/callout';

describe('Callout', () => {
  it('renders children content', () => {
    render(<Callout>This is helpful information</Callout>);
    expect(screen.getByText('This is helpful information')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Callout title="Important Note">Content here</Callout>);
    expect(screen.getByText('Important Note')).toBeInTheDocument();
  });

  it('does not render title when not provided', () => {
    const { container } = render(<Callout>Content only</Callout>);
    // Should only have the content text, no title paragraph
    const fontMedium = container.querySelectorAll('.font-medium');
    // Icon might have font-medium, check for title text
    expect(screen.queryByText('Important Note')).not.toBeInTheDocument();
  });

  it('renders info variant by default', () => {
    const { container } = render(<Callout>Info callout</Callout>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('bg-info/5');
    expect(root).toHaveClass('border-info/20');
  });

  it('renders warning variant classes', () => {
    const { container } = render(<Callout variant="warning">Warning</Callout>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('bg-destructive/5');
  });

  it('renders success variant classes', () => {
    const { container } = render(<Callout variant="success">Success</Callout>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('bg-emerald-500/5');
  });

  it('renders tip variant classes', () => {
    const { container } = render(<Callout variant="tip">Tip</Callout>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('bg-warning/5');
  });

  it('renders learn more link when learnMoreUrl is provided', () => {
    render(<Callout learnMoreUrl="https://example.com">Content</Callout>);
    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders dismiss button when dismissible is true', () => {
    render(<Callout dismissible>Dismissible content</Callout>);
    const dismissBtn = screen.getByRole('button', { name: /chiudi/i });
    expect(dismissBtn).toBeInTheDocument();
  });

  it('hides content after dismiss button is clicked', () => {
    render(<Callout dismissible>Dismissible content</Callout>);
    const dismissBtn = screen.getByRole('button', { name: /chiudi/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('Dismissible content')).not.toBeInTheDocument();
  });

  it('calls onDismiss callback when dismissed', () => {
    const onDismiss = vi.fn();
    render(
      <Callout dismissible onDismiss={onDismiss}>
        Content
      </Callout>
    );
    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not render dismiss button when dismissible is false', () => {
    render(<Callout>Non-dismissible</Callout>);
    expect(screen.queryByRole('button', { name: /chiudi/i })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Callout className="my-callout">Content</Callout>);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('my-callout');
  });
});

describe('HelpTooltip', () => {
  it('renders a help button with "?" text', () => {
    render(<HelpTooltip content="Help text" />);
    const button = screen.getByRole('button', { name: /help/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows tooltip content on mouse enter', () => {
    render(<HelpTooltip content="Helpful information" />);
    const button = screen.getByRole('button', { name: /help/i });
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Helpful information')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    render(<HelpTooltip content="Helpful information" />);
    const button = screen.getByRole('button', { name: /help/i });
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Helpful information')).toBeInTheDocument();
    fireEvent.mouseLeave(button);
    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument();
  });

  it('shows title in tooltip when provided', () => {
    render(<HelpTooltip content="Details" title="Tooltip Title" />);
    const button = screen.getByRole('button', { name: /help/i });
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Tooltip Title')).toBeInTheDocument();
  });
});

describe('FeatureBadge', () => {
  it('renders default "New" label', () => {
    render(<FeatureBadge />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<FeatureBadge label="Beta" />);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<FeatureBadge className="custom-badge" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('custom-badge');
  });
});
