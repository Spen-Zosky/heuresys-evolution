import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Footer } from '@/components/layouts/footer';

describe('Footer', () => {
  it('renders with contentinfo role', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('displays system status text', () => {
    render(<Footer />);
    expect(screen.getByText('Sistema operativo')).toBeInTheDocument();
  });

  it('displays version number', () => {
    render(<Footer />);
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
  });

  it('displays copyright with current year', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear} Heuresys`))).toBeInTheDocument();
  });

  it('displays Supporto button', () => {
    render(<Footer />);
    expect(screen.getByText('Supporto')).toBeInTheDocument();
  });

  it('has status indicator with "Sistema operativo" label', () => {
    const { container } = render(<Footer />);
    // The status indicator area is present with the status text
    const statusText = screen.getByText('Sistema operativo');
    expect(statusText.closest('div')).toBeInTheDocument();
  });

  it('opens mailto link when Supporto button is clicked', () => {
    const mockOpen = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(mockOpen);
    render(<Footer />);

    const supportButton = screen.getByText('Supporto');
    fireEvent.click(supportButton);

    expect(mockOpen).toHaveBeenCalledWith('mailto:support@heuresys.com', '_blank');
    vi.restoreAllMocks();
  });

  it('applies custom className when provided', () => {
    render(<Footer className="custom-class" />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.className).toContain('custom-class');
  });

  it('renders status indicator dot', () => {
    const { container } = render(<Footer />);
    // The green circle SVG for status indicator
    const circles = container.querySelectorAll('svg');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('has copyright text with "Tutti i diritti riservati"', () => {
    render(<Footer />);
    expect(screen.getByText(/Tutti i diritti riservati/)).toBeInTheDocument();
  });
});
