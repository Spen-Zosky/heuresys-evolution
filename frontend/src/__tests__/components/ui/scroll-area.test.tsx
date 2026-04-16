import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

describe('ScrollArea', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ScrollArea className="h-[200px]">
        <div>Scrollable content</div>
        <ScrollBar />
      </ScrollArea>
    );
    expect(container).toBeTruthy();
  });
});
