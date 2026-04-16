import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with correct text content', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders as a button element by default', () => {
    const { container } = render(<Button>Test</Button>);
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('applies default variant classes (bg-primary)', () => {
    const { container } = render(<Button>Default</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-primary-foreground');
  });

  it('applies destructive variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-destructive');
    expect(button).toHaveClass('text-destructive-foreground');
  });

  it('applies outline variant classes', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('border-input');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-secondary');
  });

  it('applies ghost variant classes', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const button = container.querySelector('button');
    expect(button).not.toHaveClass('bg-primary');
    expect(button).not.toHaveClass('bg-secondary');
  });

  it('applies link variant classes', () => {
    const { container } = render(<Button variant="link">Link</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('text-primary');
    expect(button).toHaveClass('underline-offset-4');
  });

  it('applies default size classes (h-9)', () => {
    const { container } = render(<Button>Default Size</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('h-9');
    expect(button).toHaveClass('px-4');
  });

  it('applies sm size classes (h-8)', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('h-8');
    expect(button).toHaveClass('px-3');
  });

  it('applies lg size classes (h-10)', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('px-8');
  });

  it('applies icon size classes (h-9 w-9)', () => {
    const { container } = render(<Button size="icon">X</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('h-9');
    expect(button).toHaveClass('w-9');
  });

  it('forwards onClick handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders as child element when asChild is true', () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    );
    expect(container.querySelector('a')).toBeInTheDocument();
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });

  it('forwards custom className', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('custom-class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('forwards type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
