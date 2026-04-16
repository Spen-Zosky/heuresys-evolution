import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/hr-core/employees',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Breadcrumb } from '@/components/ui/breadcrumb';

describe('Breadcrumb', () => {
  it('renders nav with aria-label="Breadcrumb"', () => {
    render(<Breadcrumb />);
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
  });

  it('renders an ordered list', () => {
    const { container } = render(<Breadcrumb />);
    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();
  });

  it('shows home icon link by default', () => {
    render(<Breadcrumb />);
    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/admin');
  });

  it('hides home icon when showHome is false', () => {
    render(<Breadcrumb showHome={false} />);
    expect(screen.queryByRole('link', { name: /home/i })).not.toBeInTheDocument();
  });

  it('auto-generates breadcrumbs from pathname', () => {
    render(<Breadcrumb />);
    // Pathname is /admin/hr-core/employees
    // admin = skipped (same as homeHref /admin)
    // hr-core => "HR Core"
    // employees => "Dipendenti" (last item)
    expect(screen.getByText('HR Core')).toBeInTheDocument();
    expect(screen.getByText('Dipendenti')).toBeInTheDocument();
  });

  it('renders custom items when provided', () => {
    const items = [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Users', href: '/admin/users' },
    ];
    render(<Breadcrumb items={items} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('marks last breadcrumb item with aria-current="page"', () => {
    render(<Breadcrumb />);
    const currentPage = screen.getByText('Dipendenti');
    expect(currentPage).toHaveAttribute('aria-current', 'page');
  });

  it('renders separator icons between items', () => {
    const { container } = render(<Breadcrumb />);
    // ChevronRight icons are used as separators (with aria-hidden)
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className', () => {
    const { container } = render(<Breadcrumb className="custom-breadcrumb" />);
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('custom-breadcrumb');
  });

  it('uses custom homeHref and homeLabel', () => {
    render(<Breadcrumb homeHref="/portal" homeLabel="Portal Home" />);
    const homeLink = screen.getByRole('link', { name: /portal home/i });
    expect(homeLink).toHaveAttribute('href', '/portal');
  });
});
