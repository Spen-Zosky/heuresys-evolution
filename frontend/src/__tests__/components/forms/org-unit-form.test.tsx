import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/org-units/new',
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
    orgUnits: {
      getOrgUnits: vi.fn().mockResolvedValue([]),
      getOrgUnitTypes: vi.fn().mockResolvedValue([]),
      createOrgUnit: vi.fn().mockResolvedValue({ id: 'ou-1' }),
      updateOrgUnit: vi.fn().mockResolvedValue({}),
    },
    departments: {
      getOrgUnits: vi.fn().mockResolvedValue([]),
    },
    locations: {
      getLocations: vi.fn().mockResolvedValue([]),
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
  Select: ({ children }: any) => <div data-testid="select-root">{children}</div>,
  SelectTrigger: ({ children }: any) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

import { OrgUnitForm } from '@/components/forms/org-unit-form';

describe('OrgUnitForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders basic info fields with labels', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Codice *')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrizione')).toBeInTheDocument();
  });

  it('renders organization structure section', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText('Struttura Organizzativa')).toBeInTheDocument();
    expect(screen.getByLabelText('Livello Organizzativo')).toBeInTheDocument();
    expect(screen.getByLabelText('Ordine Visualizzazione')).toBeInTheDocument();
  });

  it('renders relationships section', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText('Relazioni')).toBeInTheDocument();
    expect(screen.getByText('Dipartimento')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Sede di Default')).toBeInTheDocument();
  });

  it('renders status section with active toggle', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText('Unità Attiva')).toBeInTheDocument();
  });

  it('shows "Crea Unità" button in create mode', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText('Crea Unità')).toBeInTheDocument();
  });

  it('shows "Salva Modifiche" button in edit mode', () => {
    const orgUnit = {
      id: '1',
      name: 'IT Dept',
      code: 'IT',
      description: '',
      parent_id: '',
      org_unit_id: '',
      manager_id: '',
      default_location_id: '',
      org_level: 1,
      org_type: '',
      sort_order: 0,
      is_active: true,
    } as any;
    render(<OrgUnitForm mode="edit" orgUnit={orgUnit} />);
    expect(screen.getByText('Salva Modifiche')).toBeInTheDocument();
  });

  it('navigates back on cancel', () => {
    render(<OrgUnitForm mode="create" />);
    fireEvent.click(screen.getByText('Annulla'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('auto-generates code from name in create mode', () => {
    render(<OrgUnitForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.change(nameInput, { target: { value: 'Dir Commerciale' } });
    const codeInput = screen.getByLabelText('Codice *');
    expect(codeInput).toHaveValue('DIR-COMMERCIALE');
  });

  it('populates form fields in edit mode', () => {
    const orgUnit = {
      id: '1',
      name: 'Direzione Generale',
      code: 'DIR-GEN',
      description: 'Top level',
      parent_id: '',
      org_unit_id: '',
      manager_id: '',
      default_location_id: '',
      org_level: 1,
      org_type: 'DIREZIONE',
      sort_order: 1,
      is_active: true,
    } as any;
    render(<OrgUnitForm mode="edit" orgUnit={orgUnit} />);
    expect(screen.getByLabelText('Nome *')).toHaveValue('Direzione Generale');
    expect(screen.getByLabelText('Codice *')).toHaveValue('DIR-GEN');
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Top level');
    expect(screen.getByLabelText('Livello Organizzativo')).toHaveValue(1);
  });

  it('defaults org_level to 1', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByLabelText('Livello Organizzativo')).toHaveValue(1);
  });

  it('renders all four section cards', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText('Informazioni Base')).toBeInTheDocument();
    expect(screen.getByText('Struttura Organizzativa')).toBeInTheDocument();
    expect(screen.getByText('Relazioni')).toBeInTheDocument();
    expect(screen.getByText('Stato')).toBeInTheDocument();
  });

  it('shows hierarchy level help text', () => {
    render(<OrgUnitForm mode="create" />);
    expect(screen.getByText(/1 = Top level/)).toBeInTheDocument();
  });
});
