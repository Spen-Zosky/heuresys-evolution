'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, clearAuthToken, getSessionExpiry } from '@/lib/api-config';
import { api } from '@/lib/api';

const WARNING_SECONDS = 300; // Show warning 5 minutes before expiry
const ACTIVITY_THRESHOLD_MS = 60_000; // Consider "active" if interaction within last 60s

export interface SessionTimeoutState {
  showWarning: boolean;
  secondsRemaining: number;
  extendSession: () => Promise<void>;
  logout: () => void;
}

export function useSessionTimeout(): SessionTimeoutState {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Infinity);
  const lastActivityRef = useRef<number>(Date.now());
  const refreshingRef = useRef(false);

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keypress', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });
    window.addEventListener('scroll', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, []);

  const doLogout = useCallback(() => {
    clearAuthToken();
    router.push('/login?reason=timeout');
  }, [router]);

  const extendSession = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      // Refresh via cookie — backend reads refresh token from httpOnly cookie
      await api.auth.refreshAccessToken('');
      setShowWarning(false);
    } catch {
      doLogout();
    } finally {
      refreshingRef.current = false;
    }
  }, [doLogout]);

  // Main timer loop — runs every second
  useEffect(() => {
    const interval = setInterval(() => {
      const isLoggedIn = getAuthToken();
      if (!isLoggedIn) return;

      const exp = getSessionExpiry();
      if (!exp) return;

      const now = Math.floor(Date.now() / 1000);
      const remaining = exp - now;

      setSecondsRemaining(remaining);

      // Token already expired
      if (remaining <= 0) {
        doLogout();
        return;
      }

      // Within warning window
      if (remaining <= WARNING_SECONDS) {
        const isActive = Date.now() - lastActivityRef.current < ACTIVITY_THRESHOLD_MS;

        if (isActive && !refreshingRef.current) {
          // User is active — silently refresh
          extendSession();
        } else {
          // User is idle — show warning
          setShowWarning(true);
        }
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [doLogout, extendSession]);

  return {
    showWarning,
    secondsRemaining,
    extendSession,
    logout: doLogout,
  };
}
