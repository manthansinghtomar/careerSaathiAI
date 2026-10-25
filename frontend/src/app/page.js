'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Flame,
  ShieldCheck,
  Brain,
  Code,
  FileQuestion,
  Layers,
  Award,
  Users,
  Compass,
  Clock,
  ChevronRight,
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#0a66c2] flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              CareerSaathi <span className="text-[#0a66c2]">AI</span>
            </span>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Platform Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
              How It Works
            </a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">
              Role Capabilities
            </a>
            <a href="#streaks" className="hover:text-slate-900 transition-colors">
              Gamification
            </a>
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 hidden sm:inline">
                  Welcome, <strong className="text-slate-900">{user?.name || 'Member'}</strong>
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors shadow-xs"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors shadow-xs"
                >
                  <span>Get Started</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0a66c2] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Technical Career Preparation</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight">
              Master Technical Interviews with{' '}
              <span className="text-[#0a66c2]">Calibrated AI Assessments</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
              Bridge the gap between theoretical learning and industry engineering hiring. Practice calibrated MCQs, architectural typing questions, and gain deep rubric-based AI feedback to accelerate your job readiness.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                href={isAuthenticated ? '/dashboard/assessments' : '/register'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0a66c2] text-white text-sm font-bold hover:bg-[#004182] transition-all shadow-xs"
              >
                <span>{isAuthenticated ? 'Take an Assessment' : 'Start Free Assessment'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={isAuthenticated ? '/dashboard' : '/login'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Sign In to Account'}</span>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-y-3 gap-x-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                MCQ &amp; Technical Typing Modes
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                5-Dimension AI Rubrics
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                English &amp; Hinglish Explanations
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                15-Min Daily Habit Streaks
              </span>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section id="features" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#0a66c2]">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Engineered for Real Skill Mastery
            </h2>
            <p className="text-sm text-slate-600">
              A complete ecosystem combining rigorous technical evaluation, continuous analytics, and personalized guidance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0a66c2] flex items-center justify-center font-bold">
                <FileQuestion className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Adaptive Assessments</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose between MCQ practice, technical typing answers, or mixed mode. Calibrated across JavaScript, React, Node.js, and MongoDB.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">AI Rubric Evaluation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Subjective technical answers are scored across technical correctness, conceptual grasp, completeness, reasoning, and relevance.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Progress &amp; Diagnostics</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Visual timeline charts, topic mastery percentages, and automatic identification of weak topics with targeted revision alerts.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3 hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Verified Learning Streaks</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Anti-cheat active learning time tracking. Complete 15 minutes of server-verified daily practice to preserve streaks and hit milestones.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-[#0a66c2]">
                Learning Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Four Steps to Interview Readiness
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">Calibrate Your Goals</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Select your target engineering role, timeline, and current skill level during onboarding or settings.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">Take Focused Tests</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Generate assessments in MCQ Mode, Technical Typing Mode, or Mixed Mode with auto-saving answers.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900">Inspect AI Insights</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Review explanations, reference rubrics, and diagnostic advice in standard English or Roman Hinglish.
                </p>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <h3 className="text-sm font-bold text-slate-900">Close Skill Gaps</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Follow prioritized study topics and launch tailored practice assessments to solidify fundamentals.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roles & Governance Section */}
        <section id="roles" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#0a66c2]">
              Role-Based Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Built for Students, Trainers &amp; Institutions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Student */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-[#0a66c2] text-xs font-bold">
                Student Portal
              </div>
              <h3 className="text-base font-bold text-slate-900">Continuous Career Practice</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>On-demand assessment generation with MCQ and typing modes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Personalized recommendations based on identified weak topics.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Real-time notifications on completed tests and streak milestones.</span>
                </li>
              </ul>
            </div>

            {/* Trainer */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                Trainer Console
              </div>
              <h3 className="text-base font-bold text-slate-900">Coaching &amp; Manual Grading</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Assigned student roster oversight with progress analytics.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Manual question evaluation and AI rubric overrides.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Coaching remarks and actionable feedback dispatch.</span>
                </li>
              </ul>
            </div>

            {/* Admin */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold">
                Admin Console
              </div>
              <h3 className="text-base font-bold text-slate-900">Platform Governance &amp; Audits</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>User management, role upgrades, and account deactivation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Trainer-student allocation and bulk assignment engine.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Immutable audit logging for compliance and transparency.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-16 bg-[#0a66c2] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Accelerate Your Career Preparation?
            </h2>
            <p className="text-sm sm:text-base text-blue-100 max-w-xl mx-auto leading-relaxed">
              Join CareerSaathi AI today to experience structured technical assessments, AI-driven feedback, and daily learning habits.
            </p>
            <div className="pt-2">
              <Link
                href={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#0a66c2] font-bold text-sm hover:bg-blue-50 transition-colors shadow-xs"
              >
                <span>{isAuthenticated ? 'Open Dashboard' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0a66c2] flex items-center justify-center text-white font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm text-slate-900">CareerSaathi AI</span>
            <span className="text-xs text-slate-400">© 2026. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 font-medium">
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-900 transition-colors">
              Register
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
