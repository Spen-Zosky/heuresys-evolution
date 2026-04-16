import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/lib/chart-theme', () => ({
  getChartColors: () => ({
    warning: '#f59e0b',
    destructive: '#ef4444',
  }),
}));

vi.mock('echarts-for-react', () => ({
  default: ({ option, style }: any) => (
    <div
      data-testid="echarts"
      data-title={option?.title?.text || ''}
      data-x-categories={JSON.stringify(option?.xAxis?.data)}
      data-y-categories={JSON.stringify(option?.yAxis?.data)}
      data-series-type={option?.series?.[0]?.type}
      data-data-count={option?.series?.[0]?.data?.length}
      data-x-label={option?.xAxis?.name || ''}
      data-y-label={option?.yAxis?.name || ''}
      style={style}
    />
  ),
}));

import { HeatmapChart } from '@/components/charts/heatmap-chart';

describe('HeatmapChart', () => {
  const sampleData = [
    { x: 'Lun', y: 'AM', value: 5 },
    { x: 'Lun', y: 'PM', value: 8 },
    { x: 'Mar', y: 'AM', value: 3 },
    { x: 'Mar', y: 'PM', value: 6 },
  ];
  const xCategories = ['Lun', 'Mar'];
  const yCategories = ['AM', 'PM'];

  it('renders with accessible aria-label describing dimensions', () => {
    render(<HeatmapChart data={sampleData} xCategories={xCategories} yCategories={yCategories} />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Heatmap con 2 colonne e 2 righe');
  });

  it('uses title in aria-label when provided', () => {
    render(
      <HeatmapChart
        data={sampleData}
        xCategories={xCategories}
        yCategories={yCategories}
        title="Presenze"
      />
    );
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Heatmap: Presenze');
  });

  it('renders ECharts with heatmap series type', () => {
    render(<HeatmapChart data={sampleData} xCategories={xCategories} yCategories={yCategories} />);
    expect(screen.getByTestId('echarts')).toHaveAttribute('data-series-type', 'heatmap');
  });

  it('passes x and y categories to axes', () => {
    render(<HeatmapChart data={sampleData} xCategories={xCategories} yCategories={yCategories} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-x-categories', JSON.stringify(xCategories));
    expect(chart).toHaveAttribute('data-y-categories', JSON.stringify(yCategories));
  });

  it('passes title to echarts option', () => {
    render(
      <HeatmapChart
        data={sampleData}
        xCategories={xCategories}
        yCategories={yCategories}
        title="Heatmap Test"
      />
    );
    expect(screen.getByTestId('echarts')).toHaveAttribute('data-title', 'Heatmap Test');
  });

  it('renders correct number of data points', () => {
    render(<HeatmapChart data={sampleData} xCategories={xCategories} yCategories={yCategories} />);
    expect(screen.getByTestId('echarts')).toHaveAttribute('data-data-count', '4');
  });

  it('passes axis labels when provided', () => {
    render(
      <HeatmapChart
        data={sampleData}
        xCategories={xCategories}
        yCategories={yCategories}
        xAxisLabel="Giorno"
        yAxisLabel="Fascia"
      />
    );
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-x-label', 'Giorno');
    expect(chart).toHaveAttribute('data-y-label', 'Fascia');
  });

  it('applies custom height via style', () => {
    render(
      <HeatmapChart
        data={sampleData}
        xCategories={xCategories}
        yCategories={yCategories}
        height={500}
      />
    );
    const chart = screen.getByTestId('echarts');
    expect(chart.style.height).toBe('500px');
  });

  it('defaults height to 300px', () => {
    render(<HeatmapChart data={sampleData} xCategories={xCategories} yCategories={yCategories} />);
    expect(screen.getByTestId('echarts').style.height).toBe('300px');
  });

  it('handles empty data array', () => {
    render(<HeatmapChart data={[]} xCategories={['A']} yCategories={['B']} />);
    expect(screen.getByTestId('echarts')).toHaveAttribute('data-data-count', '0');
  });
});
