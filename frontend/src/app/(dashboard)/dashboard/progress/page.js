'use client';

import React, { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { api } from '@/lib/api';
import { formatDate, formatPercentage, getTopicColor, getMasteryBadge } from '@/lib/utils';
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
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';

const TOPIC_LIST = ['JavaScript', 'React', 'Node.js', 'MongoDB'];

export default function ProgressAnalyticsPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'student';
  const isStudent = userRole === 'student';

  // Active learning heartbeat tracking
  useHeartbeat('progress');

  // Page data states
  const [loading, setLoading] = useState(isStudent);
  const [error, setError] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [dashboardKpis, setDashboardKpis] = useState(null);
  const [trendPoints, setTrendPoints] = useState([]);
  const [evaluatedOnly, setEvaluatedOnly] = useState(true);
  const [topicAnalytics, setTopicAnalytics] = useState(null);

  // History pagination & filters
  const [historyItems, setHistoryItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Hover state for interactive SVG trend chart
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgGradientId = useId();

  // Load primary analytics data
  useEffect(() => {
    let ignore = false;
    if (!isStudent) return;

    async function loadData() {
      try {
        const [dashRes, trendsRes, topicsRes] = await Promise.all([
          api.get('/progress/dashboard'),
          api.get(`/progress/trends?evaluatedOnly=${evaluatedOnly}&limit=20`),
          api.get('/progress/topics'),
        ]);

        if (!ignore) {
          if (dashRes?.success && dashRes.data) {
            setDashboardKpis(dashRes.data);
          }
          if (trendsRes?.success && Array.isArray(trendsRes.data)) {
            setTrendPoints(trendsRes.data);
          }
          if (topicsRes?.success && topicsRes.data) {
            setTopicAnalytics(topicsRes.data);
          }
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load progress metrics. Please verify backend connection.');
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [isStudent, evaluatedOnly, reloadIndex]);

  // Load paginated assessment history
  useEffect(() => {
    let ignore = false;
    if (!isStudent) return;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        const queryParams = new URLSearchParams({
          page: String(historyPage),
          limit: '8',
        });
        if (statusFilter !== 'all') queryParams.set('status', statusFilter);
        if (topicFilter) queryParams.set('topic', topicFilter);

        const res = await api.get(`/progress/history?${queryParams.toString()}`);
        if (!ignore && res?.success) {
          setHistoryItems(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      } catch (_) {
        // Soft error for history table
      } finally {
        if (!ignore) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => {
      ignore = true;
    };
  }, [isStudent, historyPage, statusFilter, topicFilter, reloadIndex]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  // If Trainer / Admin
  if (!isStudent) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs max-w-xl mx-auto space-y-3">
        <div className="p-3 bg-blue-50 text-[#0a66c2] rounded-full inline-flex">
          <TrendingUp className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Student Progress Portal</h2>
        <p className="text-xs text-slate-600">
          This analytics console displays personal assessment mastery and progression for students. As a{' '}
          <strong className="capitalize text-slate-900">{userRole}</strong>, student progress is aggregated in your dedicated console.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-28 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-80 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
        <div className="p-3 rounded-full bg-rose-50 text-rose-600 inline-flex mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Unable to Load Progress</h3>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <Button variant="secondary" onClick={handleRetry} icon={RotateCcw}>
          Retry Loading
        </Button>
      </div>
    );
  }

  const kpis = dashboardKpis?.kpis || {};
  const topicsData = topicAnalytics?.topics || [];
  const topicSummary = topicAnalytics?.summary || {};

  // Render SVG Chart for trends
  const renderTrendChart = () => {
    if (trendPoints.length === 0) {
      return (
        <div className="py-16 text-center text-slate-500 space-y-2">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No Assessment Trend Data Yet</p>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            {evaluatedOnly
              ? 'Complete and evaluate at least one assessment to track your score progression over time.'
              : 'Complete an assessment to start recording performance history.'}
          </p>
          {evaluatedOnly && (
            <button
              type="button"
              onClick={() => setEvaluatedOnly(false)}
              className="text-xs text-[#0a66c2] font-semibold hover:underline mt-2 inline-block cursor-pointer"
            >
              Include partially evaluated tests
            </button>
          )}
        </div>
      );
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const pointsCount = trendPoints.length;
    const getX = (idx) => {
      if (pointsCount === 1) return padding.left + chartWidth / 2;
      return padding.left + (idx / (pointsCount - 1)) * chartWidth;
    };

    const getY = (score) => {
      const pct = Math.max(0, Math.min(100, score));
      return padding.top + chartHeight - (pct / 100) * chartHeight;
    };

    // Build SVG path
    const pathD = trendPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.overallPercentage)}`)
      .join(' ');

    const areaD = `${pathD} L ${getX(pointsCount - 1)} ${padding.top + chartHeight} L ${getX(0)} ${
      padding.top + chartHeight
    } Z`;

    return (
      <div className="space-y-3">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
              <defs>
                <linearGradient id={svgGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a66c2" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0a66c2" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines: 0%, 25%, 50%, 75%, 100% */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = getY(val);
                return (
                  <g key={val}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={val === 0 || val === 100 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono font-medium"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area Fill */}
              {pointsCount > 1 && <path d={areaD} fill={`url(#${svgGradientId})`} />}

              {/* Score Trend Line */}
              {pointsCount > 1 && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#0a66c2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {trendPoints.map((p, idx) => {
                const cx = getX(idx);
                const cy = getY(p.overallPercentage);
                const isHovered = hoveredPoint?.idx === idx;

                return (
                  <g key={p.assessmentId || idx}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill="#ffffff"
                      stroke="#0a66c2"
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredPoint({ ...p, idx, cx, cy })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    {/* X-axis date labels */}
                    <text
                      x={cx}
                      y={padding.top + chartHeight + 20}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-500 font-sans"
                    >
                      {formatDate(p.date)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-1 w-44"
                style={{
                  left: `${(hoveredPoint.cx / width) * 100}%`,
                  top: `${(hoveredPoint.cy / height) * 100 - 8}%`,
                }}
              >
                <div className="flex justify-between font-bold border-b border-slate-700 pb-1">
                  <span>Score:</span>
                  <span className="text-emerald-400">{hoveredPoint.overallPercentage}%</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>Date:</span>
                  <span>{formatDate(hoveredPoint.date)}</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>MCQ:</span>
                  <span>{hoveredPoint.objectivePercentage}%</span>
                </div>
                {hoveredPoint.topics?.length > 0 && (
                  <p className="text-[10px] text-slate-400 truncate">
                    {hoveredPoint.topics.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#0a66c2] rounded-full inline-block" />
              Overall Score (%)
            </span>
            <span className="text-slate-400">• Showing last {trendPoints.length} tests</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Mode:</span>
            <button
              type="button"
              onClick={() => setEvaluatedOnly(!evaluatedOnly)}
              className="text-xs text-[#0a66c2] font-semibold hover:underline cursor-pointer"
            >
              {evaluatedOnly ? 'Showing Fully Evaluated' : 'Showing All Completed'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Progress &amp; Skill Analytics
              </h1>
              <Badge variant="primary" size="sm">
                Student
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Track your role-based skill progression, topic mastery distributions, and assessment history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/assessments">
              <Button size="sm" icon={Sparkles}>
                Take Assessment
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Completed Assessments"
          value={kpis.completedAssessments ?? 0}
          icon={FileText}
          variant="primary"
          subtitle={`${kpis.inProgressAssessments ?? 0} currently in progress`}
        />

        <MetricCard
          title="Overall Average Score"
          value={kpis.averageOverallPercentage !== null && kpis.averageOverallPercentage !== undefined ? `${kpis.averageOverallPercentage}%` : 'N/A'}
          icon={TrendingUp}
          variant="success"
          subtitle={kpis.bestOverallPercentage !== null && kpis.bestOverallPercentage !== undefined ? `Best score: ${kpis.bestOverallPercentage}%` : 'Take assessments to benchmark'}
        />

        <MetricCard
          title="Objective Accuracy (MCQ)"
          value={kpis.objectiveAveragePercentage !== null && kpis.objectiveAveragePercentage !== undefined ? `${kpis.objectiveAveragePercentage}%` : 'N/A'}
          icon={CheckCircle2}
          variant="info"
          subtitle="Mean accuracy across multiple-choice questions"
        />

        <MetricCard
          title="Subjective Depth (AI)"
          value={kpis.subjectiveAveragePercentage !== null && kpis.subjectiveAveragePercentage !== undefined ? `${kpis.subjectiveAveragePercentage}%` : 'N/A'}
          icon={Award}
          variant="warning"
          subtitle={kpis.pendingEvaluationAssessments ? `${kpis.pendingEvaluationAssessments} test(s) pending AI review` : 'Mean score across evaluated text answers'}
        />
      </div>

      {/* Score Progression Trendline Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Score Progression Over Time</h3>
            <p className="text-xs text-slate-500">
              Chronological score percentage trends across your technical assessments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEvaluatedOnly(true)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer border ${
                evaluatedOnly
                  ? 'bg-blue-50 text-[#0a66c2] border-blue-200 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Evaluated Tests Only
            </button>
            <button
              type="button"
              onClick={() => setEvaluatedOnly(false)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer border ${
                !evaluatedOnly
                  ? 'bg-blue-50 text-[#0a66c2] border-blue-200 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Tests
            </button>
          </div>
        </div>

        {renderTrendChart()}
      </div>

      {/* Topic Mastery & Diagnostic Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Topic Mastery Analytics</h3>
            <p className="text-xs text-slate-500">
              Aggregate accuracy and question mastery per engineering topic
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Badge variant="success" size="sm">
              {topicSummary.strongTopicsCount || 0} Strong
            </Badge>
            <Badge variant="info" size="sm">
              {topicSummary.developingTopicsCount || 0} Developing
            </Badge>
            <Badge variant="danger" size="sm">
              {topicSummary.weakTopicsCount || 0} Needs Focus
            </Badge>
          </div>
        </div>

        {topicsData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topicsData.map((t) => {
              const mastery = getMasteryBadge(t.status);
              const pct = t.accuracyPercentage !== null ? t.accuracyPercentage : 0;

              return (
                <div
                  key={t.topic}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.topic}</span>
                      <Badge variant={mastery.variant} size="sm">
                        {mastery.label}
                      </Badge>
                    </div>

                    <span className="font-bold text-slate-900 text-base">
                      {t.accuracyPercentage !== null ? `${t.accuracyPercentage}%` : 'Pending'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 75
                          ? 'bg-emerald-600'
                          : pct >= 60
                          ? 'bg-[#0a66c2]'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Metrics subtext */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                      {t.totalQuestionsAttempted} questions attempted ({t.assessmentsCount} tests)
                    </span>
                    <span>
                      {t.pointsEarned} / {t.maxPoints} pts earned
                    </span>
                  </div>

                  {t.pendingQuestionsCount > 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                      ℹ️ {t.pendingQuestionsCount} question(s) awaiting AI rubric evaluation
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Layers}
            title="No topic analytics yet"
            description="Complete assessments to begin generating topic-specific diagnostic mastery reports."
            action={
              <Link href="/dashboard/assessments">
                <Button size="sm" icon={Sparkles}>
                  Generate Assessment
                </Button>
              </Link>
            }
          />
        )}
      </div>

      {/* Filterable Assessment History Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Historical Assessment Log</h3>
            <p className="text-xs text-slate-500">
              Paginated record of completed and in-progress assessment runs
            </p>
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="h-9 text-xs rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0a66c2]"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed Only</option>
              <option value="in_progress">In Progress</option>
            </select>

            <select
              value={topicFilter}
              onChange={(e) => {
                setTopicFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="h-9 text-xs rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0a66c2]"
            >
              <option value="">All Topics</option>
              {TOPIC_LIST.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* History Table */}
        {historyLoading ? (
          <div className="py-12 text-center space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading history records...</p>
          </div>
        ) : historyItems.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>Target Role</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Overall Score</TableHead>
                  <TableHead>MCQ Accuracy</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => {
                  const isInProgress = item.status === 'in_progress';
                  const hasScore =
                    item.scoring?.overallPercentage !== undefined &&
                    item.scoring?.overallPercentage !== null;

                  return (
                    <TableRow key={item.assessmentId}>
                      <TableCell className="font-semibold text-slate-900">
                        {item.targetRole || 'Full Stack Developer'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.isArray(item.selectedTopics) &&
                            item.selectedTopics.map((tp) => (
                              <span
                                key={tp}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {tp}
                              </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isInProgress ? 'warning' : 'success'} size="sm" dot>
                          {isInProgress ? 'In Progress' : 'Completed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isInProgress ? (
                          <span className="text-xs text-slate-400 italic">Unsubmitted</span>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {hasScore ? `${item.scoring.overallPercentage}%` : 'Pending'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {item.scoring?.objectivePercentage !== undefined
                          ? `${item.scoring.objectivePercentage}%`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(item.completedAt || item.startedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isInProgress ? (
                          <Link href={`/dashboard/assessments/${item.assessmentId}`}>
                            <Button size="sm" variant="primary">
                              Resume
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/dashboard/assessments/${item.assessmentId}/results`}>
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

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrevPage}
                    icon={ChevronLeft}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setHistoryPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasNextPage}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No records matching filter"
            description="Try switching the status or topic filter to view other assessments."
          />
        )}
      </div>
    </div>
  );
}
