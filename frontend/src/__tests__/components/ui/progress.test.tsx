import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Progress } from '@/components/ui/progress';

describe('Progress', () => {
  it('renders with role="progressbar"', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with correct indicator position for given value', () => {
    const { container } = render(<Progress value={75} />);
    const indicator = container.querySelector('[style]');
    expect(indicator?.getAttribute('style')).toContain('translateX(-25%)');
  });

  it('renders the progress container with overflow hidden', () => {
    render(<Progress value={30} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveClass('overflow-hidden');
  });

  it('applies custom className', () => {
    render(<Progress value={50} className="custom-progress" />);
    expect(screen.getByRole('progressbar')).toHaveClass('custom-progress');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Progress ref={ref} value={50} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders indicator with correct transform for 0%', () => {
    const { container } = render(<Progress value={0} />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toBeInTheDocument();
    expect(indicator?.getAttribute('style')).toContain('translateX(-100%)');
  });

  it('renders indicator with correct transform for 100%', () => {
    const { container } = render(<Progress value={100} />);
    const indicator = container.querySelector('[style]');
    expect(indicator?.getAttribute('style')).toContain('translateX(-0%)');
  });

  it('renders indicator with correct transform for 50%', () => {
    const { container } = render(<Progress value={50} />);
    const indicator = container.querySelector('[style]');
    expect(indicator?.getAttribute('style')).toContain('translateX(-50%)');
  });

  it('handles undefined value gracefully (renders as 0)', () => {
    render(<Progress />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });
});
