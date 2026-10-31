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
  Users,
  UserCheck,
  ShieldCheck,
  BarChart3,
  ScrollText,
} from 'lucide-react';

function formatSafeScore(val) {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  useHeartbeat('dashboard_learning');
  const userRole = user?.role || 'student';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [trainerData, setTrainerData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        if (userRole === 'student') {
          const res = await api.get('/progress/dashboard');
          if (!ignore) {
            if (res?.success && res.data) {
              setDashboardData(res.data);
              setError(null);
            } else {
              setError('Failed to load dashboard metrics');
            }
          }
        } else if (userRole === 'trainer') {
          const res = await api.get('/trainer/dashboard');
          if (!ignore) {
            if (res?.success && res.data) {
              setTrainerData(res.data);
              setError(null);
            } else {
              setError('Failed to load trainer cohort metrics');
            }
          }
        } else if (userRole === 'admin') {
          const res = await api.get('/admin/dashboard');
          if (!ignore) {
            if (res?.success && res.data) {
              setAdminData(res.data);
              setError(null);
            } else {
              setError('Failed to load admin platform metrics');
            }
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot connect to backend server. Please verify the service is running.');
        }
      } finally {
        if (!ignore) {
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
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

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

  // TRAINER DASHBOARD VIEW
  if (userRole === 'trainer') {
    const { cohort, weakTopics = [], strongTopics = [], recentSubmissions = [] } = trainerData || {};

    return (
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome, {user?.name || 'Trainer'}
                </h1>
                <Badge variant="success" size="sm">
                  Trainer Console
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                Monitor assigned students, manage questions, and configure AI-evaluated assessments.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link href="/dashboard/students">
                <Button variant="outline" size="sm">
                  Students & Progress
                </Button>
              </Link>
              <Link href="/dashboard/questions">
                <Button variant="outline" size="sm">
                  Question Bank
                </Button>
              </Link>
              <Link href="/dashboard/assessments">
                <Button size="sm">
                  Assessments
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Primary KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Assigned Students"
            value={cohort?.assignedStudentsCount ?? 0}
            icon={Calendar}
            variant="primary"
            subtitle={`${cohort?.activeStudentsCount ?? 0} active in trailing 7 days`}
          />

          <MetricCard
            title="Cohort Accuracy"
            value={cohort?.cohortAveragePercentage !== null && cohort?.cohortAveragePercentage !== undefined ? `${cohort.cohortAveragePercentage}%` : 'N/A'}
            icon={TrendingUp}
            variant="success"
            subtitle={`Obj: ${cohort?.cohortObjectiveAverage ?? 0}% • Desc: ${cohort?.cohortSubjectiveAverage ?? 0}%`}
          />

          <MetricCard
            title="Completed Tests"
            value={cohort?.totalAssessmentsCompleted ?? 0}
            icon={FileText}
            variant="info"
            subtitle="Automatically evaluated by AI"
          />

          <MetricCard
            title="AI Evaluation"
            value={cohort?.pendingAiEvaluation === 0 ? 'All Evaluated' : `${cohort?.pendingAiEvaluation} Pending`}
            icon={Sparkles}
            variant={cohort?.pendingAiEvaluation > 0 ? 'warning' : 'success'}
            subtitle={cohort?.needingTrainerReview > 0 ? `${cohort.needingTrainerReview} need attention (<60%)` : 'All students on track'}
          />
        </div>

        {/* Cohort Topic Diagnostics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Cohort Weak Topics (&lt;60% accuracy)</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">{weakTopics.length} detected</span>
            </div>

            {weakTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {weakTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-1">
                No weak topics detected across your cohort. Great overall performance!
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Cohort Mastered Topics (≥75% accuracy)</h3>
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
                Students must score ≥75% on at least 3 questions to establish topic mastery.
              </p>
            )}
          </div>
        </div>

        {/* Recent Student Submissions Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Student Activity</h3>
              <p className="text-xs text-slate-500">Latest completed assessments evaluated automatically by AI</p>
            </div>
            <Link href="/dashboard/assessments">
              <Button variant="outline" size="sm" icon={ArrowRight}>
                View All Cohort Assessments
              </Button>
            </Link>
          </div>

          {recentSubmissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>Student</TableHead>
                  <TableHead>Topics Covered</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>AI Evaluation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubmissions.map((sub, idx) => (
                  <TableRow key={sub._id || `sub-${idx}`}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">{sub.studentName}</p>
                        <p className="text-xs text-slate-500">{sub.studentEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(sub.selectedTopics) && sub.selectedTopics.map((t) => (
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
                      <span className="font-bold text-slate-900">
                        {sub.overallPercentage !== undefined ? `${sub.overallPercentage}%` : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sub.isFullyEvaluated ? 'success' : 'warning'}
                        size="sm"
                        dot
                      >
                        {sub.isFullyEvaluated ? 'Evaluated' : 'Pending AI'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(sub.completedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/assessments/${sub._id}/results`}>
                        <Button size="sm" variant="secondary">
                          View Results
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FileText}
              title="No recent submissions"
              description="Assigned students have not submitted any completed assessments yet."
              action={
                <Link href="/dashboard/students">
                  <Button variant="secondary">
                    View Student Roster
                  </Button>
                </Link>
              }
            />
          )}
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/students" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#0a66c2]">
                  <Calendar className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  Students & Progress
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Track assigned students, view individual test history, and analyze skill mastery.
              </p>
            </div>
          </Link>

          <Link href="/dashboard/questions" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  Question Bank
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Curate MCQ and descriptive questions, configure options and rubrics for AI evaluation.
              </p>
            </div>
          </Link>

          <Link href="/dashboard/assessments" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  Assessment Management
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Configure and generate assessments across MCQ, Typing, and Mixed modes for your cohort.
              </p>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD VIEW
  if (userRole === 'admin') {
    const {
      userCounts = {},
      assignmentStats = {},
      assessmentStats = {},
      platformPerformance = {},
      recentActivity = {},
    } = adminData || {};

    const topWeakTopics = platformPerformance.topWeakTopics || [];
    const latestUsers = recentActivity.latestUsers || [];
    const latestAssessments = recentActivity.latestCompletedAssessments || [];

    return (
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome, {user?.name || 'Administrator'}
                </h1>
                <Badge variant="warning" size="sm">
                  Platform Admin
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                Centralized platform governance, trainer-student allocations, and real-time security audit trails.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/users">
                <Button variant="outline" size="sm" icon={Users}>
                  User Governance
                </Button>
              </Link>
              <Link href="/dashboard/assignments">
                <Button variant="outline" size="sm" icon={UserCheck}>
                  Assignments
                </Button>
              </Link>
              <Link href="/dashboard/analytics">
                <Button variant="outline" size="sm" icon={BarChart3}>
                  Analytics
                </Button>
              </Link>
              <Link href="/dashboard/audit">
                <Button size="sm" icon={ScrollText}>
                  Audit Logs
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Platform Metric KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Platform Users"
            value={userCounts.totalUsers ?? 0}
            icon={Users}
            variant="primary"
            subtitle={`${userCounts.studentsCount ?? 0} Students • ${userCounts.trainersCount ?? 0} Trainers • ${userCounts.adminsCount ?? 0} Admins`}
          />

          <MetricCard
            title="Platform Average GPA"
            value={
              platformPerformance.averageOverallPercentage !== null && platformPerformance.averageOverallPercentage !== undefined
                ? `${platformPerformance.averageOverallPercentage}%`
                : 'N/A'
            }
            icon={TrendingUp}
            variant="success"
            subtitle={`Obj: ${platformPerformance.objectiveAveragePercentage ?? 0}% • Desc: ${platformPerformance.subjectiveAveragePercentage ?? 0}%`}
          />

          <MetricCard
            title="Completed Tests"
            value={assessmentStats.completedAssessments ?? 0}
            icon={FileText}
            variant="info"
            subtitle={`${assessmentStats.inProgressAssessments ?? 0} in-progress • ${assessmentStats.abandonedAssessments ?? 0} abandoned`}
          />

          <MetricCard
            title="AI Evaluation Status"
            value={
              assessmentStats.pendingEvaluationCount === 0
                ? 'All Evaluated'
                : `${assessmentStats.pendingEvaluationCount ?? 0} Pending`
            }
            icon={Sparkles}
            variant={assessmentStats.pendingEvaluationCount > 0 ? 'warning' : 'success'}
            subtitle={`${assessmentStats.fullyEvaluatedCount ?? 0} fully evaluated`}
          />
        </div>

        {/* Secondary Diagnostics & Workload Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* User Account Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#0a66c2]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Account Governance</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Status</span>
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Active Accounts</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">
                  {userCounts.activeUsersCount ?? 0} Active
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Deactivated Accounts</span>
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-xs border border-rose-200">
                  {userCounts.deactivatedUsersCount ?? 0} Deactivated
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Link href="/dashboard/users" className="text-xs font-semibold text-[#0a66c2] hover:underline inline-flex items-center gap-1">
                  Manage Directory <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Student-Trainer Allocation Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Student Allocations</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Workload</span>
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Assigned to Trainer</span>
                <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs border border-purple-200">
                  {assignmentStats.assignedStudentsCount ?? 0} Assigned
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Unassigned Pool</span>
                <span className={`font-semibold px-2 py-0.5 rounded text-xs border ${
                  (assignmentStats.unassignedStudentsCount ?? 0) > 0
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-slate-700 bg-slate-50 border-slate-200'
                }`}>
                  {assignmentStats.unassignedStudentsCount ?? 0} Unassigned
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Link href="/dashboard/assignments" className="text-xs font-semibold text-[#0a66c2] hover:underline inline-flex items-center gap-1">
                  Allocate Students <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Platform Weak Topics */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Top Platform Weak Topics</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">{topWeakTopics.length} topics</span>
            </div>
            {topWeakTopics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {topWeakTopics.slice(0, 5).map((item) => (
                  <span
                    key={item.topic}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    <span>{item.topic}</span>
                    <span className="bg-rose-200 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {item.count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-1">
                No weak topics flagged across platform assessments. Overall accuracy is high!
              </p>
            )}
          </div>
        </div>

        {/* Live Activity Grids: Latest Completed Tests & Latest Registrations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Completed Assessments */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Completed Tests</h3>
                <p className="text-xs text-slate-500">Evaluated automatically by AI across all cohorts</p>
              </div>
              <Link href="/dashboard/analytics">
                <Button variant="outline" size="sm" icon={ArrowRight}>
                  View Analytics
                </Button>
              </Link>
            </div>

            {latestAssessments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Evaluation</th>
                      <th className="py-2.5 px-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestAssessments.map((a) => (
                      <tr key={a._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900 text-xs">{a.student?.name || 'Anonymous'}</p>
                          <p className="text-[11px] text-slate-400">{a.student?.email || '—'}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700 font-medium">
                          {a.targetRole || 'Full Stack Developer'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-xs text-slate-900">
                            {a.overallPercentage !== undefined ? `${a.overallPercentage}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={a.isFullyEvaluated ? 'success' : 'warning'}
                            size="sm"
                            dot
                          >
                            {a.isFullyEvaluated ? 'Evaluated' : 'Pending'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                          {formatDate(a.completedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">
                No completed assessments recorded on the platform yet.
              </p>
            )}
          </div>

          {/* Latest Registered Users */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Latest Registered Users</h3>
                <p className="text-xs text-slate-500">New accounts across Student, Trainer, and Admin roles</p>
              </div>
              <Link href="/dashboard/users">
                <Button variant="outline" size="sm" icon={ArrowRight}>
                  View All Users
                </Button>
              </Link>
            </div>

            {latestUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900 text-xs">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'warning'
                                : u.role === 'trainer'
                                ? 'success'
                                : 'primary'
                            }
                            size="sm"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              u.isActive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                          {formatDate(u.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">
                No user registrations found.
              </p>
            )}
          </div>
        </div>

        {/* Admin Quick Governance Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/users" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#0a66c2]">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  User Directory
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Search, filter, activate/deactivate accounts, and update roles with administrative controls.
              </p>
            </div>
          </Link>

          <Link href="/dashboard/assignments" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  Trainer Allocations
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Manage trainer workloads, assign unassigned students, and execute batch student reassignments.
              </p>
            </div>
          </Link>

          <Link href="/dashboard/analytics" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  System Analytics
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Examine platform score distribution, AI evaluation metrics, and topic diagnostics.
              </p>
            </div>
          </Link>

          <Link href="/dashboard/audit" className="block group">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-[#0a66c2] hover:shadow-sm transition-all h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <ScrollText className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 group-hover:text-[#0a66c2] transition-colors">
                  Security Audit Logs
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Inspect tamper-proof administrative logs, state transitions, and audit records.
              </p>
            </div>
          </Link>
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

  const rawTargetRole = user?.careerProfile?.targetRole;
  const studentTargetRole =
    typeof rawTargetRole === 'string' && rawTargetRole.trim().length > 0
      ? rawTargetRole.trim()
      : 'Not specified';

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
              Target Role: <strong className="text-slate-900 font-semibold">{studentTargetRole}</strong>
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
              {recentAssessments.map((a, idx) => {
                const assessmentId = a.assessmentId || a._id;
                const isInProgress = a.status === 'in_progress';
                const isFullyEvaluated = Boolean(a.isFullyEvaluated ?? a.scoring?.isFullyEvaluated);
                const safeOverall = formatSafeScore(a.scoring?.overallPercentage);
                const safeObjective = formatSafeScore(a.scoring?.objectivePercentage);
                const assessmentRole =
                  typeof a.targetRole === 'string' && a.targetRole.trim().length > 0
                    ? a.targetRole.trim()
                    : 'General Assessment';

                return (
                  <TableRow key={assessmentId || `recent-${idx}`}>
                    <TableCell className="font-semibold text-slate-900">
                      {assessmentRole}
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
                        <span className="text-xs text-slate-400 italic">In Progress</span>
                      ) : isFullyEvaluated ? (
                        <span className="font-semibold text-slate-900">
                          {safeOverall !== null ? `${safeOverall}%` : '—'}
                        </span>
                      ) : safeObjective !== null ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{safeObjective}%</span>
                          <span className="text-[10px] text-amber-600 font-medium">Provisional (MCQ)</span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Evaluation Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(a.completedAt || a.startedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress ? (
                        <Link href={`/dashboard/assessments/${assessmentId}`}>
                          <Button size="sm" variant="primary" icon={Play}>
                            Resume
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/dashboard/assessments/${assessmentId}/results`}>
                          <Button size="sm" variant="secondary" icon={ArrowRight}>
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
