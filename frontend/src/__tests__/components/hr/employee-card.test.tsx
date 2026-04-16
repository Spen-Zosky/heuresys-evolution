import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

import { EmployeeCard } from '@/components/hr/employee-card';

describe('EmployeeCard', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <EmployeeCard
        employee={{
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          department: 'IT',
          role: 'Developer',
          status: 'active',
        }}
      />
    );
    expect(container).toBeTruthy();
  });
});
