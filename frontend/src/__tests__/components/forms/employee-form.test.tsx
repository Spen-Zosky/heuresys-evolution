import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/employees/new',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    form: React.forwardRef(({ children, onSubmit, ...rest }: any, ref: any) => (
      <form ref={ref} onSubmit={onSubmit} {...rest}>
        {children}
      </form>
    )),
    div: React.forwardRef(({ children, ...rest }: any, ref: any) => (
      <div ref={ref} {...rest}>
        {children}
      </div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({
  api: {
    departments: {
      getOrgUnits: vi.fn().mockResolvedValue([
        { id: 'd1', name: 'IT' },
        { id: 'd2', name: 'HR' },
      ]),
    },
    employees: {
      createEmployee: vi.fn().mockResolvedValue({ id: 'emp-1' }),
      updateEmployee: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/motion-presets', () => ({
  staggerContainer: {},
  staggerItem: {},
}));

vi.mock('@/lib/validation', () => ({
  validators: {
    required: () => (v: string) => (v ? null : 'Campo obbligatorio'),
    minLength: (n: number) => (v: string) => (v && v.length >= n ? null : `Min ${n} caratteri`),
    email: () => (v: string) => (v && v.includes('@') ? null : 'Email non valida'),
    phone: () => () => null,
  },
  validateEmail: (v: string) => v.includes('@'),
  validateItalianPhone: () => true,
  validationMessages: {},
}));

import { EmployeeForm } from '@/components/forms/employee-form';

describe('EmployeeForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders personal info fields in create mode', () => {
    render(<EmployeeForm mode="create" />);
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Cognome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Email *')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefono')).toBeInTheDocument();
    expect(screen.getByLabelText('Cellulare')).toBeInTheDocument();
  });

  it('renders employment info fields', () => {
    render(<EmployeeForm mode="create" />);
    expect(screen.getByLabelText('Ruolo *')).toBeInTheDocument();
    expect(screen.getByLabelText('Data Assunzione *')).toBeInTheDocument();
    expect(screen.getByText('Dipartimento *')).toBeInTheDocument();
  });

  it('renders section cards with correct headers', () => {
    render(<EmployeeForm mode="create" />);
    expect(screen.getByText('Informazioni Personali')).toBeInTheDocument();
    expect(screen.getByText('Informazioni Lavorative')).toBeInTheDocument();
  });

  it('shows "Crea Dipendente" button in create mode', () => {
    render(<EmployeeForm mode="create" />);
    expect(screen.getByText('Crea Dipendente')).toBeInTheDocument();
  });

  it('shows "Salva Modifiche" button in edit mode', () => {
    const employee = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@test.com',
      job_title: 'Dev',
      org_unit_id: 'd1',
      hire_date: '2024-01-15',
      manager_id: '',
      location_id: '',
      cost_center_id: '',
      is_active: true,
      employment_status: 'active',
      phone: '',
      mobile: '',
    } as any;
    render(<EmployeeForm mode="edit" employee={employee} />);
    expect(screen.getByText('Salva Modifiche')).toBeInTheDocument();
  });

  it('shows status section only in edit mode', () => {
    const { rerender } = render(<EmployeeForm mode="create" />);
    expect(screen.queryByText('Dipendente Attivo')).not.toBeInTheDocument();

    const employee = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@test.com',
      job_title: 'Dev',
      org_unit_id: 'd1',
      hire_date: '2024-01-15',
      manager_id: '',
      location_id: '',
      cost_center_id: '',
      is_active: true,
      employment_status: 'active',
      phone: '',
      mobile: '',
    } as any;
    rerender(<EmployeeForm mode="edit" employee={employee} />);
    expect(screen.getByText('Dipendente Attivo')).toBeInTheDocument();
  });

  it('navigates back on cancel', () => {
    render(<EmployeeForm mode="create" />);
    fireEvent.click(screen.getByText('Annulla'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('populates form fields in edit mode', () => {
    const employee = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@test.com',
      job_title: 'Software Developer',
      org_unit_id: 'd1',
      hire_date: '2024-01-15',
      manager_id: '',
      location_id: '',
      cost_center_id: '',
      is_active: true,
      employment_status: 'active',
      phone: '+39 02 1234567',
      mobile: '',
    } as any;
    render(<EmployeeForm mode="edit" employee={employee} />);
    expect(screen.getByLabelText('Nome *')).toHaveValue('Mario');
    expect(screen.getByLabelText('Cognome *')).toHaveValue('Rossi');
    expect(screen.getByLabelText('Email *')).toHaveValue('mario@test.com');
    expect(screen.getByLabelText('Ruolo *')).toHaveValue('Software Developer');
    expect(screen.getByLabelText('Telefono')).toHaveValue('+39 02 1234567');
  });

  it('uses aria-invalid on fields with errors after blur', () => {
    render(<EmployeeForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.blur(nameInput);
    // Field should have aria-invalid when empty
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears field error when user starts typing', () => {
    render(<EmployeeForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.blur(nameInput); // trigger validation
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(nameInput, { target: { value: 'Mario' } });
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
  });
});
