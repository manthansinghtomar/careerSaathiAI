'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatPercentage, getTopicColor } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ScoreRing } from '@/components/shared/ScoreRing';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Brain,
  Globe,
  Award,
  Layers,
  Info,
} from 'lucide-react';

export default function AssessmentResultsPage() {
  const params = useParams();
  const assessmentId = params?.id;

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AI Evaluation execution state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);

  // Filters & Accordion State
  const [questionFilter, setQuestionFilter] = useState('all'); // 'all' | 'correct' | 'incorrect' | 'pending'
  const [language, setLanguage] = useState('en'); // 'en' | 'hinglish'
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (!assessmentId) return;

    async function load() {
      try {
        const res = await api.get(`/assessments/${assessmentId}/results`);
        if (!ignore) {
          if (res?.success && res.data) {
            setResults(res.data);
            if (Array.isArray(res.data.questions) && res.data.questions.length > 0) {
              setExpandedQuestions({ 0: true });
            }
            setError(null);
          } else {
            setError('Failed to load assessment results');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load results. Assessment may still be in progress.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [assessmentId, reloadIndex]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  // Run AI Evaluation on pending subjective text answers
  const handleTriggerAiEvaluation = async () => {
    try {
      setIsEvaluating(true);
      setEvalError(null);

      const res = await api.post(`/assessments/${assessmentId}/evaluate`, {});

      if (res?.success) {
        if (res?.partial) {
          setEvalError(res?.message || 'Some questions were evaluated, but others failed and remain pending for retry.');
        }
        // Refresh full results with evaluated scores
        setReloadIndex((prev) => prev + 1);
      } else {
        throw new ApiError(res?.message || 'AI evaluation completed with issues.');
      }
    } catch (err) {
      // Honest error reporting: do not fabricate scores if LLM timed out or quota exhausted
      const msg = err.message || 'AI evaluation service unavailable. Please retry shortly.';
      setEvalError(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  const toggleExpand = (idx) => {
    setExpandedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const expandAll = () => {
    const all = {};
    results?.questions?.forEach((_, idx) => {
      all[idx] = true;
    });
    setExpandedQuestions(all);
  };

  const collapseAll = () => {
    setExpandedQuestions({});
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <div className="inline-block w-8 h-8 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
        <h3 className="text-base font-bold text-slate-900">Loading Assessment Results...</h3>
        <p className="text-xs text-slate-500">Retrieving your scores, performance diagnostics, and detailed feedback</p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="max-w-md mx-auto py-16 text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
        <div className="p-3 rounded-full bg-rose-50 text-rose-600 inline-flex mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Results Not Ready</h3>
        <p className="text-sm text-slate-600 mb-4">{error || 'Unable to load results for this assessment.'}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={handleRetry} icon={RotateCcw}>
            Retry
          </Button>
          <Link href="/dashboard/assessments">
            <Button variant="primary">Back to Assessments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { scoring, topicWiseResults = [], weakTopics = [], questions = [] } = results;

  // Count pending subjective questions
  const pendingSubjectiveCount = questions.filter(
    (q) => q.type === 'text' && q.evaluationStatus === 'pending_evaluation'
  ).length;

  const evaluatedSubjectiveCount = questions.filter(
    (q) => q.type === 'text' && q.evaluationStatus === 'ai_evaluated'
  ).length;

  // Filter questions for review
  const filteredQuestions = questions.filter((q) => {
    if (questionFilter === 'correct') return q.isCorrect === true;
    if (questionFilter === 'incorrect') return q.isCorrect === false;
    if (questionFilter === 'pending') return q.evaluationStatus === 'pending_evaluation';
    return true;
  });

  const getQuestionText = (q) => {
    if (language === 'hinglish' && q.content?.hinglish?.question) {
      return q.content.hinglish.question;
    }
    return q.content?.en?.question || '';
  };

  const getExplanationText = (q) => {
    if (language === 'hinglish' && q.content?.hinglish?.explanation) {
      return q.content.hinglish.explanation;
    }
    return q.content?.en?.explanation || '';
  };

  const getOptionText = (opt) => {
    if (language === 'hinglish' && opt.text?.hinglish) {
      return opt.text.hinglish;
    }
    return opt.text?.en || '';
  };

  // Determine display score
  const displayScore = scoring.isFullyEvaluated
    ? (scoring.overallPercentage ?? 0)
    : (scoring.objectivePercentage ?? 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Back navigation & Actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/assessments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Assessments</span>
        </Link>

        {/* Language selector */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'hinglish' : 'en')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-xs"
        >
          <Globe className="w-3.5 h-3.5 text-[#0a66c2]" />
          <span>Language: {language === 'en' ? 'English' : 'Hinglish'}</span>
        </button>
      </div>

      {/* Main Score & Summary Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Assessment Results: {results.targetRole}
              </h1>
              {results.mode && (
                <Badge
                  variant={results.mode === 'mcq' ? 'primary' : results.mode === 'text' ? 'warning' : 'default'}
                  size="sm"
                >
                  {results.mode === 'mcq' ? 'MCQ Only' : results.mode === 'text' ? 'Typing Only' : 'Mixed Assessment'}
                </Badge>
              )}
              <Badge
                variant={
                  scoring.isFullyEvaluated
                    ? 'success'
                    : isEvaluating
                    ? 'primary'
                    : evalError
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
                dot
              >
                {scoring.isFullyEvaluated
                  ? 'Evaluation Complete'
                  : isEvaluating
                  ? 'Evaluating Answers...'
                  : evalError
                  ? 'Evaluation Incomplete'
                  : 'Pending AI Evaluation'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Completed {formatDate(results.completedAt)} • {questions.length} total questions ({results.selectedTopics?.join(', ')})
            </p>
          </div>

          <Link href="/dashboard/assessments">
            <Button size="sm" variant="outline" icon={Sparkles}>
              Take Another Test
            </Button>
          </Link>
        </div>

        {/* Score Ring + Breakdown Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Score Ring Centerpiece */}
          <div className="flex flex-col items-center justify-center p-4">
            <ScoreRing
              score={displayScore}
              maxScore={100}
              size={140}
              strokeWidth={12}
              sublabel={
                scoring.isFullyEvaluated
                  ? 'Final Assessment Score'
                  : isEvaluating
                  ? 'Calculating Score...'
                  : 'Multiple Choice Score (Provisional)'
              }
              label={
                scoring.isFullyEvaluated
                  ? `Overall: ${scoring.overallScore || 0}/${scoring.overallMaxScore || 0} pts`
                  : `MCQ: ${scoring.objectiveScore || 0}/${scoring.objectiveMaxScore || 0} pts`
              }
            />
          </div>

          {/* Breakdown cards */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Objective Score */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Multiple Choice Questions
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {scoring.objectivePercentage ?? 0}%
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                {scoring.objectiveScore ?? 0} correct out of {scoring.objectiveMaxScore ?? 0} questions
              </p>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#0a66c2] h-full rounded-full transition-all duration-500"
                  style={{ width: `${scoring.objectivePercentage ?? 0}%` }}
                />
              </div>
            </div>

            {/* Subjective Score */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Descriptive Responses (AI Evaluated)
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {scoring.subjectivePercentage !== undefined && scoring.subjectivePercentage !== null
                    ? `${scoring.subjectivePercentage}%`
                    : 'Pending Evaluation'}
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                {evaluatedSubjectiveCount} of {questions.filter((q) => q.type === 'text').length} answers evaluated
              </p>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${scoring.subjectivePercentage ?? 0}%` }}
                />
              </div>
            </div>

            {/* Evaluation Action / Alert Banner (State-Driven: Failed vs Pending/In-Progress) */}
            {pendingSubjectiveCount > 0 && (
              evalError ? (
                // State: Failed AI Evaluation (Do NOT show "ready for evaluation")
                <div className="sm:col-span-2 p-4 rounded-xl border border-rose-200 bg-rose-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-rose-900 text-xs">
                        AI Evaluation Incomplete ({pendingSubjectiveCount} answer{pendingSubjectiveCount === 1 ? '' : 's'} remaining)
                      </p>
                      <p className="text-rose-800 text-[11px] leading-relaxed">
                        {evalError} Your submitted answers have been preserved safely.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleTriggerAiEvaluation}
                    isLoading={isEvaluating}
                    loadingText="Retrying Evaluation..."
                    icon={RotateCcw}
                  >
                    Retry AI Evaluation
                  </Button>
                </div>
              ) : (
                // State: Pending or Actively In-Progress Evaluation
                <div className="sm:col-span-2 p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                      <Brain className="w-4 h-4 text-amber-700" />
                      <span>
                        {isEvaluating
                          ? 'Evaluating your descriptive responses...'
                          : `${pendingSubjectiveCount} descriptive answer(s) awaiting AI evaluation`}
                      </span>
                    </div>
                    <p className="text-amber-800 text-[11px]">
                      {isEvaluating
                        ? 'Analyzing reasoning, technical depth, and completeness against verified competencies.'
                        : 'Submit your written responses for automated evaluation to receive comprehensive feedback and complete your assessment score.'}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleTriggerAiEvaluation}
                    isLoading={isEvaluating}
                    loadingText="Evaluating Responses..."
                    icon={Sparkles}
                  >
                    Evaluate Written Answers
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Topic Diagnostics & Weak Topics */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Topic-Wise Performance Breakdown
        </h3>

        {/* Weak topic warning alert */}
        {weakTopics.length > 0 && (
          <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/70 text-xs text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Targeted Weak Topics (&lt;60% accuracy): </span>
              <span>{weakTopics.join(', ')}. Review the explanations below and prioritize these topics in upcoming practice sessions.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topicWiseResults.map((tr) => (
            <div
              key={tr.topic}
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                tr.isWeakTopic ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{tr.topic}</span>
                <span
                  className={`font-bold ${
                    tr.percentage >= 75
                      ? 'text-emerald-700'
                      : tr.percentage >= 60
                      ? 'text-[#0a66c2]'
                      : 'text-rose-700'
                  }`}
                >
                  {tr.percentage}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{tr.totalQuestions} questions tested</span>
                <span>{tr.isWeakTopic ? 'Needs Improvement' : tr.percentage >= 75 ? 'Strong' : 'Satisfactory'}</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    tr.percentage >= 75
                      ? 'bg-emerald-600'
                      : tr.percentage >= 60
                      ? 'bg-[#0a66c2]'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${tr.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Question Review */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Question &amp; Answer Review</h3>
            <p className="text-xs text-slate-500">
              Review correct answers, model explanations, and personalized feedback for each question
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs text-[#0a66c2] hover:underline font-semibold cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs text-[#0a66c2] hover:underline font-semibold cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setQuestionFilter('all')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer border ${
              questionFilter === 'all'
                ? 'bg-[#0a66c2] text-white border-[#0a66c2]'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            All ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionFilter('correct')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer border ${
              questionFilter === 'correct'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Correct ({questions.filter((q) => q.isCorrect === true).length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionFilter('incorrect')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer border ${
              questionFilter === 'incorrect'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Incorrect ({questions.filter((q) => q.isCorrect === false).length})
          </button>
          {pendingSubjectiveCount > 0 && (
            <button
              type="button"
              onClick={() => setQuestionFilter('pending')}
              className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer border ${
                questionFilter === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Pending Evaluation ({pendingSubjectiveCount})
            </button>
          )}
        </div>

        {/* Questions Accordion List */}
        <div className="space-y-3 pt-2">
          {filteredQuestions.map((q, idx) => {
            const isExpanded = expandedQuestions[idx] ?? false;
            const isMcq = q.type === 'mcq';
            const isCorrect = q.isCorrect === true;
            const isPending = q.evaluationStatus === 'pending_evaluation';

            return (
              <div
                key={q.questionId}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-xs text-slate-400 mt-0.5">
                      #{idx + 1}
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" size="sm">
                          {q.topic}
                        </Badge>
                        <Badge
                          variant={
                            q.difficulty === 'hard'
                              ? 'danger'
                              : q.difficulty === 'medium'
                              ? 'warning'
                              : 'success'
                          }
                          size="sm"
                        >
                          {q.difficulty}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {isMcq ? 'Multiple Choice (1 pt)' : 'Descriptive Response'}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {getQuestionText(q)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPending ? (
                      <Badge variant={evalError ? 'danger' : 'warning'} size="sm" dot>
                        {evalError ? 'Pending Review' : 'Awaiting Evaluation'}
                      </Badge>
                    ) : isCorrect ? (
                      <Badge variant="success" size="sm" dot>
                        Correct ({q.pointsEarned ?? 1} pt)
                      </Badge>
                    ) : (
                      <Badge variant="danger" size="sm" dot>
                        Review Needed ({q.pointsEarned ?? 0} pt)
                      </Badge>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 bg-slate-50/40 space-y-4 text-xs">
                    {/* Full Question Statement */}
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                      <span className="font-bold text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">
                        Full Question:
                      </span>
                      <p className="text-slate-900 whitespace-pre-line text-sm leading-relaxed">
                        {getQuestionText(q)}
                      </p>
                    </div>

                    {/* MCQ Options Display */}
                    {isMcq && Array.isArray(q.options) && (
                      <div className="space-y-2">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                          Answer Options &amp; Key:
                        </span>
                        <div className="space-y-1.5">
                          {q.options.map((opt) => {
                            const isStudentPick = String(q.studentAnswer || '').toUpperCase() === opt.id;
                            const isCorrectAnswer = String(q.correctAnswer || '').toUpperCase() === opt.id;

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                                  isCorrectAnswer
                                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                                    : isStudentPick && !isCorrectAnswer
                                    ? 'border-rose-300 bg-rose-50/70 text-rose-900'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <span className="font-bold w-4">{opt.id}.</span>
                                <span className="flex-1">{getOptionText(opt)}</span>
                                {isCorrectAnswer && (
                                  <Badge variant="success" size="sm">
                                    Correct Answer
                                  </Badge>
                                )}
                                {isStudentPick && !isCorrectAnswer && (
                                  <Badge variant="danger" size="sm">
                                    Your Answer
                                  </Badge>
                                )}
                                {isStudentPick && isCorrectAnswer && (
                                  <Badge variant="success" size="sm">
                                    Your Answer (Correct)
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subjective Student Answer & AI Feedback */}
                    {!isMcq && (
                      <div className="space-y-3">
                        {/* Student Answer */}
                        <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">
                            Your Submitted Answer:
                          </span>
                          <p className="text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                            {q.studentAnswer || <span className="italic text-slate-400">No answer provided</span>}
                          </p>
                        </div>

                        {/* Model Answer & Key Concepts */}
                        {q.correctAnswer && (
                          <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200 text-blue-950 space-y-1">
                            <span className="font-bold text-[#0a66c2] block uppercase tracking-wider text-[10px]">
                              Model Answer &amp; Key Concepts:
                            </span>
                            <p className="whitespace-pre-line leading-relaxed">
                              {q.correctAnswer}
                            </p>
                          </div>
                        )}

                        {/* Detailed Evaluation Card */}
                        {q.aiEvaluation ? (
                          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-[#0a66c2]" />
                                <span className="font-bold text-slate-900 text-xs">
                                  Question Score: {q.pointsEarned ?? 0} / {q.maxPoints ?? 1} Pt ({q.aiEvaluation.percentage}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Evaluator Rating: {q.aiEvaluation.score} / 10
                                </span>
                                <Badge variant={q.isCorrect ? 'success' : 'danger'} size="sm">
                                  {q.isCorrect ? 'Meets Standards' : 'Needs Work'}
                                </Badge>
                              </div>
                            </div>

                            {/* Competency Breakdown (5 Dimensions) */}
                            {q.aiEvaluation.rubricBreakdown && (
                              <div className="space-y-1.5">
                                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                                  Competency Breakdown:
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                  {Object.entries(q.aiEvaluation.rubricBreakdown).map(([dim, val]) => (
                                    <div key={dim} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block truncate">
                                        {dim.replace(/([A-Z])/g, ' $1')}
                                      </span>
                                      <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                                        {val} / 10
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Detailed Feedback */}
                            {q.aiEvaluation.feedback && (
                              <div className="p-3 rounded-lg bg-slate-50 text-slate-700 leading-relaxed">
                                <strong className="text-slate-900 font-semibold block mb-0.5">Detailed Feedback:</strong>
                                {q.aiEvaluation.feedback}
                              </div>
                            )}

                            {/* Strengths & Improvement Areas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {Array.isArray(q.aiEvaluation.strengths) && q.aiEvaluation.strengths.length > 0 && (
                                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-900 space-y-1">
                                  <span className="font-bold block text-[11px] text-emerald-800">Key Strengths:</span>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {q.aiEvaluation.strengths.map((str, i) => (
                                      <li key={i}>{str}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {Array.isArray(q.aiEvaluation.weaknesses) && q.aiEvaluation.weaknesses.length > 0 && (
                                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-amber-900 space-y-1">
                                  <span className="font-bold block text-[11px] text-amber-800">Areas for Improvement:</span>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {q.aiEvaluation.weaknesses.map((w, i) => (
                                      <li key={i}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Recommended Next Steps */}
                            {Array.isArray(q.aiEvaluation.suggestions) && q.aiEvaluation.suggestions.length > 0 && (
                              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-blue-900 space-y-1">
                                <span className="font-bold block text-[11px] text-[#0a66c2]">Recommended Next Steps:</span>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {q.aiEvaluation.suggestions.map((sug, i) => (
                                    <li key={i}>{sug}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between gap-3">
                            <span>This descriptive answer has not been evaluated yet.</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleTriggerAiEvaluation}
                              isLoading={isEvaluating}
                              icon={Sparkles}
                            >
                              Evaluate Answer
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {getExplanationText(q) && (
                      <div className="p-3.5 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-700 leading-relaxed">
                        <strong className="text-slate-900 font-semibold block mb-0.5 uppercase tracking-wider text-[10px]">
                          Technical Explanation:
                        </strong>
                        {getExplanationText(q)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
