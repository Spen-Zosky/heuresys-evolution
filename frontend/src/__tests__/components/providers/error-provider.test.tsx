import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ErrorProviderWrapper } from '@/components/providers/error-provider';

describe('ErrorProviderWrapper', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ErrorProviderWrapper>
        <div>Test</div>
      </ErrorProviderWrapper>
    );
    expect(container).toBeTruthy();
  });
});
