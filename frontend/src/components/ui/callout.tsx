'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { easing } from '@/lib/motion-presets';
import {
  Info,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * Callout - Contextual information/help tooltips
 */
interface CalloutProps {
  /** Callout title */
  title?: string;
  /** Callout content */
  children: React.ReactNode;
  /** Variant determines icon and accent color */
  variant?: 'info' | 'tip' | 'warning' | 'success';
  /** Optional "Learn more" link */
  learnMoreUrl?: string;
  /** Whether callout can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional className */
  className?: string;
  /** Inline or block display */
  inline?: boolean;
}

const variantConfig: Record<
  'info' | 'tip' | 'warning' | 'success',
  { icon: LucideIcon; bgClass: string; borderClass: string; iconClass: string }
> = {
  info: {
    icon: Info,
    bgClass: 'bg-info/5',
    borderClass: 'border-info/20',
    iconClass: 'text-info',
  },
  tip: {
    icon: Lightbulb,
    bgClass: 'bg-warning/5',
    borderClass: 'border-warning/20',
    iconClass: 'text-warning',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-destructive/5',
    borderClass: 'border-destructive/20',
    iconClass: 'text-destructive',
  },
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-emerald-500/5',
    borderClass: 'border-emerald-500/20',
    iconClass: 'text-emerald-500',
  },
};

export function Callout({
  title,
  children,
  variant = 'info',
  learnMoreUrl,
  dismissible = false,
  onDismiss,
  className,
  inline = false,
}: CalloutProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2, ease: easing.out }}
          className={cn(
            'relative rounded-lg border p-4',
            config.bgClass,
            config.borderClass,
            inline ? 'inline-flex items-start gap-3' : 'flex items-start gap-3',
            className
          )}
        >
          <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconClass)} />

          <div className="flex-1 min-w-0">
            {title && <p className="font-medium text-foreground mb-1">{title}</p>}
            <div className="text-sm text-muted-foreground">{children}</div>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary hover:underline"
              >
                Learn more
                <ChevronRight className="h-3 w-3" />
              </a>
            )}
          </div>

          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="h-6 w-6 flex-shrink-0 -mr-1 -mt-1"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Chiudi avviso</span>
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Feature Spotlight - Onboarding spotlight for new features
 */
interface SpotlightProps {
  /** Target element selector or ref */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Spotlight title */
  title: string;
  /** Spotlight description */
  description: string;
  /** Current step number */
  step?: number;
  /** Total steps */
  totalSteps?: number;
  /** Position relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Show spotlight */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Next step handler */
  onNext?: () => void;
  /** Previous step handler */
  onPrev?: () => void;
  /** Skip all handler */
  onSkip?: () => void;
}

export function Spotlight({
  targetRef,
  title,
  description,
  step,
  totalSteps,
  position = 'bottom',
  isOpen,
  onClose,
  onNext,
  onPrev,
  onSkip,
}: SpotlightProps) {
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  // Calculate position based on target element
  React.useEffect(() => {
    if (!targetRef?.current || !isOpen) return;

    const updatePosition = () => {
      const rect = targetRef.current?.getBoundingClientRect();
      if (!rect) return;

      setTargetRect(rect);

      const padding = 16;
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - padding;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - padding;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + padding;
          break;
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [targetRef, isOpen, position]);

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full -mt-3',
    bottom: '-translate-x-1/2 mt-3',
    left: '-translate-x-full -translate-y-1/2 -ml-3',
    right: '-translate-y-1/2 ml-3',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Spotlight cutout effect on target */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: easing.out }}
              className="fixed z-[101] pointer-events-none"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                borderRadius: 12,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: position === 'bottom' ? -8 : position === 'top' ? 8 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: easing.out }}
            className={cn(
              'fixed z-[102] w-80',
              'bg-card text-card-foreground',
              'border border-border rounded-xl shadow-2xl',
              'p-5',
              positionClasses[position]
            )}
            style={{ top: coords.top, left: coords.left }}
          >
            {/* Sparkle icon */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              {/* Progress indicator */}
              {step !== undefined && totalSteps !== undefined && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        i + 1 === step
                          ? 'w-4 bg-primary'
                          : i + 1 < step
                            ? 'w-1.5 bg-primary/50'
                            : 'w-1.5 bg-muted'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <h4 className="font-semibold text-foreground mb-2 text-base">{title}</h4>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{description}</p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Skip tour
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onPrev && step && step > 1 && (
                  <Button variant="outline" size="sm" onClick={onPrev}>
                    Back
                  </Button>
                )}
                {onNext ? (
                  <Button size="sm" onClick={onNext}>
                    {step === totalSteps ? 'Finish' : 'Next'}
                  </Button>
                ) : (
                  <Button size="sm" onClick={onClose}>
                    Got it
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * OnboardingTour - Multi-step onboarding tour component
 */
export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  /** Tour steps configuration */
  steps: TourStep[];
  /** Whether tour is active */
  isActive: boolean;
  /** Called when tour is completed or skipped */
  onComplete: () => void;
  /** Optional: storage key for "don't show again" */
  storageKey?: string;
}

export function OnboardingTour({ steps, isActive, onComplete, storageKey }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [targetRef, setTargetRef] = React.useState<React.RefObject<HTMLElement | null>>({
    current: null,
  });

  // Find and set target element
  React.useEffect(() => {
    if (!isActive || !steps[currentStep]?.targetSelector) return;

    const element = document.querySelector(steps[currentStep].targetSelector!) as HTMLElement;
    if (element) {
      setTargetRef({ current: element });
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    onComplete();
    setCurrentStep(0);
  };

  if (!isActive || steps.length === 0) return null;

  const step = steps[currentStep];

  return (
    <Spotlight
      targetRef={targetRef}
      title={step.title}
      description={step.description}
      step={currentStep + 1}
      totalSteps={steps.length}
      position={step.position || 'bottom'}
      isOpen={isActive}
      onClose={handleComplete}
      onNext={handleNext}
      onPrev={currentStep > 0 ? handlePrev : undefined}
      onSkip={handleSkip}
    />
  );
}

/**
 * useOnboardingTour - Hook for managing onboarding tour state
 */
export function useOnboardingTour(storageKey: string, steps: TourStep[]) {
  const [isActive, setIsActive] = React.useState(false);
  const [hasSeenTour, setHasSeenTour] = React.useState(true);

  React.useEffect(() => {
    // Check if user has seen tour
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      setHasSeenTour(false);
      // Auto-start tour after a short delay
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const startTour = React.useCallback(() => {
    setIsActive(true);
  }, []);

  const completeTour = React.useCallback(() => {
    setIsActive(false);
    setHasSeenTour(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const resetTour = React.useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasSeenTour(false);
  }, [storageKey]);

  return {
    isActive,
    hasSeenTour,
    startTour,
    completeTour,
    resetTour,
    steps,
    TourComponent: () => (
      <OnboardingTour
        steps={steps}
        isActive={isActive}
        onComplete={completeTour}
        storageKey={storageKey}
      />
    ),
  };
}

/**
 * HelpTooltip - Inline help indicator with tooltip
 */
interface HelpTooltipProps {
  /** Tooltip content */
  content: string;
  /** Optional title */
  title?: string;
  /** Position */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({ content, title, position = 'top' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        aria-label="Help"
      >
        <span className="text-[10px] font-bold">?</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1, ease: easing.out }}
            className={cn(
              'absolute z-50 w-48 p-2.5',
              'bg-popover text-popover-foreground',
              'border border-border rounded-lg shadow-lg',
              'text-xs',
              position === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-1',
              position === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-1',
              position === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-1',
              position === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-1'
            )}
          >
            {title && <p className="font-medium text-foreground mb-0.5">{title}</p>}
            <p className="text-muted-foreground">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * FeatureBadge - Small badge to indicate new features
 */
interface FeatureBadgeProps {
  /** Badge label */
  label?: string;
  /** Additional className */
  className?: string;
}

export function FeatureBadge({ label = 'New', className }: FeatureBadgeProps) {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wider',
        'bg-primary/10 text-primary rounded-md',
        className
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {label}
    </motion.span>
  );
}

export default Callout;
