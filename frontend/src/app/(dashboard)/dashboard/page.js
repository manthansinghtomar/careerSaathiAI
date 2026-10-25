'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { User, Target, Shield, Clock } from 'lucide-react';

export default function DashboardPlaceholderPage() {
  const { user } = useAuth();

  const userRole = user?.role || 'student';
  const careerProfile = user?.careerProfile;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Welcome back, {user?.name || 'User'}
              </h1>
              <Badge
                variant={
                  userRole === 'admin'
                    ? 'warning'
                    : userRole === 'trainer'
                    ? 'success'
                    : 'primary'
                }
                size="sm"
              >
                {userRole.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Authenticated session active. Shared dashboard shell loaded successfully.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Server Time (IST)</span>
          </div>
        </div>
      </div>

      {/* Real Account Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-4">
            <User className="w-4 h-4 text-[#0a66c2]" />
            <span>Profile Overview</span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Full Name</dt>
              <dd className="font-medium text-slate-900">{user?.name || '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Email Address</dt>
              <dd className="font-medium text-slate-900">{user?.email || '—'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Account Role</dt>
              <dd className="font-medium text-slate-900 capitalize">{user?.role || 'student'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Account Status</dt>
              <dd className="font-medium text-emerald-600">
                {user?.isActive ? 'Active' : 'Inactive'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Student Career Profile or Role Note */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-4">
            <Target className="w-4 h-4 text-[#0a66c2]" />
            <span>
              {userRole === 'student' ? 'Career Profile' : 'Role Permissions'}
            </span>
          </div>

          {userRole === 'student' && careerProfile ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Target Role</dt>
                <dd className="font-medium text-slate-900">
                  {careerProfile.targetRole || 'Not specified'}
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Skill Level</dt>
                <dd className="font-medium text-slate-900 capitalize">
                  {careerProfile.currentSkillLevel || 'beginner'}
                </dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Target Timeline</dt>
                <dd className="font-medium text-slate-900">
                  {careerProfile.targetTimeline || '3 months'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 mb-1.5">Focus Skills</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {Array.isArray(careerProfile.focusSkills) && careerProfile.focusSkills.length > 0 ? (
                    careerProfile.focusSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#0a66c2] border border-blue-200"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">None selected</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                You are authenticated as{' '}
                <strong className="text-slate-900 capitalize">{userRole}</strong>.
              </p>
              <p className="text-xs text-slate-500">
                Dedicated management views for this role are scheduled for implementation in upcoming phases (Trainer in Phase 5, Admin in Phase 6).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Roadmap & Scope Note (No fabricated numbers) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Frontend Implementation Roadmap Status</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Phase 2 shell foundation is now operational with real backend JWT authentication, role-based navigation, and protected layouts. Feature modules will connect to backend APIs in subsequent phases:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
            <span className="font-semibold text-[#0a66c2] block mb-0.5">Phase 2: Complete</span>
            <span className="text-slate-600">Authentication & Dashboard Shell</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="font-semibold text-slate-700 block mb-0.5">Phase 3: Upcoming</span>
            <span className="text-slate-500">Student Assessments & Taking UI</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="font-semibold text-slate-700 block mb-0.5">Phase 4: Upcoming</span>
            <span className="text-slate-500">Progress, AI Mentoring & Streaks</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="font-semibold text-slate-700 block mb-0.5">Phases 5-6: Upcoming</span>
            <span className="text-slate-500">Trainer & Admin Consoles</span>
          </div>
        </div>
      </div>
    </div>
  );
}
