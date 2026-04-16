import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Helper: a component that throws on render
// ---------------------------------------------------------------------------
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div>Child rendered successfully</div>;
}

// ---------------------------------------------------------------------------
// Suppress console.error for expected boundary errors
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------
describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('displays default fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows the error message in the default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test render error')).toBeInTheDocument();
  });

  it('has aria-live="assertive" on the alert container', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders a "Try again" button in the default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('resets error state when "Try again" is clicked', () => {
    // We need a component that can toggle its throw behaviour.
    // On first render it throws, after reset it should not throw.
    let shouldThrow = true;

    function ConditionalThrow() {
      if (shouldThrow) {
        throw new Error('Conditional error');
      }
      return <div>Recovered content</div>;
    }

    const { getByText } = render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    // Verify we are in error state
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Flip the flag so next render succeeds
    shouldThrow = false;

    // Click "Try again"
    fireEvent.click(getByText('Try again'));

    // After reset, the child should render successfully
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error page</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error page')).toBeInTheDocument();
    // Default fallback should NOT be present
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('calls componentDidCatch with error info', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    // componentDidCatch logs via console.error('ErrorBoundary:', error, info)
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls.find((args) => args[0] === 'ErrorBoundary:');
    expect(callArgs).toBeDefined();
    // Second argument is the Error object
    expect(callArgs![1]).toBeInstanceOf(Error);
    expect((callArgs![1] as Error).message).toBe('Test render error');
  });

  it('does not show error UI when children render normally', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child rendered successfully')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
