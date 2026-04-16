'use client'

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BRAND } from '@/constants/brand';

interface HeuresysLogoProps {
  size?: 'xs' | 'small' | 'medium' | 'large' | 'hero' | 'xlarge';
  animated?: boolean;
  className?: string;
  showLoadAnimation?: boolean;
  label?: string;
  onClick?: () => void;
  interactive?: boolean;
}

interface SizeConfig {
  width: string;
  height: string;
  viewBox: string;
  fontSize: string;
  style?: React.CSSProperties;
}

const SIZE_CONFIG: Record<string, SizeConfig> = {
  xs: {
    width: '',
    height: '',
    viewBox: '22 6 136 24',
    fontSize: 'text-base',
    style: { width: '150px', height: '38px' },
  },
  small: {
    width: 'w-30',
    height: 'h-7.5',
    viewBox: '22 6 136 24',
    fontSize: 'text-sm',
  },
  medium: {
    width: 'w-40',
    height: 'h-10',
    viewBox: '22 6 136 24',
    fontSize: 'text-base',
  },
  large: {
    width: 'w-60',
    height: 'h-15',
    viewBox: '22 6 136 24',
    fontSize: 'text-lg',
  },
  hero: {
    width: '',
    height: '',
    viewBox: '22 6 136 24',
    fontSize: 'text-3xl',
    style: { width: '100%', maxWidth: '450px', height: '112px' },
  },
  xlarge: {
    width: '',
    height: '',
    viewBox: '22 6 136 24',
    fontSize: 'text-4xl',
    style: { width: '100%', maxWidth: '800px', height: '200px' },
  },
};

const GLOW_ANIMATION = {
  initial: { opacity: 0.9 },
  animate: {
    opacity: [0.9, 1, 0.9],
    filter: [
      'drop-shadow(0 0 4px rgba(168, 85, 247, 0.2))',
      'drop-shadow(0 0 12px rgba(168, 85, 247, 0.4))',
      'drop-shadow(0 0 4px rgba(168, 85, 247, 0.2))',
    ],
  },
  transition: {
    duration: 3,
    repeat: Infinity,
    repeatType: 'loop' as const,
  },
};

const LOAD_ANIMATION = {
  initial: { opacity: 1, scale: 1 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.4, ease: 'easeOut' as const },
};

export const HeuresysLogo: React.FC<HeuresysLogoProps> = React.memo(
  ({
    size = 'medium',
    animated = false,
    className = '',
    showLoadAnimation = false,
    label = 'Heuresys',
    onClick,
    interactive = false,
  }) => {
    const colors = useMemo(
      () => ({
        primary: BRAND.colors.primary.base,
        accent: BRAND.colors.accent.base,
      }),
      []
    );

    const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.medium;

    const containerClasses = `
      ${sizeConfig.width}
      ${sizeConfig.height}
      inline-flex
      items-center
      justify-center
      transition-all
      duration-300
      ${interactive ? 'cursor-pointer hover:opacity-80' : ''}
      ${className}
    `.trim();

    const svgContent = (
      <svg
        viewBox={sizeConfig.viewBox}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={label}
        className="overflow-visible"
      >
        <defs>
          <style>
            {`
              .heuresys-logo-text {
                font-family: 'Exo 2', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                font-weight: 700;
                font-size: 26.6667px;
                line-height: 0;
                letter-spacing: -1.17px;
              }
              .heuresys-logo-primary {
                fill: ${colors.primary};
              }
              .heuresys-logo-accent {
                fill: ${colors.accent};
              }
            `}
          </style>
        </defs>
        <text x="90" y="24" textAnchor="middle" className="heuresys-logo-text">
          <tspan className="heuresys-logo-primary">Heures</tspan>
          <tspan className="heuresys-logo-accent">y</tspan>
          <tspan className="heuresys-logo-primary">s</tspan>
        </text>
      </svg>
    );

    if (animated) {
      return (
        <motion.div
          className={containerClasses}
          style={sizeConfig.style}
          {...(showLoadAnimation ? LOAD_ANIMATION : {})}
          animate={animated ? GLOW_ANIMATION.animate : undefined}
          initial={animated ? GLOW_ANIMATION.initial : undefined}
          transition={animated ? GLOW_ANIMATION.transition : undefined}
          onClick={interactive ? onClick : undefined}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          whileHover={interactive ? { scale: 1.05 } : undefined}
          whileTap={interactive ? { scale: 0.95 } : undefined}
        >
          {svgContent}
        </motion.div>
      );
    }

    if (showLoadAnimation) {
      return (
        <motion.div
          className={containerClasses}
          style={sizeConfig.style}
          {...LOAD_ANIMATION}
          onClick={interactive ? onClick : undefined}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
        >
          {svgContent}
        </motion.div>
      );
    }

    return (
      <div
        className={containerClasses}
        style={sizeConfig.style}
        onClick={interactive ? onClick : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        {svgContent}
      </div>
    );
  }
);

HeuresysLogo.displayName = 'HeuresysLogo';

export default HeuresysLogo;
