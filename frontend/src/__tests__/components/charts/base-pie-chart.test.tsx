import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/lib/chart-theme', () => ({
  getChartPalette: () => ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'],
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, innerRadius, label }: any) => (
    <div
      data-testid="pie"
      data-items={data?.length}
      data-inner-radius={innerRadius}
      data-has-label={!!label}
    >
      {data?.map((_: any, i: number) => (
        <div key={i} data-testid={`pie-item-${i}`} />
      ))}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

import { BasePieChart } from '@/components/charts/base-pie-chart';

describe('BasePieChart', () => {
  const sampleData = [
    { name: 'HR', value: 30 },
    { name: 'Engineering', value: 50 },
    { name: 'Sales', value: 20 },
  ];

  it('renders with accessible aria-label listing data items', () => {
    render(<BasePieChart data={sampleData} />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', expect.stringContaining('HR: 30'));
    expect(container).toHaveAttribute('aria-label', expect.stringContaining('Engineering: 50'));
    expect(container).toHaveAttribute('aria-label', expect.stringContaining('Sales: 20'));
  });

  it('truncates aria-label to 5 items with ellipsis for large datasets', () => {
    const largeData = Array.from({ length: 8 }, (_, i) => ({ name: `Item ${i}`, value: i * 10 }));
    render(<BasePieChart data={largeData} />);
    const container = screen.getByRole('img');
    expect(container.getAttribute('aria-label')).toContain('...');
  });

  it('renders PieChart and Pie components', () => {
    render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
  });

  it('passes data length to Pie', () => {
    render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-items', '3');
  });

  it('shows tooltip by default and hides when showTooltip=false', () => {
    const { rerender } = render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    rerender(<BasePieChart data={sampleData} showTooltip={false} />);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows legend by default and hides when showLegend=false', () => {
    const { rerender } = render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    rerender(<BasePieChart data={sampleData} showLegend={false} />);
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });

  it('enables labels when showLabels=true', () => {
    const { rerender } = render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-has-label', 'false');

    rerender(<BasePieChart data={sampleData} showLabels={true} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-has-label', 'true');
  });

  it('renders with innerRadius for donut variant', () => {
    render(<BasePieChart data={sampleData} innerRadius={60} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-inner-radius', '60');
  });

  it('defaults innerRadius to 0 (full pie)', () => {
    render(<BasePieChart data={sampleData} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-inner-radius', '0');
  });

  it('handles empty data gracefully', () => {
    render(<BasePieChart data={[]} />);
    expect(screen.getByTestId('pie')).toHaveAttribute('data-items', '0');
  });
});
