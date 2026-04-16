import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

// Helper: render dropdown in open state so we can test content
function renderOpenDropdown(content: React.ReactNode) {
  return render(
    <DropdownMenu open={true}>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>{content}</DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('renders trigger button', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
      </DropdownMenu>
    );
    expect(screen.getByText('Open Menu')).toBeInTheDocument();
  });

  it('trigger has correct ARIA attributes when closed', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      </DropdownMenu>
    );
    const trigger = screen.getByText('Menu');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('trigger has data-state="open" when open', () => {
    render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByText('Menu');
    expect(trigger).toHaveAttribute('data-state', 'open');
  });

  it('renders menu items when open', () => {
    renderOpenDropdown(
      <>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
        <DropdownMenuItem>Item 2</DropdownMenuItem>
      </>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders menu items with role="menuitem"', () => {
    renderOpenDropdown(<DropdownMenuItem>Action</DropdownMenuItem>);
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });

  it('renders label within menu', () => {
    renderOpenDropdown(
      <>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>Profile</DropdownMenuItem>
      </>
    );
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders separator between items', () => {
    renderOpenDropdown(
      <>
        <DropdownMenuItem>Item A</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Item B</DropdownMenuItem>
      </>
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('renders shortcut text within item', () => {
    renderOpenDropdown(
      <DropdownMenuItem>
        Copy
        <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
      </DropdownMenuItem>
    );
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
  });

  it('DropdownMenuShortcut applies custom className and renders as span', () => {
    renderOpenDropdown(
      <DropdownMenuItem>
        <DropdownMenuShortcut className="shortcut-test">K</DropdownMenuShortcut>
      </DropdownMenuItem>
    );
    const shortcut = screen.getByText('K');
    expect(shortcut).toHaveClass('shortcut-test');
    expect(shortcut.tagName).toBe('SPAN');
  });

  it('renders checkbox items', () => {
    renderOpenDropdown(
      <>
        <DropdownMenuCheckboxItem checked={true}>Checked Item</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false}>Unchecked Item</DropdownMenuCheckboxItem>
      </>
    );
    expect(screen.getByText('Checked Item')).toBeInTheDocument();
    expect(screen.getByText('Unchecked Item')).toBeInTheDocument();
  });

  it('checkbox items have correct role', () => {
    renderOpenDropdown(<DropdownMenuCheckboxItem checked={true}>Toggle</DropdownMenuCheckboxItem>);
    expect(screen.getByRole('menuitemcheckbox')).toBeInTheDocument();
  });

  it('renders radio group items', () => {
    renderOpenDropdown(
      <DropdownMenuRadioGroup value="opt1">
        <DropdownMenuRadioItem value="opt1">Option 1</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="opt2">Option 2</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('radio items have correct role', () => {
    renderOpenDropdown(
      <DropdownMenuRadioGroup value="a">
        <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    );
    expect(screen.getByRole('menuitemradio')).toBeInTheDocument();
  });

  it('DropdownMenuGroup renders children', () => {
    renderOpenDropdown(
      <DropdownMenuGroup>
        <DropdownMenuItem>Grouped Item</DropdownMenuItem>
      </DropdownMenuGroup>
    );
    expect(screen.getByText('Grouped Item')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <DropdownMenu open={false}>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Hidden</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
