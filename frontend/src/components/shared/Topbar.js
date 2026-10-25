'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Menu, Flame, LogOut } from 'lucide-react';

const ROLE_BADGE_VARIANTS = {
  student: { variant: 'primary', label: 'Student' },
  trainer: { variant: 'success', label: 'Trainer' },
  admin: { variant: 'warning', label: 'Admin' },
};

export function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const userRole = user?.role || 'student';
  const roleBadge = ROLE_BADGE_VARIANTS[userRole] || ROLE_BADGE_VARIANTS.student;

  // Real server-verified streak count (only displayed if provided by server gamification model)
  const serverStreak = typeof user?.gamification?.streakCount === 'number'
    ? user.gamification.streakCount
    : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-slate-800">
            CareerSaathi <span className="text-[#0a66c2]">Console</span>
          </h1>
        </div>
      </div>

      {/* Right: Real user metadata, streak pill, role badge, logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real Streak Indicator (Only if server provided streak count) */}
        {serverStreak !== null && serverStreak > 0 && (
          <div
            title={`Active learning streak: ${serverStreak} day(s) (requires 15 mins daily server-verified time)`}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold"
          >
            <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>{serverStreak}d streak</span>
          </div>
        )}

        {/* Role Badge */}
        <Badge variant={roleBadge.variant} size="sm">
          {roleBadge.label}
        </Badge>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold shrink-0">
            {user?.name ? user.name[0]?.toUpperCase() : 'U'}
          </div>

          <button
            onClick={logout}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
