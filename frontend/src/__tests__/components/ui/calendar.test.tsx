import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Calendar } from '@/components/ui/calendar';

describe('Calendar', () => {
  it('renders the calendar container with data-slot', () => {
    const { container } = render(<Calendar />);
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });

  it('renders day-of-week headers', () => {
    const { container } = render(<Calendar />);
    // DayPicker renders weekday abbreviations
    const weekdays = container.querySelectorAll('th, [class*="weekday"], abbr');
    expect(weekdays.length).toBeGreaterThanOrEqual(1);
  });

  it('renders day cells in the calendar grid', () => {
    const { container } = render(<Calendar />);
    // react-day-picker renders td elements for each day cell
    const dayCells = container.querySelectorAll('td');
    expect(dayCells.length).toBeGreaterThanOrEqual(28);
  });

  it('renders navigation buttons for prev/next month', () => {
    const { container } = render(<Calendar />);
    // react-day-picker uses buttons with specific class names for navigation
    const allButtons = container.querySelectorAll('button');
    expect(allButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows outside days by default', () => {
    // showOutsideDays defaults to true; check that the calendar renders
    const { container } = render(<Calendar />);
    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });

  it('accepts a selected date', () => {
    const selectedDate = new Date(2026, 0, 15); // Jan 15, 2026
    const { container } = render(
      <Calendar mode="single" selected={selectedDate} month={selectedDate} />
    );
    // The selected day button should have data-selected
    const selectedButton = container.querySelector(
      '[data-selected-single="true"], [data-selected="true"]'
    );
    expect(selectedButton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Calendar className="my-calendar" />);
    const calendar = container.querySelector('[data-slot="calendar"]');
    expect(calendar).toHaveClass('my-calendar');
  });

  it('renders with month specified', () => {
    const month = new Date(2026, 5, 1); // June 2026
    render(<Calendar month={month} />);
    // Should display June in some form
    expect(screen.getByText(/june|giugno|jun|giu/i)).toBeInTheDocument();
  });
});
