import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/portal',
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
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: () => ({
    user: {
      id: '1',
      firstName: 'Mario',
      lastName: 'Rossi',
      username: 'mario.rossi',
      email: 'mario@test.com',
      role: 'EMPLOYEE',
      tenantId: 'test',
      permissions: [],
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { EmployeeLayout } from '@/components/layouts/employee-layout';

describe('EmployeeLayout', () => {
  it('renders children content', () => {
    render(
      <EmployeeLayout>
        <p>Self-service content</p>
      </EmployeeLayout>
    );
    expect(screen.getByText('Self-service content')).toBeInTheDocument();
  });

  it('renders the portal section title', () => {
    render(
      <EmployeeLayout>
        <div>Content</div>
      </EmployeeLayout>
    );
    expect(screen.getByText('Il Mio Spazio')).toBeInTheDocument();
  });

  it('renders the mobile header', () => {
    render(
      <EmployeeLayout>
        <div>Content</div>
      </EmployeeLayout>
    );
    // <header> has implicit banner role
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
  });

  it('renders main content area with aria-label', () => {
    render(
      <EmployeeLayout>
        <div>Content</div>
      </EmployeeLayout>
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Contenuto principale');
  });

  it('renders portal navigation items', () => {
    render(
      <EmployeeLayout>
        <div>Content</div>
      </EmployeeLayout>
    );
    expect(screen.getByText('Profilo')).toBeInTheDocument();
    expect(screen.getByText('I Miei Obiettivi')).toBeInTheDocument();
    expect(screen.getByText('Formazione')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <EmployeeLayout>
        <h2>My Goals</h2>
        <h2>My Courses</h2>
        <p>Details here</p>
      </EmployeeLayout>
    );
    expect(screen.getByText('My Goals')).toBeInTheDocument();
    expect(screen.getByText('My Courses')).toBeInTheDocument();
    expect(screen.getByText('Details here')).toBeInTheDocument();
  });

  it('has min-h-screen class on layout element', () => {
    const { container } = render(
      <EmployeeLayout>
        <div>Content</div>
      </EmployeeLayout>
    );
    const minHScreen = container.querySelector('.min-h-screen');
    expect(minHScreen).toBeInTheDocument();
  });
});
