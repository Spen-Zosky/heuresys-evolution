import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockToggle = vi.fn();
const mockSetMobileOpen = vi.fn();

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

vi.mock('@/components/layouts/app-shell', () => ({
  useSidebar: () => ({
    collapsed: false,
    toggle: mockToggle,
    isMobile: false,
    mobileOpen: false,
    setMobileOpen: mockSetMobileOpen,
    setCollapsed: vi.fn(),
  }),
}));

import { Sidebar } from '@/components/layouts/sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with role="navigation"', () => {
    render(<Sidebar collapsed={false} />);
    const nav = screen.getByLabelText('Navigazione principale');
    expect(nav).toBeInTheDocument();
  });

  it('has aria-label for main navigation', () => {
    render(<Sidebar collapsed={false} />);
    const nav = screen.getByLabelText('Navigazione principale');
    expect(nav).toHaveAttribute('aria-label', 'Navigazione principale');
  });

  it('renders Dashboard nav item', () => {
    render(<Sidebar collapsed={false} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Dipendenti nav item for ADMIN role', () => {
    render(<Sidebar collapsed={false} />);
    expect(screen.getByText('Dipendenti')).toBeInTheDocument();
  });

  it('renders Dipartimenti nav item', () => {
    render(<Sidebar collapsed={false} />);
    expect(screen.getByText('Dipartimenti')).toBeInTheDocument();
  });

  it('renders section titles when not collapsed', () => {
    render(<Sidebar collapsed={false} />);
    expect(screen.getByText('Panoramica')).toBeInTheDocument();
    expect(screen.getByText('Gestione HR')).toBeInTheDocument();
  });

  it('hides section titles when collapsed', () => {
    render(<Sidebar collapsed={true} />);
    expect(screen.queryByText('Panoramica')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestione HR')).not.toBeInTheDocument();
  });

  it('renders collapse/expand toggle button', () => {
    render(<Sidebar collapsed={false} />);
    const collapseBtn = screen.getByLabelText('Comprimi sidebar');
    expect(collapseBtn).toBeInTheDocument();
  });

  it('shows expand label when collapsed', () => {
    render(<Sidebar collapsed={true} />);
    const expandBtn = screen.getByLabelText('Espandi sidebar');
    expect(expandBtn).toBeInTheDocument();
  });

  it('calls toggle when collapse button is clicked', () => {
    render(<Sidebar collapsed={false} />);
    const collapseBtn = screen.getByLabelText('Comprimi sidebar');
    fireEvent.click(collapseBtn);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('displays user role when not collapsed', () => {
    render(<Sidebar collapsed={false} />);
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText(/Ruolo:/)).toBeInTheDocument();
  });

  it('hides user role when collapsed', () => {
    render(<Sidebar collapsed={true} />);
    expect(screen.queryByText(/Ruolo:/)).not.toBeInTheDocument();
  });

  it('renders as aside element', () => {
    const { container } = render(<Sidebar collapsed={false} />);
    const aside = container.querySelector('aside');
    expect(aside).toBeInTheDocument();
  });

  it('hides nav labels when collapsed', () => {
    render(<Sidebar collapsed={true} />);
    // The text labels should not be visible when collapsed
    expect(screen.queryByText('Comprimi')).not.toBeInTheDocument();
  });
});
