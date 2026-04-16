import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

describe('Checkbox', () => {
  it('renders a checkbox role element', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('is unchecked by default', () => {
    render(<Checkbox />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('toggles checked state when clicked', () => {
    render(<Checkbox />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('can be controlled with checked prop', () => {
    render(<Checkbox checked={true} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('calls onCheckedChange when toggled', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders as disabled when disabled prop is set', () => {
    render(<Checkbox disabled />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('applies disabled styling classes', () => {
    const { container } = render(<Checkbox disabled />);
    const button = container.querySelector('button');
    expect(button).toHaveClass('disabled:cursor-not-allowed');
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('forwards custom className', () => {
    const { container } = render(<Checkbox className="custom-checkbox" />);
    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-checkbox');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies base styling classes', () => {
    const { container } = render(<Checkbox />);
    const button = container.querySelector('button');
    expect(button).toHaveClass('h-4');
    expect(button).toHaveClass('w-4');
    expect(button).toHaveClass('rounded-sm');
    expect(button).toHaveClass('border');
  });
});
