'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileQuestion,
  TrendingUp,
  Sparkles,
  Flame,
  Users,
  CheckSquare,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  BarChart3,
  ScrollText,
  LogOut,
  X,
} from 'lucide-react';

const ROLE_NAV_ITEMS = {
  student: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Assessments', href: '/dashboard/assessments', icon: FileQuestion },
    { label: 'Progress & Analytics', href: '/dashboard/progress', icon: TrendingUp },
    { label: 'AI Recommendations', href: '/dashboard/recommendations', icon: Sparkles },
    { label: 'Learning Streaks', href: '/dashboard/streaks', icon: Flame },
  ],
  trainer: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Student Roster', href: '/dashboard/students', icon: Users },
    { label: 'Assessment Grading', href: '/dashboard/grading', icon: CheckSquare },
    { label: 'Coaching Feedback', href: '/dashboard/feedback', icon: MessageSquare },
  ],
  admin: [
    { label: 'Platform Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'User Governance', href: '/dashboard/users', icon: ShieldCheck },
    { label: 'Trainer Assignments', href: '/dashboard/assignments', icon: UserCheck },
    { label: 'System Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Audit Logs', href: '/dashboard/audit', icon: ScrollText },
  ],
};

const ROLE_BADGE_VARIANTS = {
  student: { variant: 'primary', label: 'Student' },
  trainer: { variant: 'success', label: 'Trainer' },
  admin: { variant: 'warning', label: 'Admin' },
};

export function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userRole = user?.role || 'student';
  const navItems = ROLE_NAV_ITEMS[userRole] || ROLE_NAV_ITEMS.student;
  const badgeConfig = ROLE_BADGE_VARIANTS[userRole] || ROLE_BADGE_VARIANTS.student;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col',
          'bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0a66c2] flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900">
                CareerSaathi <span className="text-[#0a66c2]">AI</span>
              </span>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Bar */}
        <div className="px-6 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
            Navigation
          </span>
          <Badge variant={badgeConfig.variant} size="sm">
            {badgeConfig.label}
          </Badge>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-blue-50 text-[#0a66c2] font-semibold border-r-4 border-[#0a66c2]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    isActive ? 'text-[#0a66c2]' : 'text-slate-400'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card in Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.name || 'Member'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
