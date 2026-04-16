import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/lib/chart-theme', () => ({
  getChartPalette: () => ['#3b82f6', '#ef4444', '#22c55e'],
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children, data }: any) => (
    <div data-testid="radar-chart" data-points={data?.length}>
      {children}
    </div>
  ),
  Radar: ({ dataKey, name }: any) => <div data-testid={`radar-${dataKey}`} data-name={name} />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: ({ dataKey }: any) => <div data-testid="polar-angle-axis" data-key={dataKey} />,
  PolarRadiusAxis: ({ domain }: any) => (
    <div data-testid="polar-radius-axis" data-domain={JSON.stringify(domain)} />
  ),
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

import { BaseRadarChart } from '@/components/charts/base-radar-chart';

describe('BaseRadarChart', () => {
  const sampleData = [
    { skill: 'TypeScript', current: 80, target: 90 },
    { skill: 'React', current: 75, target: 85 },
    { skill: 'Node.js', current: 70, target: 80 },
    { skill: 'SQL', current: 60, target: 75 },
  ];

  const singleSeries = [{ dataKey: 'current', name: 'Attuale' }];
  const multiSeries = [
    { dataKey: 'current', name: 'Attuale' },
    { dataKey: 'target', name: 'Target' },
  ];

  it('renders with accessible aria-label containing series names', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={multiSeries} />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Grafico radar: Attuale, Target');
  });

  it('renders RadarChart and PolarGrid', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />);
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('polar-grid')).toBeInTheDocument();
  });

  it('renders a Radar element for each series config', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={multiSeries} />);
    expect(screen.getByTestId('radar-current')).toBeInTheDocument();
    expect(screen.getByTestId('radar-target')).toBeInTheDocument();
  });

  it('renders single series correctly', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />);
    expect(screen.getByTestId('radar-current')).toHaveAttribute('data-name', 'Attuale');
    expect(screen.queryByTestId('radar-target')).not.toBeInTheDocument();
  });

  it('passes dataKey to PolarAngleAxis', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />);
    expect(screen.getByTestId('polar-angle-axis')).toHaveAttribute('data-key', 'skill');
  });

  it('uses default domain [0, 100]', () => {
    render(<BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />);
    expect(screen.getByTestId('polar-radius-axis')).toHaveAttribute('data-domain', '[0,100]');
  });

  it('accepts custom domain', () => {
    render(
      <BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} domain={[0, 50]} />
    );
    expect(screen.getByTestId('polar-radius-axis')).toHaveAttribute('data-domain', '[0,50]');
  });

  it('shows tooltip by default and hides when showTooltip=false', () => {
    const { rerender } = render(
      <BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />
    );
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    rerender(
      <BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} showTooltip={false} />
    );
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows legend by default and hides when showLegend=false', () => {
    const { rerender } = render(
      <BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} />
    );
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    rerender(
      <BaseRadarChart data={sampleData} dataKey="skill" series={singleSeries} showLegend={false} />
    );
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<BaseRadarChart data={[]} dataKey="skill" series={singleSeries} />);
    expect(screen.getByTestId('radar-chart')).toHaveAttribute('data-points', '0');
  });
});
