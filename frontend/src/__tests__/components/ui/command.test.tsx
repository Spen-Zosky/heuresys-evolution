import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';

// cmdk uses scrollIntoView which jsdom doesn't support
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Command', () => {
  it('renders with children', () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Command className="custom-class">content</Command>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders search input with placeholder', () => {
    render(
      <Command>
        <CommandInput placeholder="Type a command..." />
        <CommandList />
      </Command>
    );
    const input = screen.getByPlaceholderText('Type a command...');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('renders command items within a group', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
  });

  it('renders empty state when no results match', () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('renders CommandShortcut with text', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>
              Settings
              <CommandShortcut>Ctrl+S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
  });

  it('CommandShortcut applies custom className', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>
              <CommandShortcut className="shortcut-test">K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    const shortcut = screen.getByText('K');
    expect(shortcut).toHaveClass('shortcut-test');
    expect(shortcut.tagName).toBe('SPAN');
  });

  it('CommandSeparator renders', () => {
    const { container } = render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>Item 1</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem>Item 2</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    const separator = container.querySelector('[cmdk-separator]');
    expect(separator).toBeInTheDocument();
  });

  it('CommandItem calls onSelect when activated', () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem onSelect={onSelect}>Clickable</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    const item = screen.getByText('Clickable');
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalled();
  });

  it('CommandInput accepts typing', () => {
    render(
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandList />
      </Command>
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test query' } });
    expect(input).toHaveValue('test query');
  });

  it('CommandList applies custom className', () => {
    const { container } = render(
      <Command>
        <CommandList className="list-custom">
          <CommandEmpty>Empty</CommandEmpty>
        </CommandList>
      </Command>
    );
    const list = container.querySelector('[cmdk-list]');
    expect(list).toHaveClass('list-custom');
  });

  it('CommandGroup applies custom className', () => {
    const { container } = render(
      <Command>
        <CommandList>
          <CommandGroup className="group-custom" heading="Test Group">
            <CommandItem>Item</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    const group = container.querySelector('[cmdk-group]');
    expect(group).toHaveClass('group-custom');
  });
});
