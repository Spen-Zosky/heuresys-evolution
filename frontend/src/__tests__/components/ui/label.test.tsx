import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Label } from '@/components/ui/label';

describe('Label', () => {
  it('renders with text content', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders as a label element', () => {
    render(<Label>Email</Label>);
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
  });

  it('applies custom className', () => {
    render(<Label className="custom-label">Test</Label>);
    expect(screen.getByText('Test')).toHaveClass('custom-label');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Ref Test</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('associates with input via htmlFor', () => {
    render(
      <div>
        <Label htmlFor="my-input">Name</Label>
        <input id="my-input" />
      </div>
    );
    const label = screen.getByText('Name');
    expect(label).toHaveAttribute('for', 'my-input');
  });

  it('has default styling classes', () => {
    render(<Label>Styled</Label>);
    const label = screen.getByText('Styled');
    expect(label).toHaveClass('text-sm');
    expect(label).toHaveClass('font-medium');
  });

  it('renders children elements', () => {
    render(
      <Label>
        <span>Complex</span> Label
      </Label>
    );
    expect(screen.getByText('Complex')).toBeInTheDocument();
  });
});
