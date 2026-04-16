'use client'

import React, { useMemo } from 'react';
import { BRAND } from '@/constants/brand';

interface HeuresysBrandTextProps {
  className?: string;
}

export const HeuresysBrandText: React.FC<HeuresysBrandTextProps> = React.memo(
  ({ className = '' }) => {
    const colors = useMemo(
      () => ({
        primary: BRAND.colors.primary.base,
        accent: BRAND.colors.accent.base,
      }),
      []
    );

    return (
      <span className={`inline ${className}`} style={{
        fontSize: 'inherit',
        fontWeight: 'inherit',
        fontStyle: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
      }}>
        <span style={{ color: colors.primary }}>Heures</span>
        <span style={{ color: colors.accent }}>y</span>
        <span style={{ color: colors.primary }}>s</span>
      </span>
    );
  }
);

HeuresysBrandText.displayName = 'HeuresysBrandText';

export default HeuresysBrandText;
