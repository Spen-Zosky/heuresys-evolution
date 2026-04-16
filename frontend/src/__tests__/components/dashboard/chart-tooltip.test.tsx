import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ChartTooltip, BarChartWithTooltips } from '@/components/dashboard/chart-tooltip';

describe('ChartTooltip', () => {
  const baseData = { label: 'Dipendenti', value: 250 };

  it('renders children (trigger element)', () => {
    render(
      <ChartTooltip data={baseData}>
        <button>Hover me</button>
      </ChartTooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    render(
      <ChartTooltip data={baseData} className="custom-class">
        <button>Trigger</button>
      </ChartTooltip>
    );
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  it('renders with all data props without crashing', () => {
    const fullData = {
      label: 'Organico',
      value: 300,
      total: 500,
      previousValue: 280,
      unit: 'pers.',
      formatValue: (v: number) => `${v} persone`,
    };
    render(
      <ChartTooltip data={fullData}>
        <span>Full Tooltip</span>
      </ChartTooltip>
    );
    expect(screen.getByText('Full Tooltip')).toBeInTheDocument();
  });

  it('renders with different side values', () => {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    sides.forEach((side) => {
      const { unmount } = render(
        <ChartTooltip data={baseData} side={side}>
          <button>Side {side}</button>
        </ChartTooltip>
      );
      expect(screen.getByText(`Side ${side}`)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('BarChartWithTooltips', () => {
  const items = [
    { label: 'HR', value: 30, previousValue: 25 },
    { label: 'IT', value: 50, previousValue: 45 },
    { label: 'Sales', value: 20, previousValue: 22 },
  ];

  it('renders children for each item', () => {
    render(
      <BarChartWithTooltips items={items}>
        {({ item, index }) => <div key={index}>Bar: {item.label}</div>}
      </BarChartWithTooltips>
    );
    expect(screen.getByText('Bar: HR')).toBeInTheDocument();
    expect(screen.getByText('Bar: IT')).toBeInTheDocument();
    expect(screen.getByText('Bar: Sales')).toBeInTheDocument();
  });

  it('passes correct index to children', () => {
    render(
      <BarChartWithTooltips items={items}>
        {({ item, index }) => (
          <div key={index}>
            Index {index}: {item.label}
          </div>
        )}
      </BarChartWithTooltips>
    );
    expect(screen.getByText('Index 0: HR')).toBeInTheDocument();
    expect(screen.getByText('Index 1: IT')).toBeInTheDocument();
    expect(screen.getByText('Index 2: Sales')).toBeInTheDocument();
  });

  it('computes total from all item values', () => {
    render(
      <BarChartWithTooltips items={items}>
        {({ item, index, total }) => <div key={index}>Total: {total}</div>}
      </BarChartWithTooltips>
    );
    const totalElements = screen.getAllByText('Total: 100');
    expect(totalElements).toHaveLength(3);
  });

  it('provides renderWithTooltip function', () => {
    render(
      <BarChartWithTooltips items={items}>
        {({ item, index, renderWithTooltip }) => (
          <div key={index}>{renderWithTooltip(<span>Wrapped: {item.label}</span>)}</div>
        )}
      </BarChartWithTooltips>
    );
    expect(screen.getByText('Wrapped: HR')).toBeInTheDocument();
    expect(screen.getByText('Wrapped: IT')).toBeInTheDocument();
  });

  it('handles empty items array', () => {
    const { container } = render(
      <BarChartWithTooltips items={[]}>
        {({ item, index }) => <div key={index}>{item.label}</div>}
      </BarChartWithTooltips>
    );
    expect(container.textContent).toBe('');
  });
});
