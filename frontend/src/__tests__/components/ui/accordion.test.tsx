import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

function renderAccordion(props: { type?: 'single' | 'multiple'; collapsible?: boolean } = {}) {
  return render(
    <Accordion type={props.type ?? 'single'} collapsible={props.collapsible ?? true}>
      <AccordionItem value="item-1">
        <AccordionTrigger>Section One</AccordionTrigger>
        <AccordionContent>Content One</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Section Two</AccordionTrigger>
        <AccordionContent>Content Two</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('renders all trigger labels', () => {
    renderAccordion();
    expect(screen.getByText('Section One')).toBeInTheDocument();
    expect(screen.getByText('Section Two')).toBeInTheDocument();
  });

  it('sets data-slot attribute on accordion root items', () => {
    const { container } = renderAccordion();
    expect(container.querySelector('[data-slot="accordion"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="accordion-item"]')).toHaveLength(2);
  });

  it('renders triggers as buttons', () => {
    renderAccordion();
    const triggers = screen.getAllByRole('button');
    expect(triggers.length).toBeGreaterThanOrEqual(2);
  });

  it('expands content when trigger is clicked', () => {
    renderAccordion();
    const trigger = screen.getByText('Section One');
    fireEvent.click(trigger);
    const content = screen.getByText('Content One');
    expect(content).toBeVisible();
  });

  it('collapses content when same trigger is clicked again (collapsible)', () => {
    renderAccordion({ collapsible: true });
    const trigger = screen.getByText('Section One');
    fireEvent.click(trigger);
    expect(screen.getByText('Content One')).toBeVisible();
    fireEvent.click(trigger);
    // After collapsing, the content's parent should have data-state=closed
    const contentSlot = document.querySelector('[data-slot="accordion-content"]');
    expect(contentSlot).toHaveAttribute('data-state', 'closed');
  });

  it('applies custom className to AccordionItem', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="custom-item-class">
          <AccordionTrigger>Title</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const item = container.querySelector('[data-slot="accordion-item"]');
    expect(item).toHaveClass('custom-item-class');
  });

  it('applies custom className to AccordionTrigger', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger className="trigger-class">Title</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const trigger = container.querySelector('[data-slot="accordion-trigger"]');
    expect(trigger).toHaveClass('trigger-class');
  });

  it('renders chevron icon inside trigger', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Title</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const svg = container.querySelector('[data-slot="accordion-trigger"] svg');
    expect(svg).toBeInTheDocument();
  });

  it('wraps trigger in a header element', () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Title</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const headings = container.querySelectorAll('h3');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('supports multiple type allowing all items open', () => {
    render(
      <Accordion type="multiple">
        <AccordionItem value="item-1">
          <AccordionTrigger>Section One</AccordionTrigger>
          <AccordionContent>Content One</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Section Two</AccordionTrigger>
          <AccordionContent>Content Two</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    fireEvent.click(screen.getByText('Section One'));
    fireEvent.click(screen.getByText('Section Two'));
    expect(screen.getByText('Content One')).toBeVisible();
    expect(screen.getByText('Content Two')).toBeVisible();
  });
});
