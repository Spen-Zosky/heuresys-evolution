import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock framer-motion before importing the component
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, transition, variants, whileHover, whileTap, ...domProps } = props;
      return (
        <div ref={ref} {...domProps}>
          {children}
        </div>
      );
    }),
    span: React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, transition, ...domProps } = props;
      return (
        <span ref={ref} {...domProps}>
          {children}
        </span>
      );
    }),
    polygon: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, transition, ...domProps } = props;
      return <polygon ref={ref} {...domProps} />;
    }),
    polyline: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, transition, pathLength, ...domProps } = props;
      return <polyline ref={ref} {...domProps} />;
    }),
    circle: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, transition, ...domProps } = props;
      return <circle ref={ref} {...domProps} />;
    }),
  },
  useMotionValue: () => ({ get: () => 0, set: vi.fn(), on: vi.fn() }),
  useTransform: () => ({ get: () => '0' }),
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

import { KPICard, KPIGrid } from '@/components/ui/kpi-card';

describe('KPICard', () => {
  it('renders title', () => {
    render(<KPICard title="Total Employees" value={267} />);
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
  });

  it('renders loading state with skeleton', () => {
    const { container } = render(<KPICard title="Test" value={100} loading />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders change indicator for upward trend', () => {
    render(<KPICard title="Growth" value={120} change={15.5} trend="up" />);
    expect(screen.getByText('+15.5%')).toBeInTheDocument();
    expect(screen.getByText('vs last period')).toBeInTheDocument();
  });

  it('renders change indicator for downward trend', () => {
    render(<KPICard title="Attrition" value={5} change={-3.2} trend="down" />);
    expect(screen.getByText('-3.2%')).toBeInTheDocument();
  });

  it('renders flat trend indicator', () => {
    render(<KPICard title="Stable" value={50} change={0.1} trend="flat" />);
    expect(screen.getByText('+0.1%')).toBeInTheDocument();
  });

  it('renders custom period label', () => {
    render(<KPICard title="Test" value={100} change={5} trend="up" periodLabel="vs last month" />);
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<KPICard title="Test" value={10} className="custom-kpi" />);
    expect(container.querySelector('.custom-kpi')).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    const { container } = render(
      <KPICard title="Test" value={100} sparklineData={[10, 20, 30, 40, 50]} trend="up" />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render sparkline with insufficient data', () => {
    const { container } = render(<KPICard title="Test" value={100} sparklineData={[10]} />);
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
  });

  it('calculates change from previous value', () => {
    render(<KPICard title="Test" value={120} previousValue={100} />);
    expect(screen.getByText('+20.0%')).toBeInTheDocument();
  });

  it('does not render change when no change data', () => {
    const { container } = render(<KPICard title="Simple" value={42} />);
    expect(screen.queryByText('vs last period')).not.toBeInTheDocument();
  });
});

describe('KPIGrid', () => {
  it('renders children', () => {
    render(
      <KPIGrid>
        <div>Card 1</div>
        <div>Card 2</div>
      </KPIGrid>
    );
    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Card 2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <KPIGrid className="grid-custom">
        <div>Child</div>
      </KPIGrid>
    );
    expect(container.firstChild).toHaveClass('grid-custom');
  });

  it('renders with grid layout classes', () => {
    const { container } = render(
      <KPIGrid columns={3}>
        <div>A</div>
      </KPIGrid>
    );
    expect(container.firstChild).toHaveClass('grid');
  });
});
