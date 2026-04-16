/**
 * Motion Presets - Framer Motion Animation Variants
 *
 * Consistent, purposeful animations across the application.
 * Inspired by Linear, Vercel, Stripe motion design.
 *
 * Usage:
 * import { motionPresets, pageTransition } from '@/lib/motion-presets'
 * <motion.div {...motionPresets.fadeIn} />
 */

import { type Variants, type Transition } from 'framer-motion'

// Easing curves
export const easing = {
  // Default ease-out (smooth deceleration)
  out: [0.16, 1, 0.3, 1] as const,
  // Ease in-out (smooth acceleration and deceleration)
  inOut: [0.65, 0, 0.35, 1] as const,
  // Spring-like bounce
  spring: [0.34, 1.56, 0.64, 1] as const,
  // Linear
  linear: [0, 0, 1, 1] as const,
}

// Duration constants (in seconds)
export const duration = {
  fast: 0.1,
  normal: 0.2,
  slow: 0.4,
  slower: 0.6,
}

// Base transition
export const baseTransition: Transition = {
  duration: duration.normal,
  ease: easing.out,
}

/**
 * Page Transition - For route changes
 */
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Fade In - Simple opacity transition
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: baseTransition,
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
}

/**
 * Slide Up - Content sliding up into view
 */
export const slideUp: Variants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Scale In - For modals, popovers
 */
export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: duration.fast,
      ease: easing.out,
    },
  },
}

/**
 * Stagger Container - For lists of items
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

/**
 * Stagger Item - Child items in a stagger container
 */
export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
}

/**
 * Hover Lift - Subtle lift on hover
 */
export const hoverLift = {
  whileHover: {
    y: -2,
    transition: { duration: duration.normal, ease: easing.out },
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: duration.fast },
  },
}

/**
 * Button Press - For interactive buttons
 */
export const buttonPress = {
  whileTap: {
    scale: 0.98,
    transition: { duration: duration.fast },
  },
}

/**
 * Expand Collapse - For accordions, collapsible sections
 */
export const expandCollapse: Variants = {
  initial: {
    height: 0,
    opacity: 0,
  },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: duration.slow, ease: easing.out },
      opacity: { duration: duration.normal, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: duration.normal, ease: easing.out },
      opacity: { duration: duration.fast },
    },
  },
}

/**
 * Sidebar Collapse - For sidebar width transitions
 */
export const sidebarCollapse = {
  expanded: {
    width: 240,
    transition: { duration: duration.normal, ease: easing.out },
  },
  collapsed: {
    width: 64,
    transition: { duration: duration.normal, ease: easing.out },
  },
}

/**
 * Modal Overlay - Backdrop fade
 */
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: duration.normal },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
}

/**
 * Modal Content - Scale and fade
 */
export const modalContent: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Slide In Right - For drawers, sidebars
 */
export const slideInRight: Variants = {
  initial: {
    x: '100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Slide In Left - For left-side panels
 */
export const slideInLeft: Variants = {
  initial: {
    x: '-100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: duration.slow,
      ease: easing.out,
    },
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Tooltip - Quick fade and scale
 */
export const tooltip: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: duration.fast,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: 0.075,
    },
  },
}

/**
 * Tab Content - For tab panel transitions
 */
export const tabContent: Variants = {
  initial: {
    opacity: 0,
    x: 8,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: {
      duration: duration.fast,
    },
  },
}

/**
 * Counter Animation - For number counting
 */
export const counterAnimation = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: duration.slower,
      ease: easing.out,
    },
  },
}

/**
 * Chart Draw - For SVG path animations
 */
export const chartDraw: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: duration.slower,
        ease: easing.out,
      },
      opacity: {
        duration: duration.normal,
      },
    },
  },
}

/**
 * Notification - Slide in from top
 */
export const notification: Variants = {
  initial: {
    opacity: 0,
    y: -16,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.slow,
      ease: easing.spring,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: {
      duration: duration.normal,
      ease: easing.out,
    },
  },
}

/**
 * Dropdown Menu - Expand from origin
 */
export const dropdownMenu: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: -4,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: duration.fast,
      ease: easing.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: {
      duration: 0.075,
    },
  },
}

/**
 * Motion Presets - All variants bundled
 */
export const motionPresets = {
  pageTransition,
  fadeIn,
  slideUp,
  scaleIn,
  staggerContainer,
  staggerItem,
  hoverLift,
  buttonPress,
  expandCollapse,
  sidebarCollapse,
  modalOverlay,
  modalContent,
  slideInRight,
  slideInLeft,
  tooltip,
  tabContent,
  counterAnimation,
  chartDraw,
  notification,
  dropdownMenu,
}

export default motionPresets
