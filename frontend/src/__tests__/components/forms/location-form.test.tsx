import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/locations/new',
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
    locations: {
      createLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      updateLocation: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/motion-presets', () => ({
  staggerContainer: {},
  staggerItem: {},
}));

// Mock Select to avoid Radix issues with empty value SelectItem
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select-root">{children}</div>,
  SelectTrigger: ({ children }: any) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

import { LocationForm } from '@/components/forms/location-form';

describe('LocationForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders basic info fields with labels', () => {
    render(<LocationForm mode="create" />);
    expect(screen.getByLabelText('Nome *')).toBeInTheDocument();
    expect(screen.getByLabelText('Codice *')).toBeInTheDocument();
    expect(screen.getByLabelText(/Capacità/)).toBeInTheDocument();
  });

  it('renders address section fields', () => {
    render(<LocationForm mode="create" />);
    // "Indirizzo" appears as both section CardTitle and Label, so use getAllByText
    const indirizzo = screen.getAllByText('Indirizzo');
    expect(indirizzo.length).toBeGreaterThanOrEqual(2); // section title + label
    expect(screen.getByLabelText('Indirizzo')).toBeInTheDocument();
    expect(screen.getByLabelText('Città')).toBeInTheDocument();
    expect(screen.getByLabelText('Provincia')).toBeInTheDocument();
    expect(screen.getByLabelText('CAP')).toBeInTheDocument();
    expect(screen.getByLabelText('Paese')).toBeInTheDocument();
  });

  it('renders status section with headquarters and active toggles', () => {
    render(<LocationForm mode="create" />);
    // "Sede Centrale" appears in both LOCATION_TYPES options and status toggle label
    const sedeCentrale = screen.getAllByText('Sede Centrale');
    expect(sedeCentrale.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sede Attiva')).toBeInTheDocument();
  });

  it('shows "Crea Sede" button in create mode', () => {
    render(<LocationForm mode="create" />);
    expect(screen.getByText('Crea Sede')).toBeInTheDocument();
  });

  it('shows "Salva Modifiche" button in edit mode', () => {
    const location = {
      id: '1',
      name: 'Milano',
      code: 'MI',
      description: '',
      address: '',
      city: 'Milano',
      province: 'MI',
      postal_code: '20100',
      country: 'Italia',
      location_type: 'OFFICE',
      capacity_headcount: 100,
      is_headquarters: false,
      is_active: true,
    } as any;
    render(<LocationForm mode="edit" location={location} />);
    expect(screen.getByText('Salva Modifiche')).toBeInTheDocument();
  });

  it('navigates back on cancel click', () => {
    render(<LocationForm mode="create" />);
    fireEvent.click(screen.getByText('Annulla'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('auto-generates code from name in create mode', () => {
    render(<LocationForm mode="create" />);
    const nameInput = screen.getByLabelText('Nome *');
    fireEvent.change(nameInput, { target: { value: 'Sede Roma' } });
    const codeInput = screen.getByLabelText('Codice *');
    expect(codeInput).toHaveValue('SEDE-ROMA');
  });

  it('defaults country to Italia', () => {
    render(<LocationForm mode="create" />);
    expect(screen.getByLabelText('Paese')).toHaveValue('Italia');
  });

  it('populates all form fields in edit mode', () => {
    const location = {
      id: '1',
      name: 'Sede Milano',
      code: 'SEDE-MI',
      description: 'Main office',
      address: 'Via Roma 1',
      city: 'Milano',
      province: 'MI',
      postal_code: '20100',
      country: 'Italia',
      location_type: 'HEADQUARTERS',
      capacity_headcount: 200,
      is_headquarters: true,
      is_active: true,
    } as any;
    render(<LocationForm mode="edit" location={location} />);
    expect(screen.getByLabelText('Nome *')).toHaveValue('Sede Milano');
    expect(screen.getByLabelText('Codice *')).toHaveValue('SEDE-MI');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('Via Roma 1');
    expect(screen.getByLabelText('Città')).toHaveValue('Milano');
    expect(screen.getByLabelText('Provincia')).toHaveValue('MI');
    expect(screen.getByLabelText('CAP')).toHaveValue('20100');
  });

  it('renders all section cards', () => {
    render(<LocationForm mode="create" />);
    expect(screen.getByText('Informazioni Base')).toBeInTheDocument();
    // "Indirizzo" has multiple occurrences (section title + label)
    const indirElements = screen.getAllByText('Indirizzo');
    expect(indirElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Stato')).toBeInTheDocument();
  });

  it('renders type selector', () => {
    render(<LocationForm mode="create" />);
    expect(screen.getByText('Tipo Sede')).toBeInTheDocument();
  });
});
