'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
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
  Users,
  Search,
  Filter,
  BarChart2,
  TrendingUp,
  FileText,
  Calendar,
  AlertTriangle,
  RotateCcw,
  X,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
} from 'lucide-react';

const SKILL_LEVELS = ['all', 'beginner', 'intermediate', 'advanced'];

export default function StudentsDirectoryPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'student';

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [skillLevel, setSkillLevel] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Detail Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [studentProgress, setStudentProgress] = useState(null);
  const [studentAssessments, setStudentAssessments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (userRole !== 'trainer' && userRole !== 'admin') {
      return;
    }

    async function load() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
        });
        if (search.trim()) params.append('search', search.trim());
        if (skillLevel !== 'all') params.append('skillLevel', skillLevel);

        const res = await api.get(`/trainer/students?${params.toString()}`);
        if (!ignore) {
          if (res?.success) {
            setStudents(res.students || []);
            setTotalPages(res.pages || 1);
            setTotalStudents(res.total || 0);
            setError(null);
          } else {
            setError('Failed to load students directory');
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot fetch assigned students from backend');
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
  }, [userRole, page, search, skillLevel, reloadIndex]);

  const fetchStudents = useCallback(() => {
    setLoading(true);
    setReloadIndex((i) => i + 1);
  }, []);

  // Load student diagnostic profile
  const handleOpenStudent = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const [profileRes, progressRes, assessmentsRes] = await Promise.all([
        api.get(`/trainer/students/${student._id}`),
        api.get(`/trainer/students/${student._id}/progress`),
        api.get(`/trainer/students/${student._id}/assessments?limit=5`),
      ]);

      if (profileRes?.success) setStudentDetails(profileRes.data);
      if (progressRes?.success) setStudentProgress(progressRes.data);
      if (assessmentsRes?.success) setStudentAssessments(assessmentsRes.data || []);
    } catch (err) {
      setDetailError(err.message || 'Failed to load student performance details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedStudent(null);
    setStudentDetails(null);
    setStudentProgress(null);
    setStudentAssessments([]);
    setDetailError(null);
  };

  // Role Protection
  if (userRole === 'student') {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center max-w-lg mx-auto shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-600 mb-4">
          The Student Roster and Performance tracking portal is reserved for trainers and platform administrators.
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Students & Progress
              </h1>
              <Badge variant="primary" size="sm">
                {totalStudents} {totalStudents === 1 ? 'Student' : 'Students'}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Review assigned students, analyze topic mastery diagnostics, and track AI-evaluated progress.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-[#0a66c2] bg-white text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Skill Level:</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {SKILL_LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  setSkillLevel(lvl);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                  skillLevel === lvl
                    ? 'bg-white text-[#0a66c2] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        {loading ? (
          <div className="space-y-3 animate-pulse py-4">
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900 mb-2">{error}</p>
            <Button onClick={fetchStudents} variant="secondary" size="sm" icon={RotateCcw}>
              Retry
            </Button>
          </div>
        ) : students.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>Student</TableHead>
                  <TableHead>Target Role</TableHead>
                  <TableHead>Skill Level</TableHead>
                  <TableHead>Tests Completed</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((st) => {
                  const acad = st.academicSummary || {};
                  const avg = acad.averageOverallPercentage;

                  return (
                    <TableRow key={st._id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">{st.name}</p>
                          <p className="text-xs text-slate-500">{st.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {st.careerProfile?.targetRole || 'Full Stack Developer'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            st.careerProfile?.currentSkillLevel === 'advanced'
                              ? 'success'
                              : st.careerProfile?.currentSkillLevel === 'intermediate'
                              ? 'primary'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {st.careerProfile?.currentSkillLevel || 'beginner'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{acad.completedAssessments ?? 0}</span>
                        <span className="text-xs text-slate-400 ml-1">/ {acad.totalAssessments ?? 0}</span>
                      </TableCell>
                      <TableCell>
                        {avg !== null && avg !== undefined ? (
                          <Badge
                            variant={avg >= 75 ? 'success' : avg >= 60 ? 'primary' : 'warning'}
                            size="sm"
                          >
                            {avg}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No tests</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {st.gamification?.lastActiveDate
                          ? formatDate(st.gamification.lastActiveDate)
                          : 'Inactive'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={BarChart2}
                          onClick={() => handleOpenStudent(st)}
                        >
                          View Analytics
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-sm">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No students found"
            description={
              search.trim()
                ? `No assigned students matching "${search}".`
                : 'No students currently assigned to your trainer cohort.'
            }
          />
        )}
      </div>

      {/* STUDENT PERFORMANCE MODAL */}
      <Modal
        isOpen={Boolean(selectedStudent)}
        onClose={handleCloseModal}
        title={selectedStudent ? `${selectedStudent.name} — Performance Profile` : 'Student Details'}
        size="lg"
      >
        {detailLoading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-16 bg-slate-100 rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 bg-slate-100 rounded-lg" />
              <div className="h-20 bg-slate-100 rounded-lg" />
              <div className="h-20 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-40 bg-slate-100 rounded-lg" />
          </div>
        ) : detailError ? (
          <div className="text-center py-6">
            <div className="inline-flex p-2.5 rounded-full bg-rose-50 text-rose-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900 mb-1">{detailError}</p>
          </div>
        ) : selectedStudent && (
          <div className="space-y-5">
            {/* Student Header Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400">Target Role</p>
                <h4 className="font-bold text-base text-slate-900">
                  {studentDetails?.student?.careerProfile?.targetRole || 'Full Stack Developer'}
                </h4>
                <p className="text-xs text-slate-500">
                  Timeline: {studentDetails?.student?.careerProfile?.targetTimeline || 'Not specified'} • Preferred Lang: {studentDetails?.student?.preferredLanguage?.toUpperCase() || 'EN'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {studentDetails?.student?.careerProfile?.currentSkillLevel || 'beginner'}
                </Badge>
                {studentDetails?.student?.gamification?.currentStreak > 0 && (
                  <Badge variant="warning" size="sm">
                    <Flame className="w-3 h-3 inline mr-1 text-amber-500" />
                    {studentDetails.student.gamification.currentStreak}d Streak
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Total Tests</p>
                <p className="text-lg font-bold text-slate-900">
                  {studentDetails?.summary?.completedAssessments ?? 0}
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Avg Score</p>
                <p className="text-lg font-bold text-emerald-600">
                  {studentDetails?.summary?.averageOverallPercentage !== null && studentDetails?.summary?.averageOverallPercentage !== undefined
                    ? `${studentDetails.summary.averageOverallPercentage}%`
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Best Score</p>
                <p className="text-lg font-bold text-[#0a66c2]">
                  {studentDetails?.summary?.bestOverallPercentage !== null && studentDetails?.summary?.bestOverallPercentage !== undefined
                    ? `${studentDetails.summary.bestOverallPercentage}%`
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Practice Days</p>
                <p className="text-lg font-bold text-slate-900">
                  {studentDetails?.summary?.totalPracticeDays ?? 0}
                </p>
              </div>
            </div>

            {/* Topic Mastery Meters */}
            {studentProgress?.topicBreakdown && studentProgress.topicBreakdown.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Topic Mastery Diagnostics
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {studentProgress.topicBreakdown.map((tp) => (
                    <div
                      key={tp.topic}
                      className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{tp.topic}</p>
                        <p className="text-[11px] text-slate-500">
                          {tp.totalQuestions} questions attempted
                        </p>
                      </div>
                      <Badge
                        variant={tp.accuracy >= 75 ? 'success' : tp.accuracy >= 60 ? 'primary' : 'warning'}
                        size="sm"
                      >
                        {tp.accuracy}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Assessments List */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Submissions
              </h5>
              {studentAssessments.length > 0 ? (
                <div className="space-y-1.5">
                  {studentAssessments.map((a, idx) => (
                    <div
                      key={a._id || a.assessmentId || idx}
                      className="p-3 rounded-lg border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900">
                            {a.targetRole || 'Full Stack Developer'}
                          </span>
                          <Badge variant="neutral" size="sm">
                            {a.mode || 'mixed'}
                          </Badge>
                          <Badge variant={a.status === 'completed' ? 'success' : 'warning'} size="sm">
                            {a.status === 'completed' ? 'Completed' : 'In Progress'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {Array.isArray(a.selectedTopics) ? a.selectedTopics.join(', ') : ''} • {formatDate(a.completedAt || a.startedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.scoring?.overallPercentage !== undefined && (
                          <span className="text-xs font-bold text-slate-900">
                            {a.scoring.overallPercentage}%
                          </span>
                        )}
                        <Link href={`/dashboard/assessments/${a._id || a.assessmentId}/results`}>
                          <Button size="sm" variant="ghost">
                            View Results
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No assessment history for this student.</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={handleCloseModal} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
