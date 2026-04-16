import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<Alert>Alert message here</Alert>);
    expect(screen.getByText('Alert message here')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Alert>Default</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-background');
    expect(alert).toHaveClass('text-foreground');
  });

  it('applies destructive variant classes', () => {
    render(<Alert variant="destructive">Error</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('text-destructive');
  });

  it('forwards custom className', () => {
    render(<Alert className="my-custom-alert">Content</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('my-custom-alert');
  });

  it('forwards ref to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Alert ref={ref}>Content</Alert>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('role')).toBe('alert');
  });
});

describe('AlertTitle', () => {
  it('renders as an h5 element', () => {
    const { container } = render(<AlertTitle>Warning Title</AlertTitle>);
    const h5 = container.querySelector('h5');
    expect(h5).toBeInTheDocument();
    expect(h5).toHaveTextContent('Warning Title');
  });

  it('applies default classes for font/tracking', () => {
    const { container } = render(<AlertTitle>Title</AlertTitle>);
    const h5 = container.querySelector('h5');
    expect(h5).toHaveClass('font-medium');
    expect(h5).toHaveClass('leading-none');
    expect(h5).toHaveClass('tracking-tight');
  });

  it('merges custom className', () => {
    const { container } = render(<AlertTitle className="custom-title">Title</AlertTitle>);
    const h5 = container.querySelector('h5');
    expect(h5).toHaveClass('custom-title');
  });
});

describe('AlertDescription', () => {
  it('renders as a div element', () => {
    const { container } = render(<AlertDescription>Description text</AlertDescription>);
    const div = container.querySelector('div');
    expect(div).toHaveTextContent('Description text');
  });

  it('applies text-sm class', () => {
    const { container } = render(<AlertDescription>Desc</AlertDescription>);
    const div = container.querySelector('div');
    expect(div).toHaveClass('text-sm');
  });

  it('merges custom className', () => {
    const { container } = render(<AlertDescription className="desc-class">Desc</AlertDescription>);
    const div = container.querySelector('div');
    expect(div).toHaveClass('desc-class');
  });
});

describe('Alert composition', () => {
  it('renders title and description together inside alert', () => {
    render(
      <Alert>
        <AlertTitle>Error Occurred</AlertTitle>
        <AlertDescription>Please try again later.</AlertDescription>
      </Alert>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error Occurred');
    expect(alert).toHaveTextContent('Please try again later.');
  });
});
