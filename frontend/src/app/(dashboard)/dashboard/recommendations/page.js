'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { api } from '@/lib/api';
import { formatDate, getTopicColor } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Target,
  ArrowRight,
  Clock,
  BookOpen,
  Play,
  Layers,
  HelpCircle,
  TrendingUp,
  Zap,
} from 'lucide-react';

export default function RecommendationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = user?.role || 'student';
  const isStudent = userRole === 'student';

  // Active learning heartbeat tracking
  useHeartbeat('recommendations');

  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(isStudent);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  // Fetch recommendations
  useEffect(() => {
    let ignore = false;
    if (!isStudent) return;

    async function loadRecs() {
      try {
        const res = await api.get('/recommendations/my');
        if (!ignore) {
          if (res?.success && res.data) {
            setRecommendation(res.data);
            setError(null);
          } else {
            setError('Recommendations could not be generated.');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load recommendations. Please verify backend service.');
          setLoading(false);
        }
      }
    }

    loadRecs();
    return () => {
      ignore = true;
    };
  }, [isStudent, reloadIndex]);

  // Force refresh recommendations
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await api.get('/recommendations/my?refresh=true');
      if (res?.success && res.data) {
        setRecommendation(res.data);
      } else {
        throw new Error('Failed to refresh recommendations.');
      }
    } catch (err) {
      setError(err.message || 'Refresh failed. Please try again.');
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
        <div className="p-3 bg-blue-50 text-[#0a66c2] rounded-full inline-flex">
          <Brain className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Student Recommendations</h2>
        <p className="text-xs text-slate-600">
          Personalized AI recommendations are customized to each student&apos;s active assessments and career focus. As a{' '}
          <strong className="capitalize text-slate-900">{userRole}</strong>, student recommendations can be inspected in your assigned roster console.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200 rounded-xl" />
          <div className="h-48 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error && !recommendation) {
    return (
      <div className="max-w-md mx-auto py-16 text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
        <div className="p-3 rounded-full bg-rose-50 text-rose-600 inline-flex mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Recommendations Unavailable</h3>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={handleRetry} icon={RotateCcw}>
            Retry
          </Button>
          <Link href="/dashboard/assessments">
            <Button variant="primary">Take Assessment</Button>
          </Link>
        </div>
      </div>
    );
  }

  const {
    source,
    modelUsed,
    fallbackReason,
    isCached,
    generatedAt,
    profileSnapshot = {},
    performanceSnapshot = {},
    recommendedTopics = [],
    nextActions = [],
    practiceAssessments = [],
  } = recommendation || {};

  const isAiGenerated = source === 'ai_generated';
  const weakTopics = performanceSnapshot.weakTopics || [];
  const strongTopics = performanceSnapshot.strongTopics || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Personalized Learning Recommendations
              </h1>
              <Badge variant={isAiGenerated ? 'primary' : 'warning'} size="sm" dot>
                {isAiGenerated ? 'AI Calibrated' : 'Rule-Based Fallback'}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Tailored preparation advice based on your verified performance in {profileSnapshot.targetRole || 'Full Stack Developer'}.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              loadingText="Regenerating..."
              icon={RotateCcw}
            >
              Refresh Recommendations
            </Button>
          </div>
        </div>

        {/* Source and cache status footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Generated {formatDate(generatedAt)} {isCached ? '(Cached)' : '(Freshly Generated)'}
          </span>
          {modelUsed && (
            <span className="text-[11px] text-slate-400">
              Engine: {modelUsed} {fallbackReason ? `• ${fallbackReason}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Snapshot Cards: Career Profile & Diagnostic State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile Snapshot */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Target className="w-4 h-4 text-[#0a66c2]" />
            <span>Target Role &amp; Focus Skills</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Target Role:</span>
              <span className="font-semibold text-slate-900">{profileSnapshot.targetRole || 'Full Stack Developer'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Skill Level:</span>
              <span className="font-semibold text-slate-900 capitalize">{profileSnapshot.currentSkillLevel || 'Beginner'}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Focus Topics:</span>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(profileSnapshot.focusSkills) && profileSnapshot.focusSkills.length > 0 ? (
                  profileSnapshot.focusSkills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#0a66c2] border border-blue-200"
                    >
                      {sk}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">None specified</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Snapshot */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Assessment Diagnostic Baseline</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Completed Assessments:</span>
              <span className="font-semibold text-slate-900">
                {performanceSnapshot.totalAssessmentsCompleted ?? 0}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Average Performance:</span>
              <span className="font-semibold text-slate-900">
                {performanceSnapshot.averageOverallPercentage !== null && performanceSnapshot.averageOverallPercentage !== undefined
                  ? `${performanceSnapshot.averageOverallPercentage}%`
                  : 'No tests recorded'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Identified Weak Topics:</span>
              {weakTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {weakTopics.map((wt) => (
                    <span
                      key={wt}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                    >
                      ⚠️ {wt}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">No weak topics diagnosed yet (&lt;60% accuracy)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Priority Topic Focus Recommendations */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Priority Study Topics</h3>
          <p className="text-xs text-slate-500">
            Recommended focus areas ranked by diagnosed skill gaps and interview weight
          </p>
        </div>

        {recommendedTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedTopics.map((item, idx) => {
              const isHigh = item.priority === 'high';
              const isMed = item.priority === 'medium';

              return (
                <div
                  key={item.topic || idx}
                  className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                    isHigh
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{item.topic}</span>
                    <Badge
                      variant={isHigh ? 'danger' : isMed ? 'warning' : 'default'}
                      size="sm"
                    >
                      {item.priority?.toUpperCase()} PRIORITY
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {item.reason}
                  </p>

                  {item.recommendedFocus && (
                    <div className="pt-2 border-t border-slate-100/80 text-[11px]">
                      <span className="font-semibold text-slate-600 block mb-0.5">Key Concepts to Revise:</span>
                      <span className="text-slate-700 bg-slate-100/80 px-2 py-1 rounded block">
                        {item.recommendedFocus}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-4">No topic recommendations generated.</p>
        )}
      </div>

      {/* Next Action Roadmap */}
      {nextActions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recommended Next Learning Actions</h3>
            <p className="text-xs text-slate-500">Actionable steps to improve knowledge depth</p>
          </div>

          <div className="space-y-3">
            {nextActions.map((action, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{action.title}</span>
                    <Badge variant={action.priority === 'high' ? 'danger' : 'info'} size="sm">
                      {action.priority || 'Action'}
                    </Badge>
                    {action.estimatedMinutes && (
                      <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        ~{action.estimatedMinutes} mins
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed">{action.description}</p>
                </div>

                <div className="shrink-0">
                  <Link href="/dashboard/assessments">
                    <Button size="sm" variant="secondary" icon={ArrowRight}>
                      Practice
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Practice Blueprint */}
      {practiceAssessments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Curated Practice Assessments</h3>
            <p className="text-xs text-slate-500">
              Blueprint tests assembled to target your diagnosed weak areas
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {practiceAssessments.map((pa, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {pa.targetRole || 'Full Stack Developer'} Practice
                    </span>
                    <Badge variant="primary" size="sm">
                      {pa.difficulty?.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {pa.reason || 'Practice test calibrated to target core technical principles.'}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {Array.isArray(pa.selectedTopics) &&
                      pa.selectedTopics.map((tp) => (
                        <span
                          key={tp}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {tp}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {pa.questionCount || 10} Questions
                  </span>

                  <Link href="/dashboard/assessments">
                    <Button size="sm" variant="primary" icon={Play}>
                      Start This Test
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
