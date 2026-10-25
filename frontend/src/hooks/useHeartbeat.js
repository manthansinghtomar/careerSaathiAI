'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/**
 * Custom hook to record server-side validated active learning heartbeats.
 * Enforces server-side rules:
 * - Student role only
 * - Eligible page contexts: 'assessment', 'recommendations', 'progress', 'practice', 'dashboard_learning'
 * - Active document & window focus checks
 * - Unique requestId per ping for sliding-window deduplication
 * - 45s interval (safely between MIN_PING_INTERVAL_SEC=10 and MAX_IDLE_TIMEOUT_SEC=120)
 *
 * @param {string} pageContext
 * @returns {{ activeSeconds: number, targetSeconds: number, qualifiesStreak: boolean, pingNow: Function }}
 */
export function useHeartbeat(pageContext = 'dashboard_learning') {
  const { user } = useAuth();
  const [streakProgress, setStreakProgress] = useState({
    activeSeconds: 0,
    targetSeconds: 900,
    qualifiesStreak: false,
    newlyQualified: false,
  });

  const isPingingRef = useRef(false);
  const userRole = user?.role;
  const isStudent = userRole === 'student';

  const sendHeartbeat = useCallback(async () => {
    if (!isStudent || isPingingRef.current) return;

    // Do not ping if document is hidden / tab inactive
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    try {
      isPingingRef.current = true;
      const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await api.post('/streak/heartbeat', {
        pageContext,
        requestId,
      });

      if (res?.success && res.data) {
        setStreakProgress({
          activeSeconds: res.data.activeSeconds ?? 0,
          targetSeconds: res.data.targetSeconds ?? 900,
          qualifiesStreak: Boolean(res.data.qualifiesStreak),
          newlyQualified: Boolean(res.data.newlyQualified),
        });
      }
    } catch (_) {
      // Fail silently without disrupting user interaction
    } finally {
      isPingingRef.current = false;
    }
  }, [isStudent, pageContext]);

  useEffect(() => {
    if (!isStudent) return;

    // Send initial baseline heartbeat on mount (after a brief delay)
    const initialTimer = setTimeout(() => {
      sendHeartbeat();
    }, 2000);

    // Periodic heartbeat every 45 seconds
    const intervalTimer = setInterval(() => {
      sendHeartbeat();
    }, 45000);

    // Heartbeat on visibility change when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStudent, sendHeartbeat]);

  return {
    ...streakProgress,
    pingNow: sendHeartbeat,
  };
}

export default useHeartbeat;
