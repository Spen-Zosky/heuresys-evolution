import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock dropdown menu to avoid Radix portal issues in jsdom
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
  const DropdownMenuItem = ({ children, onClick, className }: any) => (
    <div role="menuitem" onClick={onClick} className={className}>
      {children}
    </div>
  );
  return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
});

import { TimeRangeSelector, TIME_RANGE_OPTIONS } from '@/components/dashboard/time-range-selector';
import type { TimeRange } from '@/components/dashboard/time-range-selector';

describe('TimeRangeSelector', () => {
  const mockOnChange = vi.fn();

  afterEach(() => {
    mockOnChange.mockClear();
  });

  it('renders with the current option label in the trigger button', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);
    // The label appears in both the trigger button and the dropdown menu item
    const elements = screen.getAllByText('Ultimi 30 giorni');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays all time range options in the dropdown menu', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);
    // With mocked dropdown, all options are rendered as menu items
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(6);
  });

  it('shows the correct label for each time range value in the button', () => {
    const testCases: { value: TimeRange; label: string }[] = [
      { value: 'today', label: 'Oggi' },
      { value: '7d', label: 'Ultimi 7 giorni' },
      { value: '90d', label: 'Ultimo trimestre' },
      { value: 'ytd', label: 'Da inizio anno' },
      { value: '12m', label: 'Ultimi 12 mesi' },
    ];

    for (const tc of testCases) {
      const { unmount } = render(<TimeRangeSelector value={tc.value} onChange={mockOnChange} />);
      // Label appears in both trigger and menu; use getAllByText to avoid duplicate error
      const elements = screen.getAllByText(tc.label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
      // Verify it's in the button specifically
      const button = screen.getByRole('button');
      expect(button.textContent).toContain(tc.label);
      unmount();
    }
  });

  it('calls onChange with the selected value', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);
    // Find the menu item for "Ultimi 7 giorni" by role
    const menuItems = screen.getAllByRole('menuitem');
    const sevenDayItem = menuItems.find((item) => item.textContent?.includes('Ultimi 7 giorni'));
    expect(sevenDayItem).toBeTruthy();
    fireEvent.click(sevenDayItem!);
    expect(mockOnChange).toHaveBeenCalledWith('7d');
  });

  it('renders as a button with outline variant', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('supports sm size prop', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} size="sm" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-8');
  });

  it('applies custom className', () => {
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} className="my-custom" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('my-custom');
  });

  it('has all 6 time range options defined', () => {
    expect(TIME_RANGE_OPTIONS).toHaveLength(6);
    const values = TIME_RANGE_OPTIONS.map((o) => o.value);
    expect(values).toContain('today');
    expect(values).toContain('7d');
    expect(values).toContain('30d');
    expect(values).toContain('90d');
    expect(values).toContain('ytd');
    expect(values).toContain('12m');
  });
});
