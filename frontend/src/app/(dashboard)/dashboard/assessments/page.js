'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { formatDate, getTopicColor } from '@/lib/utils';
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
  FileText,
  Sparkles,
  Play,
  RotateCcw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  ArrowRight,
  SlidersHorizontal,
  PenTool,
  Layers,
  Users,
} from 'lucide-react';

const AVAILABLE_TOPICS = ['JavaScript', 'React', 'Node.js', 'MongoDB'];

export default function AssessmentHubPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = user?.role || 'student';

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress'
  const [modeFilter, setModeFilter] = useState('all'); // 'all' | 'mcq' | 'text' | 'mixed'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generateSuccess, setGenerateSuccess] = useState(null);
  const [inProgressConflictId, setInProgressConflictId] = useState(null);

  // Trainer: Available Assigned Students
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Form State
  const [targetRole, setTargetRole] = useState('Full Stack Developer');
  const [selectedTopics, setSelectedTopics] = useState(['JavaScript', 'React', 'Node.js', 'MongoDB']);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('balanced');
  const [mode, setMode] = useState('mixed'); // 'mcq' | 'text' | 'mixed'

  const [reloadIndex, setReloadIndex] = useState(0);

  // Load assessments
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        if (userRole === 'student') {
          const res = await api.get('/assessments/my');
          if (!ignore) {
            if (res?.success && Array.isArray(res.data)) {
              setAssessments(res.data);
              setError(null);
            } else {
              setError('Unexpected response format while fetching assessments');
            }
          }
        } else {
          // Trainer / Admin: fetch cohort assessments
          const res = await api.get('/trainer/assessments?limit=50');
          if (!ignore) {
            if (res?.success && Array.isArray(res.data)) {
              setAssessments(res.data);
              setError(null);
            } else {
              setError('Unexpected response format while fetching cohort assessments');
            }
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load assessments from server');
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

  // If trainer, load assigned students list for the modal dropdown
  useEffect(() => {
    if (userRole === 'trainer' || userRole === 'admin') {
      api.get('/trainer/students?limit=50').then((res) => {
        if (res?.success && Array.isArray(res.students)) {
          setAssignedStudents(res.students);
          if (res.students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(res.students[0]._id);
          }
        }
      }).catch(() => {});
    }
  }, [userRole, selectedStudentId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  const toggleTopic = (topic) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length === 1) return; // Keep at least one
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const selectAllTopics = () => {
    setSelectedTopics([...AVAILABLE_TOPICS]);
  };

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (selectedTopics.length === 0) {
      setGenerateError('Please select at least one topic.');
      return;
    }

    if ((userRole === 'trainer' || userRole === 'admin') && !selectedStudentId) {
      setGenerateError('Please select an assigned student for this assessment.');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerateError(null);
      setGenerateSuccess(null);
      setInProgressConflictId(null);

      const payload = {
        targetRole: targetRole.trim() || 'Full Stack Developer',
        selectedTopics,
        questionCount: Math.min(25, Math.max(3, parseInt(questionCount, 10) || 10)),
        difficulty,
        mode,
      };

      if ((userRole === 'trainer' || userRole === 'admin') && selectedStudentId) {
        payload.studentId = selectedStudentId;
      }

      const res = await api.post('/assessments/generate', payload);

      if (res?.success && res.data?._id) {
        if (userRole === 'student') {
          setIsModalOpen(false);
          router.push(`/dashboard/assessments/${res.data._id}`);
        } else {
          setGenerateSuccess('Assessment successfully configured and generated for student!');
          setTimeout(() => {
            setIsModalOpen(false);
            setGenerateSuccess(null);
            setReloadIndex((prev) => prev + 1);
          }, 800);
        }
      } else {
        throw new ApiError('Assessment generated but ID not returned.');
      }
    } catch (err) {
      if (err.data?.assessmentId) {
        setInProgressConflictId(err.data.assessmentId);
        setGenerateError(err.message || 'An assessment is already in progress.');
      } else {
        setGenerateError(err.message || 'Failed to generate assessment. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter assessments
  const filteredAssessments = assessments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (modeFilter !== 'all' && (a.mode || 'mixed') !== modeFilter) return false;
    return true;
  });

  const activeAssessment = assessments.find((a) => a.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {userRole === 'trainer' ? 'Cohort Assessment Management' : 'Technical Assessments'}
              </h1>
              <Badge variant={userRole === 'trainer' ? 'success' : 'primary'} size="sm">
                {userRole === 'trainer' ? 'Trainer Console' : 'AI Evaluated'}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              {userRole === 'trainer'
                ? 'Create, inspect, and monitor AI-evaluated assessments across MCQ, Typing, and Mixed modes.'
                : 'Take adaptive assessments tailored to your role. Immediate scoring for objective MCQs and AI rubrics for descriptive answers.'}
            </p>
          </div>

          <Button icon={Sparkles} onClick={() => setIsModalOpen(true)}>
            {userRole === 'trainer' ? 'Create Assessment' : 'Start New Assessment'}
          </Button>
        </div>
      </div>

      {/* Active in-progress alert (Student only) */}
      {userRole === 'student' && activeAssessment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-900">
                  {activeAssessment.targetRole || 'Assessment in progress'}
                </span>
                <Badge variant="warning" size="sm" dot>
                  Active
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                Started {formatDate(activeAssessment.startedAt)} • {activeAssessment.totalQuestions} questions ({activeAssessment.selectedTopics?.join(', ')})
              </p>
            </div>
          </div>

          <Link href={`/dashboard/assessments/${activeAssessment._id}`}>
            <Button size="sm" icon={Play}>
              Resume Assessment
            </Button>
          </Link>
        </div>
      )}

      {/* Main List Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        {/* Filters and count bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-white text-[#0a66c2] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({assessments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'completed'
                      ? 'bg-white text-[#0a66c2] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed ({assessments.filter((a) => a.status === 'completed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'in_progress'
                      ? 'bg-white text-[#0a66c2] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  In Progress ({assessments.filter((a) => a.status === 'in_progress').length})
                </button>
              </div>
            </div>

            {/* Mode Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase">Mode:</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white text-slate-800 uppercase focus:outline-none focus:border-[#0a66c2]"
              >
                <option value="all">ALL MODES</option>
                <option value="mcq">MCQ</option>
                <option value="text">TYPING</option>
                <option value="mixed">MIXED</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredAssessments.length} assessment{filteredAssessments.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading assessments...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-3">
            <div className="p-2.5 rounded-full bg-rose-50 text-rose-600 inline-flex">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">{error}</p>
            <Button size="sm" variant="secondary" onClick={handleRetry} icon={RotateCcw}>
              Retry
            </Button>
          </div>
        ) : filteredAssessments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                {userRole !== 'student' && <TableHead>Student</TableHead>}
                <TableHead>Target Role</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Topics Covered</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssessments.map((a, idx) => {
                const isInProgress = a.status === 'in_progress';
                const hasScore =
                  a.scoring?.overallPercentage !== undefined && a.scoring?.overallPercentage !== null;
                const assessmentId = a._id || a.assessmentId;

                return (
                  <TableRow key={assessmentId || `asmt-${idx}`}>
                    {userRole !== 'student' && (
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">
                            {a.student?.name || 'Student'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {a.student?.email || ''}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-semibold text-slate-900 text-xs">
                      {a.targetRole || 'Full Stack Developer'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.mode === 'mcq'
                            ? 'primary'
                            : a.mode === 'text'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {a.mode === 'mcq' ? 'MCQ' : a.mode === 'text' ? 'Typing' : 'Mixed'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(a.selectedTopics) &&
                          a.selectedTopics.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {t}
                            </span>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {a.totalQuestions ?? 10}
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
                        <span className="font-bold text-slate-900 text-xs">
                          {hasScore ? `${a.scoring.overallPercentage}%` : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(a.completedAt || a.startedAt || a.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {userRole === 'student' ? (
                        isInProgress ? (
                          <Link href={`/dashboard/assessments/${assessmentId}`}>
                            <Button size="sm" variant="primary" icon={Play}>
                              Resume
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/dashboard/assessments/${assessmentId}/results`}>
                            <Button size="sm" variant="secondary">
                              View Results
                            </Button>
                          </Link>
                        )
                      ) : (
                        <Link href={`/dashboard/assessments/${assessmentId}/results`}>
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
            title="No assessments found"
            description={
              statusFilter === 'all'
                ? 'No assessments recorded yet. Click "Start New Assessment" to generate one.'
                : `No assessments found with status "${statusFilter}".`
            }
            action={
              <Button icon={Sparkles} onClick={() => setIsModalOpen(true)}>
                {userRole === 'trainer' ? 'Create Assessment' : 'Start New Assessment'}
              </Button>
            }
          />
        )}
      </div>

      {/* GENERATE ASSESSMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isGenerating && setIsModalOpen(false)}
        title={userRole === 'trainer' ? 'Create Assessment for Student' : 'Generate Technical Assessment'}
        description={
          userRole === 'trainer'
            ? 'Configure an AI-evaluated assessment suite for an assigned student.'
            : 'Select topics, question count, and mode. Questions will be sampled deterministically from the question bank.'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              icon={Sparkles}
              onClick={handleGenerate}
              disabled={isGenerating || selectedTopics.length === 0}
            >
              {isGenerating
                ? 'Generating Assessment...'
                : userRole === 'trainer'
                ? 'Create & Assign'
                : 'Generate & Start Test'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleGenerate} className="space-y-5 py-2">
          {/* Error Banner */}
          {generateError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{generateError}</p>
                {inProgressConflictId && (
                  <div className="mt-2">
                    <Link href={`/dashboard/assessments/${inProgressConflictId}`}>
                      <Button size="sm" variant="primary" icon={Play}>
                        Resume Active Test
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {generateSuccess && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="font-semibold">{generateSuccess}</p>
            </div>
          )}

          {/* Trainer Student Selector */}
          {(userRole === 'trainer' || userRole === 'admin') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign to Student <span className="text-rose-500">*</span>
              </label>
              {assignedStudents.length > 0 ? (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={isGenerating}
                  className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2]"
                >
                  {assignedStudents.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.email}) — {st.careerProfile?.targetRole || 'Full Stack'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                  No students currently assigned to your cohort. Assign students in the Admin console first.
                </p>
              )}
            </div>
          )}

          {/* Target Role Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Role
            </label>
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Full Stack Developer, Frontend Engineer"
              disabled={isGenerating}
            />
          </div>

          {/* Topic Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Topics <span className="text-rose-500">*</span> ({selectedTopics.length} selected)
              </label>
              <button
                type="button"
                onClick={selectAllTopics}
                className="text-xs text-[#0a66c2] font-semibold hover:underline cursor-pointer"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AVAILABLE_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    disabled={isGenerating}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0a66c2] bg-blue-50/70 text-[#0a66c2] font-semibold ring-1 ring-[#0a66c2]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{topic}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#0a66c2]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assessment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assessment Mode <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Mixed Mode Card */}
              <button
                type="button"
                onClick={() => setMode('mixed')}
                disabled={isGenerating}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'mixed'
                    ? 'border-[#0a66c2] bg-blue-50/70 ring-1 ring-[#0a66c2]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-slate-900">
                  <Layers className={`w-3.5 h-3.5 ${mode === 'mixed' ? 'text-[#0a66c2]' : 'text-slate-400'}`} />
                  <span>Mixed Mode</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  MCQ questions combined with technical typing for balanced evaluation.
                </p>
              </button>

              {/* MCQ Mode Card */}
              <button
                type="button"
                onClick={() => setMode('mcq')}
                disabled={isGenerating}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'mcq'
                    ? 'border-[#0a66c2] bg-blue-50/70 ring-1 ring-[#0a66c2]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-slate-900">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${mode === 'mcq' ? 'text-[#0a66c2]' : 'text-slate-400'}`} />
                  <span>MCQ Mode</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Rapid-fire multiple choice questions with instant scoring.
                </p>
              </button>

              {/* Typing Mode Card */}
              <button
                type="button"
                onClick={() => setMode('text')}
                disabled={isGenerating}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  mode === 'text'
                    ? 'border-[#0a66c2] bg-blue-50/70 ring-1 ring-[#0a66c2]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-slate-900">
                  <PenTool className={`w-3.5 h-3.5 ${mode === 'text' ? 'text-[#0a66c2]' : 'text-slate-400'}`} />
                  <span>Typing Mode</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Descriptive answers evaluated by AI against technical rubrics.
                </p>
              </button>
            </div>
            {mode === 'text' && (
              <p className="text-[11px] text-amber-700 mt-1.5 bg-amber-50 p-2 rounded border border-amber-200">
                Note: Typing Mode tests deep architectural reasoning. Ensure at least 2-3 topics are selected for question pool availability.
              </p>
            )}
          </div>

          {/* Question Count & Difficulty in 2 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Number of Questions
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                disabled={isGenerating}
                className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2]"
              >
                <option value={5}>5 Questions (Quick Check)</option>
                <option value={10}>10 Questions (Standard)</option>
                <option value={15}>15 Questions (In-depth)</option>
                <option value={20}>20 Questions (Full Assessment)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Difficulty Calibration
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={isGenerating}
                className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:border-[#0a66c2]"
              >
                <option value="balanced">Balanced (40% Easy, 40% Med, 20% Hard)</option>
                <option value="easy">Easy (Fundamentals)</option>
                <option value="medium">Medium (Core Concepts)</option>
                <option value="hard">Hard (Advanced &amp; Edge Cases)</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
