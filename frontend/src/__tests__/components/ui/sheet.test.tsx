import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';

describe('Sheet', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
      </Sheet>
    );
    expect(container).toBeTruthy();
  });
});
