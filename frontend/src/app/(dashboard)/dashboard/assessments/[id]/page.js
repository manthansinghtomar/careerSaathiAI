'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Clock,
  Globe,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  FileQuestion,
  Bookmark,
} from 'lucide-react';
import { VoiceRecorder } from '@/components/shared/VoiceRecorder';
import { detectAnswerLanguage } from '@/lib/languageDetector';

export default function AssessmentTakingPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.id;

  // Active learning heartbeat tracking
  useHeartbeat('assessment');

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Taking state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: string }
  const [language, setLanguage] = useState('en'); // 'en' | 'hinglish'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Submission state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const storageKey = `careerSaathi_assessment_${assessmentId}_answers`;

  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (!assessmentId) return;

    async function load() {
      try {
        const res = await api.get(`/assessments/${assessmentId}`);
        if (!ignore) {
          if (res?.success && res.data) {
            const data = res.data;

            if (data.status === 'completed') {
              router.replace(`/dashboard/assessments/${assessmentId}/results`);
              return;
            }

            setAssessment(data);

            const initialAnswers = {};
            if (Array.isArray(data.questions)) {
              data.questions.forEach((q) => {
                if (q.studentAnswer) {
                  initialAnswers[q.questionId] = q.studentAnswer;
                }
              });
            }

            if (typeof window !== 'undefined') {
              try {
                const cached = localStorage.getItem(storageKey);
                if (cached) {
                  const parsed = JSON.parse(cached);
                  Object.assign(initialAnswers, parsed);
                }
              } catch (_) {
                // Ignore parse error
              }
            }

            setAnswers(initialAnswers);

            if (data.startedAt) {
              const startedMs = new Date(data.startedAt).getTime();
              const nowMs = Date.now();
              const elapsed = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
              setElapsedSeconds(elapsed);
            }
            setError(null);
          } else {
            setError('Assessment not found or failed to load.');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load assessment. Please verify your connection.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [assessmentId, router, storageKey, reloadIndex]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadIndex((prev) => prev + 1);
  };

  // Elapsed timer tick
  useEffect(() => {
    if (loading || error || !assessment || assessment.status === 'completed') return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, error, assessment]);

  // Save answers to local storage safely
  const updateAnswer = (questionId, value) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (_) {
        // quota exceeded / private mode fallback
      }
    }
  };

  const currentQuestion = assessment?.questions?.[currentIndex];
  const totalQuestions = assessment?.questions?.length || 0;

  // Answered questions count
  const answeredCount = Object.keys(answers).filter(
    (qId) => answers[qId] && String(answers[qId]).trim().length > 0
  ).length;

  // Question content based on selected language
  const getQuestionText = (q) => {
    if (!q) return '';
    if (language === 'hinglish' && q.content?.hinglish?.question) {
      return q.content.hinglish.question;
    }
    return q.content?.en?.question || '';
  };

  const getOptionText = (opt) => {
    if (!opt) return '';
    if (language === 'hinglish' && opt.text?.hinglish) {
      return opt.text.hinglish;
    }
    return opt.text?.en || '';
  };

  // Submission handler
  const handleSubmitAssessment = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Construct normalized payload
      const payloadAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer: String(answer || '').trim(),
      }));

      const res = await api.post(`/assessments/${assessmentId}/submit`, {
        answers: payloadAnswers,
      });

      if (res?.success) {
        // Clear local storage backup upon successful submission
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storageKey);
        }
        setIsSubmitModalOpen(false);
        router.push(`/dashboard/assessments/${assessmentId}/results`);
      } else {
        throw new ApiError('Failed to submit assessment.');
      }
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <div className="inline-block w-8 h-8 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
        <h3 className="text-base font-bold text-slate-900">Loading Assessment...</h3>
        <p className="text-xs text-slate-500">Preparing test questions and restoring session state</p>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-md mx-auto py-16 text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
        <div className="p-3 rounded-full bg-rose-50 text-rose-600 inline-flex mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Assessment Not Available</h3>
        <p className="text-sm text-slate-600 mb-4">{error || 'Unable to load requested assessment.'}</p>
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

  const currentAnswer = currentQuestion ? answers[currentQuestion.questionId] || '' : '';

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Top Test Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/assessments"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Exit Test
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <h2 className="text-sm font-bold text-slate-900 hidden sm:block truncate max-w-xs">
            {assessment.targetRole}
          </h2>
          {assessment.mode && (
            <Badge
              variant={assessment.mode === 'mcq' ? 'primary' : assessment.mode === 'text' ? 'warning' : 'default'}
              size="sm"
            >
              {assessment.mode === 'mcq' ? 'MCQ Mode' : assessment.mode === 'text' ? 'Typing Mode' : 'Mixed Mode'}
            </Badge>
          )}
        </div>

        {/* Center: Elapsed Timer & Progress */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
            <Clock className="w-4 h-4 text-[#0a66c2]" />
            <span>Time Elapsed: {formatDuration(elapsedSeconds)}</span>
          </div>

          <span className="text-slate-600">
            {answeredCount} of {totalQuestions} answered
          </span>
        </div>

        {/* Right: Language Toggle & Submit Action */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'hinglish' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Switch display between English and Roman Hinglish"
          >
            <Globe className="w-3.5 h-3.5 text-[#0a66c2]" />
            <span>{language === 'en' ? 'English' : 'Hinglish'}</span>
          </button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setSubmitError(null);
              setIsSubmitModalOpen(true);
            }}
            icon={Send}
          >
            Finish Test
          </Button>
        </div>
      </div>

      {/* Main Test Grid: Sidebar Nav + Question Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left Column: Question Palette Drawer */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs lg:sticky lg:top-20 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Question Navigator
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              {answeredCount}/{totalQuestions} Done
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {assessment.questions.map((q, idx) => {
              const isAnswered = answers[q.questionId] && String(answers[q.questionId]).trim().length > 0;
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.questionId}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 w-full rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'ring-2 ring-[#0a66c2] bg-blue-50 text-[#0a66c2] border border-[#0a66c2]'
                      : isAnswered
                      ? 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                      : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-around text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded border border-[#0a66c2] bg-blue-50" />
              Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300" />
              Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-white border border-slate-200" />
              Unanswered
            </span>
          </div>
        </div>

        {/* Right Column: Question Content & Input Area */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs lg:col-span-3 order-1 lg:order-2 space-y-6">
          {currentQuestion ? (
            <>
              {/* Question Metadata Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0a66c2]">
                    Question {currentIndex + 1} of {totalQuestions}
                  </span>
                  <Badge variant="outline" size="sm">
                    {currentQuestion.topic}
                  </Badge>
                  {currentQuestion.subtopic && (
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      • {currentQuestion.subtopic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      currentQuestion.difficulty === 'hard'
                        ? 'danger'
                        : currentQuestion.difficulty === 'medium'
                        ? 'warning'
                        : 'success'
                    }
                    size="sm"
                  >
                    {currentQuestion.difficulty.toUpperCase()}
                  </Badge>

                  <Badge variant="default" size="sm">
                    {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Subjective (AI Rubric)'}
                  </Badge>
                </div>
              </div>

              {/* Question Statement */}
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                  {getQuestionText(currentQuestion)}
                </h3>
                {language === 'hinglish' && !currentQuestion.content?.hinglish?.question && (
                  <p className="text-xs text-amber-700 italic">
                    (Hinglish translation not authored for this question. Displaying in standard English.)
                  </p>
                )}
              </div>

              {/* Interactive Input Form */}
              <div className="pt-2">
                {currentQuestion.type === 'mcq' ? (
                  // Multiple Choice Option Radio Buttons
                  <div className="space-y-2.5">
                    {Array.isArray(currentQuestion.options) &&
                      currentQuestion.options.map((opt) => {
                        const isSelected = currentAnswer === opt.id;
                        return (
                          <label
                            key={opt.id}
                            className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border text-sm transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#0a66c2] bg-blue-50/70 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${currentQuestion.questionId}`}
                              value={opt.id}
                              checked={isSelected}
                              onChange={() => updateAnswer(currentQuestion.questionId, opt.id)}
                              className="mt-0.5 w-4 h-4 text-[#0a66c2] border-slate-300 focus:ring-[#0a66c2]"
                            />
                            <div className="flex-1">
                              <span className="font-bold text-slate-800 mr-2">{opt.id}.</span>
                              <span className="text-slate-700 leading-relaxed">
                                {getOptionText(opt)}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  // Subjective Text Input Area
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Your Technical Answer:
                      </label>
                      <VoiceRecorder
                        preferredLanguage={language}
                        onAppendText={(text) => {
                          const existing = currentAnswer ? currentAnswer.trim() : '';
                          const updated = existing ? `${existing} ${text}` : text;
                          updateAnswer(currentQuestion.questionId, updated);
                        }}
                      />
                    </div>
                    {language === 'en' &&
                      currentAnswer &&
                      detectAnswerLanguage(currentAnswer, 'en').status === 'mismatch' && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 animate-fadeIn">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Language Notice: </span>
                            English mode is active, but your answer appears to be in Hindi/Hinglish.
                            You may edit your answer to English in the box below before submitting to avoid an adherence deduction.
                          </div>
                        </div>
                      )}
                    <textarea
                      rows={6}
                      value={currentAnswer}
                      onChange={(e) => updateAnswer(currentQuestion.questionId, e.target.value)}
                      placeholder="Write or speak your explanation, code trade-offs, or implementation mechanism here... (Evaluated by AI against technical reference rubric)"
                      className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2] transition-colors leading-relaxed font-sans"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Be clear, concise, and mention underlying engineering fundamentals.</span>
                      <span>{String(currentAnswer).length} characters</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {currentIndex < totalQuestions - 1 ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    >
                      <span>Next Question</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setSubmitError(null);
                        setIsSubmitModalOpen(true);
                      }}
                      icon={Send}
                    >
                      Review &amp; Submit
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-12">No question selected.</p>
          )}
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => !isSubmitting && setIsSubmitModalOpen(false)}
        title="Submit Assessment?"
        description="Verify your answers before locking your submission."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={isSubmitting}
            >
              Continue Test
            </Button>
            <Button
              onClick={handleSubmitAssessment}
              isLoading={isSubmitting}
              loadingText="Submitting Answers..."
              icon={Send}
            >
              Confirm Submission
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Questions:</span>
              <span className="font-bold text-slate-900">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Answered Questions:</span>
              <span className="font-bold text-emerald-700">{answeredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unanswered Questions:</span>
              <span className="font-bold text-amber-700">{totalQuestions - answeredCount}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500">Total Time Elapsed:</span>
              <span className="font-bold text-slate-900">{formatDuration(elapsedSeconds)}</span>
            </div>
          </div>

          {totalQuestions - answeredCount > 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
              ⚠️ You have <strong>{totalQuestions - answeredCount} unanswered</strong> questions. Unanswered questions will receive 0 points.
            </p>
          ) : (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
              ✓ All questions have been answered. You will receive instant objective scoring upon submission.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
