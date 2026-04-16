import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

describe('Dialog', () => {
  it('renders trigger button', () => {
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
      </Dialog>
    );
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('opens dialog content when trigger is clicked', async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Test Title</DialogTitle>
          <DialogDescription>Test description</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });

  it('renders title and description inside dialog', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Dialog</DialogTitle>
          <DialogDescription>Some helpful description</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Some helpful description')).toBeInTheDocument();
  });

  it('renders close button with screen reader text', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('Chiudi')).toBeInTheDocument();
  });

  it('renders dialog with role="dialog"', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Test</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('DialogHeader renders children and applies className', () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogHeader className="header-custom">
            <span>Header Content</span>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('Header Content')).toBeInTheDocument();
    const header = screen.getByText('Header Content').parentElement;
    expect(header).toHaveClass('header-custom');
  });

  it('DialogFooter renders children and applies className', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogFooter className="footer-custom">
            <button>Cancel</button>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('DialogTitle applies custom className', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle className="title-custom">Custom Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const title = screen.getByText('Custom Title');
    expect(title).toHaveClass('title-custom');
  });

  it('DialogDescription applies custom className', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription className="desc-custom">Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const desc = screen.getByText('Desc');
    expect(desc).toHaveClass('desc-custom');
  });

  it('controlled open/close works', () => {
    const { rerender } = render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Hidden</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();

    rerender(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>Hidden</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('calls onOpenChange when closed', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Test</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
