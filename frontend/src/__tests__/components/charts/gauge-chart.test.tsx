import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/lib/chart-theme', () => ({
  getChartColors: () => ({
    destructive: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
  }),
}));

const mockSetOption = vi.fn();
vi.mock('echarts-for-react', () => ({
  default: ({ option, style }: any) => (
    <div
      data-testid="echarts"
      data-value={option?.series?.[0]?.data?.[0]?.value}
      data-name={option?.series?.[0]?.data?.[0]?.name}
      data-min={option?.series?.[0]?.min}
      data-max={option?.series?.[0]?.max}
      data-pointer={option?.series?.[0]?.pointer?.show !== false ? 'true' : 'false'}
      style={style}
    />
  ),
}));

import { GaugeChart } from '@/components/charts/gauge-chart';

describe('GaugeChart', () => {
  it('renders with accessible aria-label showing value', () => {
    render(<GaugeChart value={75} />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Indicatore: 75');
  });

  it('includes title in aria-label when provided', () => {
    render(<GaugeChart value={85} title="Completamento" />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Indicatore Completamento: 85');
  });

  it('includes unit in aria-label when provided', () => {
    render(<GaugeChart value={75} unit="%" />);
    const container = screen.getByRole('img');
    expect(container).toHaveAttribute('aria-label', 'Indicatore: 75%');
  });

  it('renders ECharts component with correct value', () => {
    render(<GaugeChart value={60} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-value', '60');
  });

  it('uses default min=0 and max=100', () => {
    render(<GaugeChart value={50} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-min', '0');
    expect(chart).toHaveAttribute('data-max', '100');
  });

  it('accepts custom min and max values', () => {
    render(<GaugeChart value={50} min={10} max={200} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-min', '10');
    expect(chart).toHaveAttribute('data-max', '200');
  });

  it('passes title as series data name', () => {
    render(<GaugeChart value={75} title="Performance" />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-name', 'Performance');
  });

  it('shows pointer by default', () => {
    render(<GaugeChart value={75} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-pointer', 'true');
  });

  it('hides pointer when showPointer=false', () => {
    render(<GaugeChart value={75} showPointer={false} />);
    const chart = screen.getByTestId('echarts');
    expect(chart).toHaveAttribute('data-pointer', 'false');
  });

  it('applies custom height via style', () => {
    render(<GaugeChart value={50} height={400} />);
    const chart = screen.getByTestId('echarts');
    expect(chart.style.height).toBe('400px');
  });

  it('defaults height to 200px', () => {
    render(<GaugeChart value={50} />);
    const chart = screen.getByTestId('echarts');
    expect(chart.style.height).toBe('200px');
  });
});
