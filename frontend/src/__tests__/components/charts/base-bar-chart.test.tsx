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
  BarChart: ({ children, data, layout }: any) => (
    <div data-testid="bar-chart" data-layout={layout} data-points={data?.length}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, name, fill, stackId }: any) => (
    <div data-testid={`bar-${dataKey}`} data-name={name} data-fill={fill} data-stack={stackId} />
  ),
  XAxis: ({ dataKey, label }: any) => (
    <div data-testid="x-axis" data-key={dataKey} data-label={label?.value} />
  ),
  YAxis: ({ label }: any) => <div data-testid="y-axis" data-label={label?.value} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
  ReferenceLine: ({ label, y, x }: any) => (
    <div data-testid="reference-line" data-label={label?.value} data-y={y} data-x={x} />
  ),
}));

import { BaseBarChart } from '@/components/charts/base-bar-chart';

describe('BaseBarChart', () => {
  const sampleData = [
    { month: 'Gen', value: 100, extra: 50 },
    { month: 'Feb', value: 200, extra: 80 },
    { month: 'Mar', value: 150, extra: 60 },
  ];

  const singleBar = [{ dataKey: 'value', name: 'Valore' }];
  const multiBars = [
    { dataKey: 'value', name: 'Valore' },
    { dataKey: 'extra', name: 'Extra' },
  ];

  it('renders a bar chart container with correct aria-label', () => {
    render(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Grafico a barre: Valore');
  });

  it('includes all bar names in the aria-label', () => {
    render(<BaseBarChart data={sampleData} bars={multiBars} xAxisKey="month" />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Grafico a barre: Valore, Extra');
  });

  it('renders ResponsiveContainer and BarChart', () => {
    render(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders a Bar element for each bar config', () => {
    render(<BaseBarChart data={sampleData} bars={multiBars} xAxisKey="month" />);
    expect(screen.getByTestId('bar-value')).toBeInTheDocument();
    expect(screen.getByTestId('bar-extra')).toBeInTheDocument();
  });

  it('shows grid by default and hides when showGrid=false', () => {
    const { rerender } = render(
      <BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />
    );
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();

    rerender(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" showGrid={false} />);
    expect(screen.queryByTestId('cartesian-grid')).not.toBeInTheDocument();
  });

  it('shows tooltip by default and hides when showTooltip=false', () => {
    const { rerender } = render(
      <BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />
    );
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    rerender(
      <BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" showTooltip={false} />
    );
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows legend only when there are multiple bars', () => {
    const { rerender } = render(
      <BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />
    );
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();

    rerender(<BaseBarChart data={sampleData} bars={multiBars} xAxisKey="month" />);
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('hides legend when showLegend=false even with multiple bars', () => {
    render(<BaseBarChart data={sampleData} bars={multiBars} xAxisKey="month" showLegend={false} />);
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });

  it('renders reference lines when provided', () => {
    const referenceLines = [
      { value: 150, label: 'Target', color: '#ff0000' },
      { value: 200, label: 'Massimo' },
    ];
    render(
      <BaseBarChart
        data={sampleData}
        bars={singleBar}
        xAxisKey="month"
        referenceLines={referenceLines}
      />
    );
    const refLines = screen.getAllByTestId('reference-line');
    expect(refLines).toHaveLength(2);
    expect(refLines[0]).toHaveAttribute('data-label', 'Target');
    expect(refLines[1]).toHaveAttribute('data-label', 'Massimo');
  });

  it('passes layout prop to BarChart for vertical layout', () => {
    render(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" layout="vertical" />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-layout', 'vertical');
  });

  it('defaults to horizontal layout', () => {
    render(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-layout', 'horizontal');
  });

  it('handles empty data array gracefully', () => {
    render(<BaseBarChart data={[]} bars={singleBar} xAxisKey="month" />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-points', '0');
  });

  it('applies custom bar color from config', () => {
    const barsWithColor = [{ dataKey: 'value', name: 'Valore', color: '#ff00ff' }];
    render(<BaseBarChart data={sampleData} bars={barsWithColor} xAxisKey="month" />);
    expect(screen.getByTestId('bar-value')).toHaveAttribute('data-fill', '#ff00ff');
  });

  it('uses palette color when no custom color is provided', () => {
    render(<BaseBarChart data={sampleData} bars={singleBar} xAxisKey="month" />);
    expect(screen.getByTestId('bar-value')).toHaveAttribute('data-fill', '#3b82f6');
  });

  it('supports stacked bars via stackId', () => {
    const stackedBars = [
      { dataKey: 'value', name: 'Valore', stackId: 'a' },
      { dataKey: 'extra', name: 'Extra', stackId: 'a' },
    ];
    render(<BaseBarChart data={sampleData} bars={stackedBars} xAxisKey="month" />);
    expect(screen.getByTestId('bar-value')).toHaveAttribute('data-stack', 'a');
    expect(screen.getByTestId('bar-extra')).toHaveAttribute('data-stack', 'a');
  });
});
