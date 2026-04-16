import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, transition, variants, ...domProps } = props;
      return (
        <div ref={ref} {...domProps}>
          {children}
        </div>
      );
    }),
  },
}));

// Mock motion-presets
vi.mock('@/lib/motion-presets', () => ({
  easing: { out: [0.16, 1, 0.3, 1] },
}));

import { PageHeader, PageSection } from '@/components/ui/page-header';

describe('PageHeader', () => {
  it('renders title as h1', () => {
    render(<PageHeader title="Dashboard" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Dashboard');
  });

  it('renders description when provided', () => {
    render(<PageHeader title="Test" description="A helpful description" />);
    expect(screen.getByText('A helpful description')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<PageHeader title="Test" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });

  it('renders children in action slot', () => {
    render(
      <PageHeader title="Users">
        <button>Add User</button>
      </PageHeader>
    );
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PageHeader title="Test" className="custom-header" />);
    expect(container.firstChild).toHaveClass('custom-header');
  });

  it('renders title and description together', () => {
    render(<PageHeader title="Goals" description="Manage team objectives" />);
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Manage team objectives')).toBeInTheDocument();
  });
});

describe('PageSection', () => {
  it('renders children', () => {
    render(
      <PageSection>
        <div>Section Content</div>
      </PageSection>
    );
    expect(screen.getByText('Section Content')).toBeInTheDocument();
  });

  it('renders as section element', () => {
    const { container } = render(
      <PageSection>
        <div>Content</div>
      </PageSection>
    );
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('renders title as h2 when provided', () => {
    render(
      <PageSection title="Statistics">
        <div>Data</div>
      </PageSection>
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Statistics');
  });

  it('renders description when provided', () => {
    render(
      <PageSection title="Info" description="Additional details">
        <div>Content</div>
      </PageSection>
    );
    expect(screen.getByText('Additional details')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageSection className="section-custom">
        <div>Content</div>
      </PageSection>
    );
    expect(container.querySelector('section')).toHaveClass('section-custom');
  });

  it('does not render header when no title or description', () => {
    const { container } = render(
      <PageSection>
        <div>Just content</div>
      </PageSection>
    );
    expect(container.querySelector('h2')).not.toBeInTheDocument();
  });
});
