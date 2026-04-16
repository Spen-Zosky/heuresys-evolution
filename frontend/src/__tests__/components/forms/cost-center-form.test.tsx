import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/cost-centers/new',
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
    costCenters: {
      getCostCenters: vi.fn().mockResolvedValue([]),
      createCostCenter: vi.fn().mockResolvedValue({ id: 'new-id' }),
      updateCostCenter: vi.fn().mockResolvedValue({}),
    },
    departments: {
      getOrgUnits: vi.fn().mockResolvedValue([]),
    },
    employees: {
      getEmployees: vi.fn().mockResolvedValue({ employees: [] }),
    },
  },
}));

vi.mock('@/lib/motion-presets', () => ({
  staggerContainer: {},
  staggerItem: {},
}));

// Mock Select to avoid Radix SelectItem value="" error
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

import { CostCenterForm } from '@/components/forms/cost-center-form';

describe('CostCenterForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders all basic info fields with labels', () => {
    render(<CostCenterForm mode="create" />);
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Codice *')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrizione')).toBeInTheDocument();
  });

  it('renders budget amount field', () => {
    render(<CostCenterForm mode="create" />);
    expect(screen.getByLabelText(/Budget Annuale/)).toBeInTheDocument();
  });

  it('renders hierarchy section with parent and org unit selectors', () => {
    render(<CostCenterForm mode="create" />);
    expect(screen.getByText('Gerarchia')).toBeInTheDocument();
    expect(screen.getByText('Centro di Costo Padre')).toBeInTheDocument();
    expect(screen.getByText('Responsabile')).toBeInTheDocument();
  });

  it('renders status section with active toggle', () => {
    render(<CostCenterForm mode="create" />);
    expect(screen.getByText('Centro di Costo Attivo')).toBeInTheDocument();
  });

  it('shows "Crea Centro" button in create mode', () => {
    render(<CostCenterForm mode="create" />);
    expect(screen.getByText('Crea Centro')).toBeInTheDocument();
  });

  it('shows "Salva Modifiche" button in edit mode', () => {
    const costCenter = {
      id: '1',
      name: 'Test',
      code: 'TST',
      is_active: true,
      description: '',
      parent_id: '',
      org_unit_id: '',
      responsible_id: '',
      cost_center_type: '',
      budget_amount: 0,
    } as any;
    render(<CostCenterForm mode="edit" costCenter={costCenter} />);
    expect(screen.getByText('Salva Modifiche')).toBeInTheDocument();
  });

  it('renders cancel button that calls router.back()', () => {
    render(<CostCenterForm mode="create" />);
    const cancelBtn = screen.getByText('Annulla');
    fireEvent.click(cancelBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  it('updates name input when typing', () => {
    render(<CostCenterForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.change(nameInput, { target: { value: 'Nuovo Centro' } });
    expect(nameInput).toHaveValue('Nuovo Centro');
  });

  it('auto-generates code from name in create mode', () => {
    render(<CostCenterForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.change(nameInput, { target: { value: 'Test Centro' } });
    const codeInput = screen.getByLabelText('Codice *');
    expect(codeInput).toHaveValue('TEST-CENTRO');
  });

  it('populates form fields in edit mode', () => {
    const costCenter = {
      id: '1',
      name: 'Existing',
      code: 'EXT',
      is_active: true,
      description: 'A description',
      parent_id: '',
      org_unit_id: '',
      responsible_id: '',
      cost_center_type: 'OPERATIONAL',
      budget_amount: 50000,
    } as any;
    render(<CostCenterForm mode="edit" costCenter={costCenter} />);
    expect(screen.getByLabelText('Nome *')).toHaveValue('Existing');
    expect(screen.getByLabelText('Codice *')).toHaveValue('EXT');
    expect(screen.getByLabelText('Descrizione')).toHaveValue('A description');
  });
});
