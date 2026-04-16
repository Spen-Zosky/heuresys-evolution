import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ApiError, LoadingSkeleton, EmptyState } from '@/components/ui/api-error';

describe('ApiError', () => {
  it('renders default variant with correct title and message', () => {
    render(<ApiError />);
    expect(screen.getByText('API/Dati Non Disponibili')).toBeInTheDocument();
    expect(
      screen.getByText('Impossibile caricare i dati. Verifica la connessione e riprova.')
    ).toBeInTheDocument();
  });

  it('renders network variant with correct title and message', () => {
    render(<ApiError variant="network" />);
    expect(screen.getByText('Errore di Connessione')).toBeInTheDocument();
    expect(
      screen.getByText('Impossibile connettersi al server. Verifica la tua connessione internet.')
    ).toBeInTheDocument();
  });

  it('renders auth variant with correct title and message', () => {
    render(<ApiError variant="auth" />);
    expect(screen.getByText('Sessione Scaduta')).toBeInTheDocument();
  });

  it('renders notFound variant with correct title and message', () => {
    render(<ApiError variant="notFound" />);
    expect(screen.getByText('Risorsa Non Trovata')).toBeInTheDocument();
  });

  it('renders forbidden variant with correct title and message', () => {
    render(<ApiError variant="forbidden" />);
    expect(screen.getByText('Accesso Negato')).toBeInTheDocument();
  });

  it('uses custom title when provided', () => {
    render(<ApiError title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('uses custom message when provided', () => {
    render(<ApiError message="Custom error message" />);
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('renders retry button by default when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ApiError onRetry={onRetry} />);
    const retryButton = screen.getByRole('button', { name: /riprova/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ApiError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /riprova/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides retry button when showRetry is false', () => {
    const onRetry = vi.fn();
    render(<ApiError onRetry={onRetry} showRetry={false} />);
    expect(screen.queryByRole('button', { name: /riprova/i })).not.toBeInTheDocument();
  });

  it('does not render retry button without onRetry callback', () => {
    render(<ApiError />);
    expect(screen.queryByRole('button', { name: /riprova/i })).not.toBeInTheDocument();
  });

  it('renders compact mode with inline layout', () => {
    const { container } = render(<ApiError compact onRetry={() => {}} />);
    // Compact uses flex items-center gap-2 at the top level
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('items-center');
  });

  it('applies custom className', () => {
    const { container } = render(<ApiError className="my-error-class" />);
    // In non-compact mode, className goes on the Card
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('my-error-class');
  });
});

describe('LoadingSkeleton', () => {
  it('renders default 3 rows', () => {
    const { container } = render(<LoadingSkeleton />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBe(6); // 3 rows * 2 pulse elements each
  });

  it('renders specified number of rows', () => {
    const { container } = render(<LoadingSkeleton rows={5} />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBe(10); // 5 rows * 2 pulse elements each
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});

describe('EmptyState (from api-error)', () => {
  it('renders default title and message', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nessun dato')).toBeInTheDocument();
    expect(screen.getByText('Non ci sono dati da visualizzare.')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<EmptyState title="No Items" message="Nothing to show" />);
    expect(screen.getByText('No Items')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState icon={<span data-testid="custom-icon">Icon</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState action={<button>Add Item</button>} />);
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState className="custom-empty" />);
    // className goes on the Card
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-empty');
  });
});
