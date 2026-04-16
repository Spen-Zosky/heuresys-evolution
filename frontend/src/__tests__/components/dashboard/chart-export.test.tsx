import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React, { useRef } from 'react';

// Mock the dropdown menu to avoid Radix portal issues in jsdom
vi.mock('@/components/ui/dropdown-menu', () => {
  const DropdownMenu = ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>;
  const DropdownMenuTrigger = ({ children, asChild }: any) => {
    if (asChild) return <>{children}</>;
    return <div>{children}</div>;
  };
  const DropdownMenuContent = ({ children }: any) => (
    <div data-testid="dropdown-content" role="menu">
      {children}
    </div>
  );
  const DropdownMenuItem = ({ children, onClick }: any) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  );
  return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
});

import { ChartExportButton } from '@/components/dashboard/chart-export';

function TestWrapper({
  title = 'Test Chart',
  exportData,
}: {
  title?: string;
  exportData?: { headers: string[]; rows: (string | number)[][]; filename: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const data = exportData || {
    headers: ['Mese', 'Valore'],
    rows: [
      ['Gen', 100],
      ['Feb', 200],
    ],
    filename: 'export-test',
  };
  return (
    <div>
      <div ref={ref}>Chart content</div>
      <ChartExportButton chartRef={ref} exportData={data} title={title} />
    </div>
  );
}

describe('ChartExportButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the export trigger button', () => {
    render(<TestWrapper />);
    const button = screen.getByTitle('Esporta Test Chart');
    expect(button).toBeInTheDocument();
  });

  it('renders both PNG and CSV menu items', () => {
    render(<TestWrapper />);
    expect(screen.getByText('Esporta come PNG')).toBeInTheDocument();
    expect(screen.getByText('Esporta come CSV')).toBeInTheDocument();
  });

  it('uses the title prop in the trigger button title attribute', () => {
    render(<TestWrapper title="Trend Organico" />);
    expect(screen.getByTitle('Esporta Trend Organico')).toBeInTheDocument();
  });

  it('renders two menu items with menuitem role', () => {
    render(<TestWrapper />);
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(2);
  });

  it('renders download icon in trigger button', () => {
    render(<TestWrapper />);
    const button = screen.getByTitle('Esporta Test Chart');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('creates a download link when CSV option is clicked', () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:test');
    const mockRevokeObjectURL = vi.fn();
    const origCreateObjectURL = global.URL.createObjectURL;
    const origRevokeObjectURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    // Track link creation without blocking React rendering
    const createdLinks: HTMLAnchorElement[] = [];
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string, options?: ElementCreationOptions) => {
        const el = origCreateElement(tag, options);
        if (tag === 'a') {
          createdLinks.push(el as HTMLAnchorElement);
        }
        return el;
      });

    render(<TestWrapper />);
    const csvOption = screen.getByText('Esporta come CSV');
    fireEvent.click(csvOption);

    expect(mockCreateObjectURL).toHaveBeenCalled();

    createElementSpy.mockRestore();
    global.URL.createObjectURL = origCreateObjectURL;
    global.URL.revokeObjectURL = origRevokeObjectURL;
  });
});
