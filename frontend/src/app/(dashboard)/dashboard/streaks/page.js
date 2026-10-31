'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { MetricCard } from '@/components/shared/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Flame,
  Clock,
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

const STREAK_MILESTONES = [
  { days: 3, label: '3-Day Starter', reward: 'Bronze Habit Badge' },
  { days: 7, label: '7-Day Focus', reward: 'Silver Consistency Badge' },
  { days: 14, label: '14-Day Sprint', reward: 'Gold Dedicated Learner' },
  { days: 30, label: '30-Day Master', reward: 'Platinum Engineering Habit' },
  { days: 50, label: '50-Day Elite', reward: 'Diamond Career Devotee' },
  { days: 100, label: '100-Day Legend', reward: 'Hall of Fame Milestone' },
];

export default function LearningStreaksPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'student';
  const isStudent = userRole === 'student';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(isStudent);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  // Load authoritative streak summary
  useEffect(() => {
    let ignore = false;
    if (!isStudent) return;

    async function loadSummary() {
      try {
        const res = await api.get('/streak/summary');
        if (!ignore) {
          if (res?.success && res.data) {
            setSummary(res.data);
            setError(null);
          } else {
            setError('Could not load streak summary.');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load streak records.');
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, [isStudent, reloadIndex]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.get('/streak/summary');
      if (res?.success && res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to sync with streak server.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  // If Trainer or Admin
  if (!isStudent) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs max-w-xl mx-auto space-y-3">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-full inline-flex">
          <Flame className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Student Learning Streaks</h2>
        <p className="text-xs text-slate-600">
          The streak system tracks daily active practice habits for students. As a{' '}
          <strong className="capitalize text-slate-900">{userRole}</strong>, you can inspect student activity trends in your coaching portal.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
        <div className="h-40 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="max-w-md mx-auto py-16 text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
        <div className="p-3 rounded-full bg-rose-50 text-rose-600 inline-flex mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Streak Unavailable</h3>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <Button variant="secondary" onClick={handleRetry} icon={RotateCcw}>
          Retry Sync
        </Button>
      </div>
    );
  }

  const {
    currentStreak = 0,
    longestStreak = 0,
    qualifiesToday = false,
    todayActiveSeconds = 0,
    targetSeconds = 900,
    nextMilestone = 3,
    daysToNextMilestone = 3,
    streakStatus = 'inactive',
    istDayKey,
  } = summary || {};

  // Defensive handling for invalid or non-positive targetSeconds (fallback to 900s)
  const safeTargetSeconds =
    typeof targetSeconds === 'number' && Number.isFinite(targetSeconds) && targetSeconds > 0
      ? targetSeconds
      : 900;

  // Authoritative active learning seconds from server summary
  const activeLearningSeconds =
    typeof todayActiveSeconds === 'number' && Number.isFinite(todayActiveSeconds) && todayActiveSeconds > 0
      ? todayActiveSeconds
      : 0;

  const isGoalReached = Boolean(qualifiesToday || activeLearningSeconds >= safeTargetSeconds);
  const rawProgress = Math.round((activeLearningSeconds / safeTargetSeconds) * 100);
  const progressPercent = Math.min(100, Math.max(0, Number.isFinite(rawProgress) ? rawProgress : 0));

  const remainingSeconds = Math.max(0, safeTargetSeconds - activeLearningSeconds);
  const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));

  // Determine status presentation
  const getStatusPresentation = () => {
    // Resolve live status contradiction: if the daily goal is reached, celebrate immediately
    if (isGoalReached || streakStatus === 'active') {
      return {
        label: 'Streak Active & Qualified Today',
        badge: 'success',
        msg: 'You have completed your 15-minute daily practice goal today! 🔥',
      };
    }

    switch (streakStatus) {
      case 'at_risk':
        return {
          label: 'Streak At Risk (Action Required)',
          badge: 'warning',
          msg: `You practiced yesterday. Complete ${remainingMinutes} more minute${remainingMinutes === 1 ? '' : 's'} today before midnight IST to keep your streak!`,
        };
      case 'broken':
        return {
          label: 'Streak Reset (Missed Previous Day)',
          badge: 'danger',
          msg: 'Your streak reset after an inactive calendar day. Complete 15 minutes today to restart it!',
        };
      case 'inactive':
      default:
        return {
          label: 'Streak Inactive',
          badge: 'default',
          msg: 'Spend 15 minutes practicing assessments or reviewing recommendations today to start your first streak.',
        };
    }
  };

  const statusInfo = getStatusPresentation();

  // Dynamic milestone cap check based on actual STREAK_MILESTONES configuration
  const maxConfiguredMilestone =
    Array.isArray(STREAK_MILESTONES) && STREAK_MILESTONES.length > 0
      ? Math.max(...STREAK_MILESTONES.map((m) => m.days))
      : 100;
  const allMilestonesAchieved = currentStreak >= maxConfiguredMilestone;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Hero Streak Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-white border border-amber-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Flame className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {currentStreak} Day{currentStreak === 1 ? '' : 's'} Streak
                </h1>
                <Badge variant={statusInfo.badge} size="sm" dot>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-xl">
                {statusInfo.msg}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              loadingText="Syncing..."
              icon={RotateCcw}
            >
              Sync Status
            </Button>
            <Link href="/dashboard/assessments">
              <Button size="sm" icon={Sparkles}>
                Practice Now
              </Button>
            </Link>
          </div>
        </div>

        {/* Date Key Footer */}
        <div className="mt-6 pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>Server Date (IST): {istDayKey || 'Today'}</span>
          <span>Target Daily Threshold: 15 minutes (900 seconds)</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Current Streak"
          value={`${currentStreak} Days`}
          icon={Flame}
          variant="warning"
          subtitle={isGoalReached ? 'Today qualified & synchronized' : 'Needs practice today to advance'}
        />

        <MetricCard
          title="Longest Streak Record"
          value={`${longestStreak} Days`}
          icon={Award}
          variant="primary"
          subtitle="All-time personal consistency record"
        />

        <MetricCard
          title="Next Milestone Target"
          value={allMilestonesAchieved ? `${maxConfiguredMilestone} Days` : `${nextMilestone} Days`}
          icon={Zap}
          variant="info"
          subtitle={
            allMilestonesAchieved
              ? 'All consistency milestones achieved! 🏆'
              : daysToNextMilestone === 0
              ? 'Milestone qualified today!'
              : `${daysToNextMilestone} more day${daysToNextMilestone === 1 ? '' : 's'} to unlock reward`
          }
        />
      </div>

      {/* Today's Active Learning Time Meter */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Today&apos;s Active Learning Time</h3>
            <p className="text-xs text-slate-500">
              Recorded automatically while you practice assessments, review analytics, or explore recommendations
            </p>
          </div>

          <div className="text-right">
            <span className="text-sm font-bold text-slate-900">
              {formatDuration(activeLearningSeconds)} / {formatDuration(safeTargetSeconds)}
            </span>
            <span className="text-xs text-slate-400 block">{progressPercent}% Completed</span>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isGoalReached
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>0m (Baseline)</span>
            <span className="font-semibold text-slate-700">7m 30s (Halfway)</span>
            <span className={isGoalReached ? 'font-bold text-emerald-700' : 'font-semibold text-slate-700'}>
              15m 00s (Qualifying Goal {isGoalReached ? '✓' : ''})
            </span>
          </div>
        </div>

        {isGoalReached ? (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Awesome job!</strong> You have satisfied today&apos;s 15-minute learning requirement. Your streak is safeguarded through midnight IST.
            </span>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Learning in progress:</strong> Spend active time answering questions or reviewing recommendations to credit the remaining{' '}
              <strong>{remainingMinutes} minute{remainingMinutes === 1 ? '' : 's'}</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Streak Milestones Roadmap */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Consistency Milestone Roadmap</h3>
          <p className="text-xs text-slate-500">
            Maintain daily learning habits to unlock milestone badges and celebrate consistency
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STREAK_MILESTONES.map((m) => {
            const isUnlocked = currentStreak >= m.days;
            const isCurrentTarget = nextMilestone === m.days;

            return (
              <div
                key={m.days}
                className={`p-4 rounded-xl border transition-all ${
                  isUnlocked
                    ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                    : isCurrentTarget
                    ? 'border-[#0a66c2] bg-blue-50/30 text-slate-900 shadow-xs ring-1 ring-[#0a66c2]/20'
                    : 'border-slate-200 bg-slate-50/30 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">
                    {m.days} Days Streak
                  </span>
                  {isUnlocked ? (
                    <Badge variant="success" size="sm">
                      Unlocked ✓
                    </Badge>
                  ) : isCurrentTarget ? (
                    <Badge variant="primary" size="sm">
                      Next Goal
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm">
                      Locked
                    </Badge>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-800">{m.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{m.reward}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak Consistency Rules Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Streak Consistency Rules</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          To ensure genuine engineering skill improvement, CareerSaathi AI streaks are evaluated daily to build consistent engineering habits:
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-600">
          <li className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-bold text-[#0a66c2] mt-0.5">1.</span>
            <span>
              <strong>15-Minute Threshold:</strong> At least 900 seconds of active learning is required in a single calendar day.
            </span>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-bold text-[#0a66c2] mt-0.5">2.</span>
            <span>
              <strong>Anti-Idle Protection:</strong> Inactive tabs or idle gaps exceeding 120 seconds are automatically discarded.
            </span>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-bold text-[#0a66c2] mt-0.5">3.</span>
            <span>
              <strong>Indian Standard Time (IST):</strong> Calendar days reset strictly at midnight Indian Standard Time (IST).
            </span>
          </li>
          <li className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-bold text-[#0a66c2] mt-0.5">4.</span>
            <span>
              <strong>Eligible Activities:</strong> Time is credited when practicing tests, analyzing performance, or reviewing recommendations.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
