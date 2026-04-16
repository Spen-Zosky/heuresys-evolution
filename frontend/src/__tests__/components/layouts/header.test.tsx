import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

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

import { Header } from '@/components/layouts/header';

const defaultUser = {
  name: 'Federica Marchetti',
  email: 'federica@rtl-bank.it',
  role: 'ADMIN',
};

const mockToggleSidebar = vi.fn();

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with role="banner"', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
  });

  it('displays the user name', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.getByText('Federica Marchetti')).toBeInTheDocument();
  });

  it('displays the user role', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('displays user initials in avatar fallback', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.getByText('FM')).toBeInTheDocument();
  });

  it('has a link to admin dashboard (logo)', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const logoLink = screen.getByLabelText('Heuresys Dashboard');
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/admin');
  });

  it('renders toggle menu button for mobile', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const toggleButton = screen.getByLabelText('Apri/chiudi menu');
    expect(toggleButton).toBeInTheDocument();
  });

  it('calls onToggleSidebar when menu button is clicked', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const toggleButton = screen.getByLabelText('Apri/chiudi menu');
    fireEvent.click(toggleButton);
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays tenant switcher for SUPERUSER role', () => {
    const superUser = { ...defaultUser, role: 'SUPERUSER' };
    render(
      <Header
        user={superUser}
        tenantName="RTL Bank"
        tenantCode="rtl-bank"
        onToggleSidebar={mockToggleSidebar}
      />
    );
    // SUPERUSER sees tenant switcher with default label
    expect(screen.getByText('Tutti i Tenant')).toBeInTheDocument();
  });

  it('does not display tenant switcher when tenantName is not provided', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.queryByText('Seleziona Tenant')).not.toBeInTheDocument();
  });

  it('renders notification bell', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const notifButton = screen.getByLabelText(/Notifiche/);
    expect(notifButton).toBeInTheDocument();
    // notifications are 0 by default, no badge rendered
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const themeButton = screen.getByLabelText(/Attiva tema/);
    expect(themeButton).toBeInTheDocument();
  });

  it('renders user menu button', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const userMenuButton = screen.getByLabelText('Menu utente');
    expect(userMenuButton).toBeInTheDocument();
  });

  it('renders search button with keyboard shortcut', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.getByText('Cerca...')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('displays correct initials for single-name user', () => {
    const singleNameUser = { name: 'Admin', email: 'admin@test.com', role: 'SYSADMIN' };
    render(<Header user={singleNameUser} onToggleSidebar={mockToggleSidebar} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders the fixed header with proper z-index positioning', () => {
    render(<Header user={defaultUser} onToggleSidebar={mockToggleSidebar} />);
    const banner = screen.getByRole('banner');
    expect(banner.className).toContain('fixed');
    expect(banner.className).toContain('z-50');
  });
});
