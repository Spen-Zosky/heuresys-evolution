/**
 * HEURESYS BRAND IDENTITY SYSTEM - CENTRALIZED TOKENS
 * Based on UX Design Specification tokens.json
 */

export const BRAND_COLORS = {
  primary: {
    base: 'hsl(221, 83%, 53%)',  // Brand Blue from tokens.json
    dark: 'hsl(221, 83%, 43%)',
    light: 'hsl(221, 83%, 63%)',
  },
  accent: {
    base: '#a855f7',  // Purple accent for "y" in logo
    dark: '#7c3aed',
    light: '#d8b4fe',
    rgb: 'rgb(168, 85, 247)',
    rgba50: 'rgba(168, 85, 247, 0.5)',
    rgba30: 'rgba(168, 85, 247, 0.3)',
    rgba10: 'rgba(168, 85, 247, 0.1)',
  },
  dark: {
    background: 'hsl(224, 71%, 4%)',
    surface: 'hsl(215, 28%, 10%)',
    surfaceAlt: 'hsl(215, 28%, 17%)',
    text: 'hsl(210, 20%, 98%)',
    textSecondary: 'hsl(217, 10%, 64%)',
    textTertiary: 'hsl(220, 9%, 46%)',
    border: 'hsl(215, 28%, 17%)',
    borderLight: 'hsl(215, 28%, 25%)',
  },
  light: {
    background: 'hsl(0, 0%, 100%)',
    surface: 'hsl(220, 14%, 96%)',
    surfaceAlt: 'hsl(220, 14%, 92%)',
    text: 'hsl(224, 71%, 4%)',
    textSecondary: 'hsl(220, 9%, 46%)',
    textTertiary: 'hsl(220, 13%, 69%)',
    border: 'hsl(220, 13%, 91%)',
    borderLight: 'hsl(220, 14%, 96%)',
  },
  semantic: {
    success: 'hsl(142, 76%, 36%)',
    error: 'hsl(0, 84%, 60%)',
    warning: 'hsl(38, 92%, 50%)',
    info: 'hsl(199, 89%, 48%)',
  },
  gradients: {
    hero: 'from-purple-400 via-blue-400 to-cyan-400',
    brandPrimary: 'from-purple-400 to-blue-500',
    accent: 'from-purple-500 to-pink-500',
  },
} as const;

export const BRAND_TYPOGRAPHY = {
  fonts: {
    display: "'Exo 2', 'Montserrat', system-ui, sans-serif",
    heading: "'Montserrat', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
  },
  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

export const BRAND = {
  colors: BRAND_COLORS,
  typography: BRAND_TYPOGRAPHY,
  identity: {
    name: 'Heuresys',
    tagline: 'From Hidden Patterns To Strategic Knowledge',
    description: 'AI-native HRMS Orchestration Suite',
  },
} as const;

export type Brand = typeof BRAND;
