'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  BarChart3,
  TrendingUp,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Layers,
  Award,
} from 'lucide-react';

export default function PlatformAnalyticsPage() {
  const { user: currentAdmin } = useAuth();
  const isAdmin = currentAdmin?.role === 'admin';

  // Analytics Overview State
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Platform Assessments Log State
  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [assessmentsTotal, setAssessmentsTotal] = useState(0);
  const [assessmentsPage, setAssessmentsPage] = useState(1);
  const [assessmentsTotalPages, setAssessmentsTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [evalFilter, setEvalFilter] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Fetch Platform Analytics Overview
  useEffect(() => {
    let ignore = false;
    async function loadOverview() {
      if (!isAdmin) return;
      try {
        setLoadingOverview(true);
        setOverviewError(null);
        const res = await api.get('/admin/analytics/overview');
        if (!ignore && res?.success) {
          setOverview(res.data);
        } else if (!ignore) {
          setOverviewError(res?.message || 'Failed to fetch analytics overview');
        }
      } catch (err) {
        if (!ignore) setOverviewError(err.message || 'Error loading platform analytics');
      } finally {
        if (!ignore) setLoadingOverview(false);
      }
    }
    loadOverview();
    return () => {
      ignore = true;
    };
  }, [isAdmin, reloadTrigger]);

  // Fetch Paginated Platform Assessments
  useEffect(() => {
    let ignore = false;
    async function loadAssessments() {
      if (!isAdmin) return;
      try {
        setLoadingAssessments(true);
        const params = new URLSearchParams();
        params.append('page', assessmentsPage.toString());
        params.append('limit', '10');
        if (statusFilter) params.append('status', statusFilter);
        if (evalFilter) params.append('isFullyEvaluated', evalFilter);

        const res = await api.get(`/admin/assessments?${params.toString()}`);
        if (!ignore && res?.success) {
          setAssessments(res.data || []);
          setAssessmentsTotal(res.total || 0);
          setAssessmentsTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        if (!ignore) console.error('Failed to load assessments', err);
      } finally {
        if (!ignore) setLoadingAssessments(false);
      }
    }
    loadAssessments();
    return () => {
      ignore = true;
    };
  }, [isAdmin, assessmentsPage, statusFilter, evalFilter, reloadTrigger]);

  // Unauthorized guard
  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          You do not have administrative privileges to access Platform Analytics.
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const {
    totalCompleted = 0,
    fullyEvaluatedCount = 0,
    pendingEvaluationCount = 0,
    averages = {},
    scoreDistribution = {},
    topWeakTopics = [],
  } = overview || {};

  const totalEvaluatedForBuckets =
    (scoreDistribution.under50 || 0) +
    (scoreDistribution.between50and69 || 0) +
    (scoreDistribution.between70and84 || 0) +
    (scoreDistribution.between85and100 || 0);

  const getBucketPct = (count) => {
    if (!totalEvaluatedForBuckets || !count) return 0;
    return Math.round((count / totalEvaluatedForBuckets) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                System Analytics &amp; Performance
              </h1>
              <Badge variant="warning" size="sm">
                Admin Console
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Platform-wide assessment performance distribution, AI evaluation metrics, and topic weakness trends.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => setReloadTrigger((p) => p + 1)}
            >
              Refresh Analytics
            </Button>
          </div>
        </div>
      </div>

      {overviewError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{overviewError}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadTrigger((p) => p + 1)}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Completed Tests</span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#0a66c2]">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{totalCompleted}</h3>
          <p className="text-xs text-slate-400 mt-1">Platform-wide assessments</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Average Platform GPA</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            {averages.overallPercentage !== null && averages.overallPercentage !== undefined
              ? `${averages.overallPercentage}%`
              : 'N/A'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Obj: {averages.objectivePercentage ?? 0}% • Subj: {averages.subjectivePercentage ?? 0}%
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">AI Evaluation Ratio</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            {fullyEvaluatedCount} / {totalCompleted}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {pendingEvaluationCount === 0 ? 'All tests evaluated' : `${pendingEvaluationCount} pending evaluation`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">High Mastery Rate</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            {getBucketPct(scoreDistribution.between85and100)}%
          </h3>
          <p className="text-xs text-slate-400 mt-1">Scored ≥ 85% overall</p>
        </div>
      </div>

      {/* Two Column Layout: Score Distribution & Weak Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Score Distribution Tiers</h3>
              <p className="text-xs text-slate-500">Based on evaluated completed tests</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {totalEvaluatedForBuckets} Evaluated Tests
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {/* Tier 1: Under 50% */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-rose-700 flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  Under 50% (Needs Remediation)
                </span>
                <span className="text-slate-900 font-bold">
                  {scoreDistribution.under50 || 0} ({getBucketPct(scoreDistribution.under50)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${getBucketPct(scoreDistribution.under50)}%` }}
                />
              </div>
            </div>

            {/* Tier 2: 50% - 69% */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-amber-700 flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  50% – 69% (Developing Proficiency)
                </span>
                <span className="text-slate-900 font-bold">
                  {scoreDistribution.between50and69 || 0} ({getBucketPct(scoreDistribution.between50and69)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${getBucketPct(scoreDistribution.between50and69)}%` }}
                />
              </div>
            </div>

            {/* Tier 3: 70% - 84% */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-[#0a66c2] flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#0a66c2]" />
                  70% – 84% (Proficient)
                </span>
                <span className="text-slate-900 font-bold">
                  {scoreDistribution.between70and84 || 0} ({getBucketPct(scoreDistribution.between70and84)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0a66c2] rounded-full transition-all duration-500"
                  style={{ width: `${getBucketPct(scoreDistribution.between70and84)}%` }}
                />
              </div>
            </div>

            {/* Tier 4: 85% - 100% */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-emerald-700 flex items-center gap-1.5 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  85% – 100% (High Mastery)
                </span>
                <span className="text-slate-900 font-bold">
                  {scoreDistribution.between85and100 || 0} ({getBucketPct(scoreDistribution.between85and100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${getBucketPct(scoreDistribution.between85and100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Platform Weak Topics */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Knowledge Gap Hotspots</h3>
              <p className="text-xs text-slate-500">Most frequent weak topics across platform tests</p>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
              {topWeakTopics.length} Identified
            </span>
          </div>

          {topWeakTopics.length > 0 ? (
            <div className="space-y-3 pt-1">
              {topWeakTopics.slice(0, 6).map((item, idx) => (
                <div key={item.topic} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{item.topic}</span>
                  </div>
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {item.count} occurrences
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No weak topics detected across completed assessments. Overall performance is strong.
            </div>
          )}
        </div>
      </div>

      {/* Platform Assessments Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Platform Assessment Log</h3>
            <p className="text-xs text-slate-500">Audit trail of all generated, in-progress, and submitted tests</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setAssessmentsPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="abandoned">Abandoned</option>
            </select>

            <select
              value={evalFilter}
              onChange={(e) => {
                setEvalFilter(e.target.value);
                setAssessmentsPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
            >
              <option value="">All Evaluations</option>
              <option value="true">Fully Evaluated</option>
              <option value="false">Pending AI</option>
            </select>
          </div>
        </div>

        {loadingAssessments ? (
          <div className="p-8 space-y-3 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/4" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        ) : assessments.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Student</th>
                    <th className="py-3 px-4 font-semibold">Target Role</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Overall Score</th>
                    <th className="py-3 px-4 font-semibold">Evaluation</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assessments.map((a) => (
                    <tr key={a._id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{a.student?.name || 'Anonymous'}</p>
                        <p className="text-xs text-slate-400">{a.student?.email || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {a.targetRole || 'Full Stack Developer'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            a.status === 'completed'
                              ? 'success'
                              : a.status === 'in_progress'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                          dot
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {a.status === 'completed' && a.scoring?.overallPercentage !== undefined
                          ? `${a.scoring.overallPercentage}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {a.status === 'completed' ? (
                          <Badge
                            variant={a.scoring?.isFullyEvaluated ? 'success' : 'warning'}
                            size="sm"
                          >
                            {a.scoring?.isFullyEvaluated ? 'Evaluated' : 'Pending AI'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {formatDate(a.completedAt || a.startedAt || a.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/dashboard/assessments/${a._id}/results`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
                            View Results
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page <span className="font-semibold text-slate-900">{assessmentsPage}</span> of{' '}
                <span className="font-semibold text-slate-900">{assessmentsTotalPages}</span> (
                {assessmentsTotal} assessments)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assessmentsPage <= 1}
                  onClick={() => setAssessmentsPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assessmentsPage >= assessmentsTotalPages}
                  onClick={() => setAssessmentsPage((p) => Math.min(assessmentsTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            No assessments found matching the chosen criteria.
          </div>
        )}
      </div>
    </div>
  );
}
