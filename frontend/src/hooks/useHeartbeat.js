'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const HEARTBEAT_INTERVAL_MS = 45000; // 45s periodic heartbeat interval
const USER_IDLE_THRESHOLD_MS = 60000; // 60s of inactivity considered idle / AFK
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
];

/**
 * Custom hook to record server-side validated active learning heartbeats.
 * Enforces server-side rules & client activity verification:
 * - Student role only
 * - Eligible page contexts: 'assessment', 'recommendations', 'progress', 'practice', 'dashboard_learning'
 * - Active document & window visibility checks
 * - Genuine user activity verification (prevents blind AFK time inflation)
 * - Unique requestId per ping for sliding-window deduplication
 * - 45s interval (safely between MIN_PING_INTERVAL_SEC=10 and MAX_IDLE_TIMEOUT_SEC=120)
 *
 * @param {string} pageContext
 * @param {Object|boolean} [options={}] - Options object ({ enabled: boolean }) or boolean flag
 * @returns {{ activeSeconds: number, targetSeconds: number, qualifiesStreak: boolean, pingNow: Function }}
 */
export function useHeartbeat(pageContext = 'dashboard_learning', options = {}) {
  const isEnabled = typeof options === 'boolean' ? options : (options?.enabled ?? true);
  const { user } = useAuth();
  const [streakProgress, setStreakProgress] = useState({
    activeSeconds: 0,
    targetSeconds: 900,
    qualifiesStreak: false,
    newlyQualified: false,
  });

  const isPingingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastActivityRef = useRef(0);
  const lastThrottleRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const wasIdleRef = useRef(false);

  const userRole = user?.role;
  const isStudent = userRole === 'student';

  const sendHeartbeat = useCallback(
    async (force = false) => {
      if (!isEnabled || !isStudent || isPingingRef.current) return;

      // Do not ping if document is hidden / tab inactive
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      // Require genuine recent user interaction unless forced (skips AFK idle tabs)
      if (!force) {
        if (lastActivityRef.current === 0 || timeSinceLastActivity > USER_IDLE_THRESHOLD_MS) {
          wasIdleRef.current = true;
          return;
        }
      }

      try {
        isPingingRef.current = true;
        const requestId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const res = await api.post('/streak/heartbeat', {
          pageContext,
          requestId,
        });

        if (res?.success && res.data && isMountedRef.current) {
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
    },
    [isEnabled, isStudent, pageContext]
  );

  useEffect(() => {
    isMountedRef.current = true;
    if (!isEnabled || !isStudent) return;

    // Lightweight listener: record user interaction at most once per second
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current > 1000) {
        lastThrottleRef.current = now;
        lastActivityRef.current = now;

        // On initial learner engagement on this page, establish baseline
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          sendHeartbeat();
        } else if (wasIdleRef.current) {
          // Returning from an idle period: establish fresh server baseline
          wasIdleRef.current = false;
          sendHeartbeat(true);
        }
      }
    };

    // Attach passive activity listeners for mouse, keyboard, touch, and scroll
    if (typeof window !== 'undefined') {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, handleUserActivity, { passive: true });
      });
    }

    // Initial check on mount: only pings if learner has actively engaged with the page
    const initialTimer = setTimeout(() => {
      if (
        lastActivityRef.current > 0 &&
        Date.now() - lastActivityRef.current <= USER_IDLE_THRESHOLD_MS
      ) {
        sendHeartbeat();
      }
    }, 2000);

    // Periodic heartbeat every 45s: verifies recent user activity before pinging
    const intervalTimer = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // On tab visibility change: only ping if learner was recently active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        if (lastActivityRef.current > 0 && timeSinceActivity <= USER_IDLE_THRESHOLD_MS) {
          sendHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typeof window !== 'undefined') {
        ACTIVITY_EVENTS.forEach((eventName) => {
          window.removeEventListener(eventName, handleUserActivity);
        });
      }
    };
  }, [isEnabled, isStudent, sendHeartbeat]);

  return {
    ...streakProgress,
    pingNow: () => sendHeartbeat(true),
  };
}

export default useHeartbeat;
