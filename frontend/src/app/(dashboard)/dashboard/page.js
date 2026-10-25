'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatPercentage, getTopicColor } from '@/lib/utils';
import { MetricCard } from '@/components/shared/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  FileText,
  Flame,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  useHeartbeat('dashboard_learning');
  const userRole = user?.role || 'student';
  const [loading, setLoading] = useState(userRole === 'student');
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    if (userRole !== 'student') {
      return;
    }

    async function load() {
      try {
        const res = await api.get('/progress/dashboard');
        if (!ignore) {
          if (res?.success && res.data) {
            setDashboardData(res.data);
            setError(null);
          } else {
            setError('Failed to load dashboard metrics');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot connect to backend server. Please verify the service is running.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [userRole, reloadIndex]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  // If user is Trainer or Admin, display role permissions view (Phase 5/6 scope)
  if (userRole !== 'student') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome, {user?.name || 'User'}
                </h1>
                <Badge
                  variant={userRole === 'admin' ? 'warning' : 'success'}
                  size="sm"
                >
                  {userRole.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                You are authenticated with administrative privileges. Dedicated console views are scheduled for upcoming phases.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <Shield className="w-4 h-4 text-[#0a66c2]" />
            <span>Role Console Roadmap</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Phase 3 implements the Student Assessment workflows. Trainer and Admin dashboards will connect to the live backend in Phases 5 and 6:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="font-semibold text-slate-800 block mb-1">Phase 5: Trainer Dashboard</span>
              <span className="text-slate-500">Student roster, manual grading workflows, and coaching feedback.</span>
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="font-semibold text-slate-800 block mb-1">Phase 6: Admin Dashboard</span>
              <span className="text-slate-500">User governance, trainer assignments, audit logs, and platform KPIs.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Dashboard Error</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">{error}</p>
        <Button onClick={handleRetry} variant="secondary" icon={RotateCcw}>
          Retry Loading
        </Button>
      </div>
    );
  }

  const { kpis, streak, activity, weakTopics = [], strongTopics = [], recentAssessments = [] } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Welcome back, {user?.name || 'Student'}
              </h1>
              <Badge variant="primary" size="sm">
                Student
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Target Role: <strong className="text-slate-900 font-semibold">{user?.careerProfile?.targetRole || 'Full Stack Developer'}</strong>
              {activity?.lastAssessmentDate && (
                <span className="text-slate-400 ml-2">
                  • Last active {formatDate(activity.lastAssessmentDate)}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/assessments">
              <Button icon={Sparkles}>
                Take Assessment
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Assessments"
          value={kpis?.totalAssessmentsTaken ?? 0}
          icon={FileText}
          variant="primary"
          subtitle={`${kpis?.completedAssessments ?? 0} completed • ${kpis?.inProgressAssessments ?? 0} in progress`}
        />

        <MetricCard
          title="Overall Accuracy"
          value={kpis?.averageOverallPercentage !== null && kpis?.averageOverallPercentage !== undefined ? `${kpis.averageOverallPercentage}%` : 'N/A'}
          icon={TrendingUp}
          variant="success"
          subtitle={kpis?.bestOverallPercentage !== null && kpis?.bestOverallPercentage !== undefined ? `Best score: ${kpis.bestOverallPercentage}%` : 'Complete assessments to record accuracy'}
        />

        <MetricCard
          title="Day Streak"
          value={`${streak?.currentStreak ?? 0}d`}
          icon={Flame}
          variant="warning"
          subtitle={streak?.isActiveToday ? 'Activity recorded today! 🔥' : 'Practice today to maintain streak'}
        />

        <MetricCard
          title="Practice Days"
          value={activity?.totalPracticeDays ?? 0}
          icon={Calendar}
          variant="info"
          subtitle={`${activity?.completedThisWeek ?? 0} tests completed this week`}
        />
      </div>

      {/* Diagnostic Insights: Weak & Strong Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weak Topics */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Topics Needing Focus (&lt;60% accuracy)</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">{weakTopics.length} detected</span>
          </div>

          {weakTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {weakTopics.map((topic) => {
                const colors = getTopicColor(topic);
                return (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {topic}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 pt-1">
              No weak topics detected. Keep practicing across diverse topics to track skill gaps.
            </p>
          )}
        </div>

        {/* Strong Topics */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Mastered Topics (≥75% accuracy)</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">{strongTopics.length} detected</span>
          </div>

          {strongTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {strongTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 pt-1">
              Complete at least 3 questions in a topic with 75%+ score to qualify as mastered.
            </p>
          )}
        </div>
      </div>

      {/* Recent Assessments Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Assessments</h3>
            <p className="text-xs text-slate-500">Your latest assessment attempts and evaluation scores</p>
          </div>
          <Link href="/dashboard/assessments">
            <Button variant="outline" size="sm" icon={ArrowRight}>
              View All Assessments
            </Button>
          </Link>
        </div>

        {recentAssessments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Target Role</TableHead>
                <TableHead>Topics Covered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAssessments.map((a) => {
                const isInProgress = a.status === 'in_progress';
                const hasScore = a.scoring?.overallPercentage !== undefined && a.scoring?.overallPercentage !== null;

                return (
                  <TableRow key={a.assessmentId}>
                    <TableCell className="font-semibold text-slate-900">
                      {a.targetRole || 'Full Stack Developer'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(a.selectedTopics) && a.selectedTopics.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isInProgress ? 'warning' : 'success'}
                        size="sm"
                        dot
                      >
                        {isInProgress ? 'In Progress' : 'Completed'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isInProgress ? (
                        <span className="text-xs text-slate-400 italic">Not evaluated</span>
                      ) : (
                        <span className="font-semibold text-slate-900">
                          {hasScore ? `${a.scoring.overallPercentage}%` : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(a.completedAt || a.startedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress ? (
                        <Link href={`/dashboard/assessments/${a.assessmentId}`}>
                          <Button size="sm" variant="primary" icon={Play}>
                            Resume
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/dashboard/assessments/${a.assessmentId}/results`}>
                          <Button size="sm" variant="secondary">
                            View Results
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={FileText}
            title="No assessments taken yet"
            description="Start your first skill assessment to diagnose your technical knowledge and get personalized AI feedback."
            action={
              <Link href="/dashboard/assessments">
                <Button icon={Sparkles}>
                  Generate First Assessment
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
