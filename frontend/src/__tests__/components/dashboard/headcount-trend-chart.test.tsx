import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data, onClick }: any) => (
    <div data-testid="area-chart" data-points={data?.length} onClick={() => onClick?.({})}>
      {children}
    </div>
  ),
  Area: ({ dataKey }: any) => <div data-testid={`area-${dataKey}`} />,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

vi.mock('@/components/dashboard/chart-export', () => ({
  ChartExportButton: ({ title }: any) => <button data-testid="export-btn">{title}</button>,
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

import { HeadcountTrendChart } from '@/components/dashboard/headcount-trend-chart';

describe('HeadcountTrendChart', () => {
  const sampleData = [
    { date: '2025-01-01', value: 250 },
    { date: '2025-02-01', value: 260 },
    { date: '2025-03-01', value: 270 },
  ];

  it('renders card with title and description', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    // Title appears in CardTitle and also as export button text, so use getAllByText
    const titles = screen.getAllByText('Trend Organico');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Evoluzione headcount ultimi 12 mesi')).toBeInTheDocument();
  });

  it('renders chart when data is provided', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('area-value')).toBeInTheDocument();
  });

  it('shows empty state when data is empty', () => {
    render(<HeadcountTrendChart data={[]} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Dati trend non disponibili')).toBeInTheDocument();
  });

  it('shows empty state when data is undefined', () => {
    render(<HeadcountTrendChart data={undefined} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders export button when data is present', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
  });

  it('does not render export button when data is empty', () => {
    render(<HeadcountTrendChart data={[]} />);
    expect(screen.queryByTestId('export-btn')).not.toBeInTheDocument();
  });

  it('renders X and Y axes', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });

  it('renders CartesianGrid for reference lines', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
  });

  it('applies custom className to the Card', () => {
    const { container } = render(
      <HeadcountTrendChart data={sampleData} className="custom-chart" />
    );
    const cardWithClass = container.querySelector('.custom-chart');
    expect(cardWithClass).toBeInTheDocument();
  });

  it('transforms data points to chart data format', () => {
    render(<HeadcountTrendChart data={sampleData} />);
    // Chart is rendered with transformed data
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '3');
  });
});
