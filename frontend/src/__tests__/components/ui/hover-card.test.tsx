import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

describe('HoverCard', () => {
  it('renders trigger element', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
      </HoverCard>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('renders trigger as a link when using asChild', () => {
    render(
      <HoverCard>
        <HoverCardTrigger asChild>
          <a href="/profile">Profile Link</a>
        </HoverCardTrigger>
      </HoverCard>
    );
    const link = screen.getByText('Profile Link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/profile');
  });

  it('shows content when open is controlled', () => {
    render(
      <HoverCard open={true}>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>Card content here</HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('Card content here')).toBeInTheDocument();
  });

  it('does not show content when closed', () => {
    render(
      <HoverCard open={false}>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>Hidden content</HoverCardContent>
      </HoverCard>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('HoverCardContent applies custom className', () => {
    render(
      <HoverCard open={true}>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent className="custom-card">Content</HoverCardContent>
      </HoverCard>
    );
    const content = screen.getByText('Content');
    expect(content.closest('[data-state]')).toHaveClass('custom-card');
  });

  it('renders complex content within card', () => {
    render(
      <HoverCard open={true}>
        <HoverCardTrigger>User</HoverCardTrigger>
        <HoverCardContent>
          <h4>John Doe</h4>
          <p>Software Engineer</p>
        </HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });
});
