/**
 * Excalidraw Brand Configuration
 *
 * This file defines the color and font transformations for Excalidraw wireframes.
 *
 * HOW IT WORKS:
 * - Wireframes use a "source" color palette (defined in sourceColors)
 * - At load time, colors are transformed to "target" brand colors
 * - If brand colors change, only update targetColors - no file regeneration needed
 *
 * ADDING NEW COLORS:
 * 1. Add the source color to sourceColors
 * 2. Add the target color to targetColors
 * 3. Add mapping in colorTransformMap
 */

// ============================================================================
// HEURESYS BRAND COLORS (TARGET PALETTE)
// ============================================================================

export const heuresysBrandColors = {
  // Primary Brand Colors
  primary: "#2563eb",
  primaryDark: "#1e40af",
  primaryDarker: "#1d4ed8",
  primaryLight: "#dbeafe",
  primaryLighter: "#eff6ff",

  // Text Colors (Slate Scale)
  textPrimary: "#1e293b",    // slate-800
  textSecondary: "#475569",  // slate-600
  textTertiary: "#64748b",   // slate-500
  textMuted: "#94a3b8",      // slate-400

  // Border Colors
  border: "#e2e8f0",         // slate-200
  borderDark: "#cbd5e1",     // slate-300

  // Background Colors
  background: "#ffffff",
  backgroundMuted: "#f8fafc", // slate-50
  backgroundAlt: "#f1f5f9",   // slate-100

  // Semantic Colors
  success: "#22c55e",
  successLight: "#dcfce7",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fef2f2",
  info: "#3b82f6",
  infoLight: "#dbeafe",

  // Secondary (Purple)
  secondary: "#a855f7",
  secondaryLight: "#f3e8ff",

  // Canvas
  canvasBackground: "#fafafa",
} as const;

// ============================================================================
// SOURCE COLOR MAPPING (Colors that might exist in wireframes)
// ============================================================================

/**
 * Maps source colors to semantic brand color keys
 * This allows wireframes to use various color formats that all map to the same brand color
 */
export const colorTransformMap: Record<string, keyof typeof heuresysBrandColors> = {
  // Current Heuresys colors (already migrated)
  "#2563eb": "primary",
  "#1e40af": "primaryDark",
  "#1d4ed8": "primaryDarker",
  "#dbeafe": "primaryLight",
  "#eff6ff": "primaryLighter",

  // Text colors
  "#1e293b": "textPrimary",
  "#475569": "textSecondary",
  "#64748b": "textTertiary",
  "#94a3b8": "textMuted",
  "#334155": "textSecondary", // slate-700 → secondary text

  // Borders
  "#e2e8f0": "border",
  "#cbd5e1": "borderDark",

  // Backgrounds
  "#ffffff": "background",
  "#f8fafc": "backgroundMuted",
  "#f1f5f9": "backgroundAlt",
  "#fafafa": "canvasBackground",

  // Semantic - Greens
  "#22c55e": "success",
  "#16a34a": "success",
  "#dcfce7": "successLight",
  "#f0fdf4": "successLight",

  // Semantic - Ambers
  "#f59e0b": "warning",
  "#d97706": "warning",
  "#fef3c7": "warningLight",

  // Semantic - Reds
  "#ef4444": "danger",
  "#dc2626": "danger",
  "#fef2f2": "dangerLight",
  "#fecaca": "dangerLight",

  // Semantic - Blues (info)
  "#3b82f6": "info",
  "#60a5fa": "info",

  // Secondary (Purple)
  "#a855f7": "secondary",
  "#9333ea": "secondary",
  "#f3e8ff": "secondaryLight",
  "#faf5ff": "secondaryLight",

  // -------------------------------------------------------------------------
  // LEGACY MATERIAL DESIGN COLORS (for backwards compatibility)
  // If any wireframes still have old colors, they will be transformed
  // -------------------------------------------------------------------------

  // Material Blues
  "#2196f3": "primary",
  "#1976d2": "primaryDarker",
  "#1565c0": "primaryDark",
  "#e3f2fd": "primaryLight",
  "#bbdefb": "primaryLight",
  "#42a5f5": "primary",
  "#64b5f6": "info",

  // Material Grays
  "#212121": "textPrimary",
  "#424242": "textSecondary",
  "#616161": "textSecondary",
  "#757575": "textTertiary",
  "#9e9e9e": "textMuted",
  "#bdbdbd": "borderDark",
  "#e0e0e0": "border",
  "#eeeeee": "backgroundAlt",
  "#f5f5f5": "backgroundMuted",
  "#666666": "textSecondary",
  "#999999": "textMuted",
  "#333333": "textPrimary",
  "#555555": "textSecondary",
  "#888888": "textTertiary",
  "#aaaaaa": "textMuted",
  "#cccccc": "borderDark",
  "#dddddd": "border",

  // Material Greens
  "#4caf50": "success",
  "#388e3c": "success",
  "#81c784": "success",
  "#c8e6c9": "successLight",
  "#e8f5e9": "successLight",

  // Material Oranges
  "#ff9800": "warning",
  "#f57c00": "warning",
  "#ffb74d": "warning",
  "#ffe0b2": "warningLight",
  "#fff3e0": "warningLight",

  // Material Reds
  "#f44336": "danger",
  "#d32f2f": "danger",
  "#e57373": "danger",
  "#ef9a9a": "dangerLight",
  "#ffcdd2": "dangerLight",
  "#ffebee": "dangerLight",

  // Material Purples
  "#9c27b0": "secondary",
  "#7b1fa2": "secondary",
  "#ce93d8": "secondary",
  "#e1bee7": "secondaryLight",

  // Excalidraw defaults (purple)
  "#6965db": "primary",
  "#5b57d1": "primaryDarker",

  // Dark backgrounds
  "#1a1a2e": "textPrimary",
  "#16213e": "textPrimary",
  "#0f3460": "primaryDark",
};

// ============================================================================
// FONT CONFIGURATION
// ============================================================================

/**
 * Excalidraw Font Family IDs (from @excalidraw/excalidraw constants.ts):
 * 1 = Virgil (hand-drawn)
 * 2 = Helvetica (sans-serif)
 * 3 = Cascadia (monospace)
 * 5 = Excalifont (hand-drawn style)
 * 6 = Nunito (clean sans-serif) - HEURESYS DEFAULT
 * 7 = Lilita One (display)
 * 8 = Comic Shanns (comic)
 * 9 = Liberation Sans (sans-serif)
 */
export const heuresysFontConfig = {
  defaultFontFamily: 6,  // Nunito
  fontSize: 16,
  roughness: 0,          // Clean lines, no hand-drawn effect
  strokeWidth: 1,
};

// ============================================================================
// TRANSFORM FUNCTION
// ============================================================================

/**
 * Generic type for Excalidraw elements that may have color/font properties.
 * Uses a flexible interface to handle any element structure from Excalidraw files.
 */
interface TransformableElement {
  type: string;
  strokeColor?: string;
  backgroundColor?: string;
  fill?: string;
  fontFamily?: number;
  roughness?: number;
  [key: string]: unknown;
}

/**
 * Transforms a single color to brand color
 */
export function transformColor(color: string | undefined): string | undefined {
  if (!color) return color;

  const normalizedColor = color.toLowerCase();
  const brandKey = colorTransformMap[normalizedColor];

  if (brandKey) {
    return heuresysBrandColors[brandKey];
  }

  // If not in map, return original
  return color;
}

/**
 * Transforms all colors and fonts in Excalidraw elements to brand style.
 * Uses generics to preserve the original element type structure.
 */
export function transformElementsToBrand<T extends TransformableElement>(elements: T[]): T[] {
  return elements.map(element => {
    const transformed = { ...element };

    // Transform colors
    if (transformed.strokeColor) {
      transformed.strokeColor = transformColor(transformed.strokeColor);
    }
    if (transformed.backgroundColor) {
      transformed.backgroundColor = transformColor(transformed.backgroundColor);
    }
    if (transformed.fill) {
      transformed.fill = transformColor(transformed.fill);
    }

    // Apply font defaults to text elements
    if (transformed.type === "text") {
      // Always use Nunito (2) for professional look
      if (transformed.fontFamily === 1) {
        transformed.fontFamily = heuresysFontConfig.defaultFontFamily;
      }
    }

    // Ensure clean lines (no hand-drawn roughness)
    if (["rectangle", "ellipse", "diamond", "line", "arrow"].includes(transformed.type)) {
      if (transformed.roughness === undefined || transformed.roughness > 0) {
        transformed.roughness = heuresysFontConfig.roughness;
      }
    }

    return transformed;
  });
}

/**
 * Transforms appState background color to brand color
 */
export function transformAppState(appState: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!appState) {
    return {
      viewBackgroundColor: heuresysBrandColors.canvasBackground,
    };
  }

  return {
    ...appState,
    viewBackgroundColor: transformColor(appState.viewBackgroundColor as string) || heuresysBrandColors.canvasBackground,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export type BrandColorKey = keyof typeof heuresysBrandColors;
export type { TransformableElement };
