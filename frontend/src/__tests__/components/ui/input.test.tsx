import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-input');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text..." />);
    expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders with type="password"', () => {
    const { container } = render(<Input type="password" />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders with type="email"', () => {
    const { container } = render(<Input type="email" />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders with value', () => {
    render(<Input value="test value" readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('test value');
  });

  it('passes additional HTML attributes', () => {
    render(<Input data-testid="my-input" aria-label="search" />);
    const input = screen.getByTestId('my-input');
    expect(input).toHaveAttribute('aria-label', 'search');
  });

  it('renders with required attribute', () => {
    render(<Input required aria-label="required field" />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('renders with readOnly attribute', () => {
    render(<Input readOnly value="readonly" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });
});
