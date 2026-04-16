import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img alt="" {...props} />,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'ADMIN',
      tenantId: 'test',
      permissions: [],
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { AppShell, useSidebar } from '@/components/layouts/app-shell';

const defaultUser = {
  name: 'Federica Marchetti',
  email: 'federica@rtl-bank.it',
  role: 'ADMIN',
};

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children content', () => {
    render(
      <AppShell user={defaultUser} tenantCode="rtl-bank" tenantName="RTL Bank">
        <p>Dashboard content</p>
      </AppShell>
    );
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('renders the skip-to-content accessibility link', () => {
    render(
      <AppShell user={defaultUser}>
        <div>Content</div>
      </AppShell>
    );
    const skipLink = screen.getByText('Vai al contenuto principale');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('renders the main content area with correct id and aria-label', () => {
    render(
      <AppShell user={defaultUser}>
        <div>Content</div>
      </AppShell>
    );
    const main = document.getElementById('main-content');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('aria-label', 'Contenuto principale');
  });

  it('renders header with user info', () => {
    render(
      <AppShell user={defaultUser} tenantCode="rtl-bank" tenantName="RTL Bank">
        <div>Content</div>
      </AppShell>
    );
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
  });

  it('renders sidebar navigation', () => {
    render(
      <AppShell user={defaultUser}>
        <div>Content</div>
      </AppShell>
    );
    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders footer with contentinfo role', () => {
    render(
      <AppShell user={defaultUser}>
        <div>Content</div>
      </AppShell>
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <AppShell user={defaultUser}>
        <h2>Section A</h2>
        <h2>Section B</h2>
      </AppShell>
    );
    expect(screen.getByText('Section A')).toBeInTheDocument();
    expect(screen.getByText('Section B')).toBeInTheDocument();
  });

  it('has min-h-screen class on root container', () => {
    const { container } = render(
      <AppShell user={defaultUser}>
        <div>Content</div>
      </AppShell>
    );
    // The skip link is child 0, so the shell container has the class
    const root = container.querySelector('.min-h-screen');
    expect(root).toBeInTheDocument();
  });

  it('passes tenant info to header component', () => {
    const superUser = { ...defaultUser, role: 'SUPERUSER' };
    render(
      <AppShell user={superUser} tenantCode="rtl-bank" tenantName="RTL Bank">
        <div>Content</div>
      </AppShell>
    );
    // SUPERUSER sees tenant switcher; default label when no localStorage tenant
    expect(screen.getByText('Tutti i Tenant')).toBeInTheDocument();
  });

  it('renders without tenant info', () => {
    render(
      <AppShell user={defaultUser}>
        <div>No tenant content</div>
      </AppShell>
    );
    expect(screen.getByText('No tenant content')).toBeInTheDocument();
  });
});

describe('useSidebar', () => {
  it('throws error when used outside AppShell', () => {
    function TestComponent() {
      useSidebar();
      return <div>Should not render</div>;
    }
    expect(() => render(<TestComponent />)).toThrow('useSidebar must be used within AppShell');
  });
});
