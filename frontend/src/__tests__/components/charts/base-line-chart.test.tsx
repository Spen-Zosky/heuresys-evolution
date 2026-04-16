import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/lib/chart-theme', () => ({
  getChartPalette: () => ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'],
  getChartColors: () => ({ warning: '#f59e0b', destructive: '#ef4444', success: '#22c55e' }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  ComposedChart: ({ children, data }: any) => (
    <div data-testid="composed-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name, strokeDasharray }: any) => (
    <div data-testid={`line-${dataKey}`} data-name={name} data-dashed={strokeDasharray || ''} />
  ),
  Area: ({ dataKey, name }: any) => <div data-testid={`area-${dataKey}`} data-name={name} />,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: ({ label, y }: any) => (
    <div data-testid="reference-line" data-label={label?.value} data-y={y} />
  ),
}));

import { BaseLineChart } from '@/components/charts/base-line-chart';

describe('BaseLineChart', () => {
  const sampleData = [
    { month: 'Gen', revenue: 1000, cost: 800 },
    { month: 'Feb', revenue: 1200, cost: 900 },
    { month: 'Mar', revenue: 1500, cost: 950 },
  ];

  const singleLine = [{ dataKey: 'revenue', name: 'Ricavi' }];
  const multiLines = [
    { dataKey: 'revenue', name: 'Ricavi' },
    { dataKey: 'cost', name: 'Costi' },
  ];

  it('renders with correct aria-label containing line names', () => {
    render(<BaseLineChart data={sampleData} lines={multiLines} xAxisKey="month" />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Grafico lineare: Ricavi, Costi');
  });

  it('uses LineChart when no lines have areaFill', () => {
    render(<BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument();
  });

  it('uses ComposedChart when any line has areaFill=true', () => {
    const linesWithArea = [{ dataKey: 'revenue', name: 'Ricavi', areaFill: true }];
    render(<BaseLineChart data={sampleData} lines={linesWithArea} xAxisKey="month" />);
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders Area component for lines with areaFill', () => {
    const linesWithArea = [{ dataKey: 'revenue', name: 'Ricavi', areaFill: true }];
    render(<BaseLineChart data={sampleData} lines={linesWithArea} xAxisKey="month" />);
    expect(screen.getByTestId('area-revenue')).toBeInTheDocument();
  });

  it('renders Line component for regular lines', () => {
    render(<BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />);
    expect(screen.getByTestId('line-revenue')).toBeInTheDocument();
  });

  it('renders multiple Line elements for multiple line configs', () => {
    render(<BaseLineChart data={sampleData} lines={multiLines} xAxisKey="month" />);
    expect(screen.getByTestId('line-revenue')).toBeInTheDocument();
    expect(screen.getByTestId('line-cost')).toBeInTheDocument();
  });

  it('shows grid by default and hides when showGrid=false', () => {
    const { rerender } = render(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />
    );
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();

    rerender(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" showGrid={false} />
    );
    expect(screen.queryByTestId('cartesian-grid')).not.toBeInTheDocument();
  });

  it('shows tooltip by default and hides when showTooltip=false', () => {
    const { rerender } = render(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />
    );
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    rerender(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" showTooltip={false} />
    );
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows legend by default and hides when showLegend=false', () => {
    const { rerender } = render(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />
    );
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    rerender(
      <BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" showLegend={false} />
    );
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });

  it('renders reference lines when provided', () => {
    const referenceLines = [{ value: 1200, label: 'Obiettivo' }];
    render(
      <BaseLineChart
        data={sampleData}
        lines={singleLine}
        xAxisKey="month"
        referenceLines={referenceLines}
      />
    );
    const refLine = screen.getByTestId('reference-line');
    expect(refLine).toHaveAttribute('data-label', 'Obiettivo');
  });

  it('supports dashed lines via dashed config', () => {
    const dashedLines = [{ dataKey: 'revenue', name: 'Ricavi', dashed: true }];
    render(<BaseLineChart data={sampleData} lines={dashedLines} xAxisKey="month" />);
    expect(screen.getByTestId('line-revenue')).toHaveAttribute('data-dashed', '5 5');
  });

  it('handles empty data gracefully', () => {
    render(<BaseLineChart data={[]} lines={singleLine} xAxisKey="month" />);
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '0');
  });

  it('passes xAxisKey to XAxis dataKey', () => {
    render(<BaseLineChart data={sampleData} lines={singleLine} xAxisKey="month" />);
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-key', 'month');
  });
});
