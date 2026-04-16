import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  EmptyState,
  SearchEmptyState,
  TableEmptyState,
  DashboardEmptyState,
  SuccessEmptyState,
} from '@/components/ui/empty-state';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    p: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <p ref={ref} {...props}>
        {children}
      </p>
    )),
  },
}));

describe('EmptyState', () => {
  it('renders default title when no props', () => {
    render(<EmptyState noAnimation />);
    expect(screen.getByText('Nessun dato')).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<EmptyState title="Custom Title" description="Custom description text" noAnimation />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('renders branded message for known type', () => {
    render(<EmptyState type="goals" noAnimation />);
    expect(screen.getByText('Nessun obiettivo definito')).toBeInTheDocument();
    expect(
      screen.getByText('Gli obiettivi aiutano il team a crescere. Crea il primo obiettivo!')
    ).toBeInTheDocument();
  });

  it('renders action button when action provided', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Add Item', onClick }} noAnimation />);
    const button = screen.getByText('Add Item');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action button', () => {
    const onSecondary = vi.fn();
    render(
      <EmptyState
        title="Empty"
        secondaryAction={{ label: 'Learn More', onClick: onSecondary }}
        noAnimation
      />
    );
    const button = screen.getByText('Learn More');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Test" className="custom-empty" noAnimation />);
    expect(container.firstChild).toHaveClass('custom-empty');
  });

  it('renders with animated version by default', () => {
    const { container } = render(<EmptyState title="Animated" />);
    expect(container).toBeTruthy();
    expect(screen.getByText('Animated')).toBeInTheDocument();
  });

  it('renders different size variants', () => {
    const { rerender } = render(<EmptyState title="Small" size="sm" noAnimation />);
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(<EmptyState title="Large" size="lg" noAnimation />);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });
});

describe('SearchEmptyState', () => {
  it('renders with query text', () => {
    render(<SearchEmptyState query="test query" />);
    expect(screen.getByText('Nessun risultato trovato')).toBeInTheDocument();
    expect(screen.getByText(/test query/)).toBeInTheDocument();
  });

  it('renders clear button when onClear provided', () => {
    const onClear = vi.fn();
    render(<SearchEmptyState query="foo" onClear={onClear} />);
    const clearButton = screen.getByText('Cancella ricerca');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render clear button when onClear not provided', () => {
    render(<SearchEmptyState query="bar" />);
    expect(screen.queryByText('Cancella ricerca')).not.toBeInTheDocument();
  });
});

describe('TableEmptyState', () => {
  it('renders with entity name', () => {
    render(<TableEmptyState entityName="dipendente" />);
    expect(screen.getByText('Nessun dipendente')).toBeInTheDocument();
    expect(screen.getByText('Non ci sono dipendente da visualizzare.')).toBeInTheDocument();
  });

  it('renders add button when onAdd provided', () => {
    const onAdd = vi.fn();
    render(<TableEmptyState entityName="corso" onAdd={onAdd} />);
    const addButton = screen.getByText('Aggiungi corso');
    expect(addButton).toBeInTheDocument();
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardEmptyState', () => {
  it('renders branded message for type', () => {
    render(<DashboardEmptyState type="goals" />);
    expect(screen.getByText('Nessun obiettivo definito')).toBeInTheDocument();
  });

  it('renders action button when both onAction and actionLabel provided', () => {
    const onAction = vi.fn();
    render(<DashboardEmptyState type="courses" onAction={onAction} actionLabel="Aggiungi Corso" />);
    const button = screen.getByText('Aggiungi Corso');
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('SuccessEmptyState', () => {
  it('renders default success message', () => {
    render(<SuccessEmptyState />);
    expect(screen.getByText('Tutto sotto controllo')).toBeInTheDocument();
    expect(screen.getByText('Non ci sono elementi che richiedono attenzione.')).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<SuccessEmptyState title="Great!" description="All done." />);
    expect(screen.getByText('Great!')).toBeInTheDocument();
    expect(screen.getByText('All done.')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SuccessEmptyState className="success-custom" />);
    expect(container.firstChild).toHaveClass('success-custom');
  });
});
