'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

const AVAILABLE_TOPICS = ['JavaScript', 'React', 'Node.js', 'MongoDB'];

export default function AssessmentHubPage() {
  const router = useRouter();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [inProgressConflictId, setInProgressConflictId] = useState(null);

  // Form State
  const [targetRole, setTargetRole] = useState('Full Stack Developer');
  const [selectedTopics, setSelectedTopics] = useState(['JavaScript', 'React', 'Node.js', 'MongoDB']);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('balanced');

  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await api.get('/assessments/my');
        if (!ignore) {
          if (res?.success && Array.isArray(res.data)) {
            setAssessments(res.data);
            setError(null);
          } else {
            setError('Unexpected response format while fetching assessments');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load assessments from server');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [reloadIndex]);

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

    try {
      setIsGenerating(true);
      setGenerateError(null);
      setInProgressConflictId(null);

      const payload = {
        targetRole: targetRole.trim() || 'Full Stack Developer',
        selectedTopics,
        questionCount: Math.min(25, Math.max(3, parseInt(questionCount, 10) || 10)),
        difficulty,
      };

      const res = await api.post('/assessments/generate', payload);

      if (res?.success && res.data?._id) {
        setIsModalOpen(false);
        router.push(`/dashboard/assessments/${res.data._id}`);
      } else {
        throw new ApiError('Assessment generated but ID not returned.');
      }
    } catch (err) {
      // Backend returns assessmentId when 400 conflict occurs
      if (err.data?.assessmentId) {
        setInProgressConflictId(err.data.assessmentId);
        setGenerateError(err.message || 'You already have an assessment in progress.');
      } else {
        setGenerateError(err.message || 'Failed to generate assessment. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Find any active in-progress assessment
  const activeAssessment = assessments.find((a) => a.status === 'in_progress');

  // Filtered list
  const filteredAssessments = assessments.filter((a) => {
    if (statusFilter === 'completed') return a.status === 'completed';
    if (statusFilter === 'in_progress') return a.status === 'in_progress';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
              Skill Assessments
            </h1>
            <p className="text-sm text-slate-600">
              Generate AI-evaluated role tests across key web engineering concepts.
            </p>
          </div>

          <Button
            onClick={() => {
              setGenerateError(null);
              setInProgressConflictId(null);
              setIsModalOpen(true);
            }}
            icon={Sparkles}
          >
            New Assessment
          </Button>
        </div>
      </div>

      {/* In-Progress Test Banner Alert */}
      {activeAssessment && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#0a66c2] text-white shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Assessment in Progress ({activeAssessment.targetRole})
                </h3>
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filter By Status:
            </span>
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

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredAssessments.length} assessment{filteredAssessments.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading your assessments...</p>
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
                <TableHead>Target Role</TableHead>
                <TableHead>Topics Covered</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssessments.map((a) => {
                const isInProgress = a.status === 'in_progress';
                const hasScore = a.scoring?.overallPercentage !== undefined && a.scoring?.overallPercentage !== null;

                return (
                  <TableRow key={a._id}>
                    <TableCell className="font-semibold text-slate-900">
                      {a.targetRole || 'Full Stack Developer'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Array.isArray(a.selectedTopics) && a.selectedTopics.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {a.totalQuestions} ({a.objectiveQuestionsCount || 0} MCQ • {a.subjectiveQuestionsCount || 0} Text)
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
                        <Link href={`/dashboard/assessments/${a._id}`}>
                          <Button size="sm" variant="primary" icon={Play}>
                            Resume
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/dashboard/assessments/${a._id}/results`}>
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
            title={statusFilter === 'all' ? 'No assessments yet' : `No ${statusFilter.replace('_', ' ')} assessments`}
            description={
              statusFilter === 'all'
                ? 'Generate a custom assessment targeting your focus skills to prepare for technical interviews.'
                : 'Try switching the filter to view all assessment attempts.'
            }
            action={
              statusFilter === 'all' ? (
                <Button onClick={() => setIsModalOpen(true)} icon={Sparkles}>
                  Generate Assessment
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setStatusFilter('all')}>
                  Show All Assessments
                </Button>
              )
            }
          />
        )}
      </div>

      {/* Assessment Generation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isGenerating && setIsModalOpen(false)}
        title="Generate Technical Assessment"
        description="Select your target role, topics, and difficulty to assemble a personalized test."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              isLoading={isGenerating}
              loadingText="Assembling Questions..."
              icon={Sparkles}
            >
              Start Assessment
            </Button>
          </>
        }
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Error Message */}
          {generateError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{generateError}</p>
                {inProgressConflictId && (
                  <div className="mt-2">
                    <Link href={`/dashboard/assessments/${inProgressConflictId}`}>
                      <Button size="sm" variant="primary" icon={Play}>
                        Resume Existing Test
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target Role Input */}
          <Input
            label="Target Job Role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Full Stack Developer"
            helperText="Questions are calibrated to this engineering profile"
            disabled={isGenerating}
          />

          {/* Topics Multi-Select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Topics to Include <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={selectAllTopics}
                className="text-xs text-[#0a66c2] hover:underline font-medium cursor-pointer"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    disabled={isGenerating}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0a66c2] bg-blue-50/70 text-[#0a66c2]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{topic}</span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                        isSelected
                          ? 'bg-[#0a66c2] border-[#0a66c2] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedTopics.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">Please select at least one topic.</p>
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
                className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2]"
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
