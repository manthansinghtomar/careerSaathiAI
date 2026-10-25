'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  Flame,
  Clock,
  MessageSquare,
  Info,
  Check,
  CheckCheck,
  RotateCcw,
  X,
  ExternalLink,
} from 'lucide-react';

const NOTIFICATION_ICONS = {
  assessment_completed: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  assessment_evaluated: { icon: Sparkles, color: 'text-[#0a66c2] bg-blue-50' },
  trainer_feedback: { icon: MessageSquare, color: 'text-purple-600 bg-purple-50' },
  streak_milestone: { icon: Flame, color: 'text-amber-600 bg-amber-50' },
  streak_reminder: { icon: Clock, color: 'text-amber-600 bg-amber-50' },
  system: { icon: Info, color: 'text-slate-600 bg-slate-100' },
};

export function NotificationDropdown({ isAuthenticated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function fetchCount() {
      if (!isAuthenticated) return;
      try {
        const res = await api.get('/notifications/unread-count');
        if (!ignore && res?.success && typeof res.count === 'number') {
          setUnreadCount(res.count);
        }
      } catch (_) {
        // Quiet fail for periodic count check
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Load full notification list when dropdown is opened
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/notifications?limit=15');
      if (res?.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      } else {
        setError('Failed to load notifications');
      }
    } catch (err) {
      setError(err?.message || 'Unable to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      loadNotifications();
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification read
  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      const res = await api.patch(`/notifications/${id}/read`, {});
      if (res?.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (_) {
      // Ignore mutation error
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      const res = await api.patch('/notifications/read-all', {});
      if (res?.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (_) {
      // Ignore mutation error
    } finally {
      setMarkingAll(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-[11px] font-medium text-[#0a66c2] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200/50 cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center space-y-2">
                <div className="inline-block w-5 h-5 border-2 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Loading notifications...</p>
              </div>
            ) : error ? (
              <div className="py-6 px-4 text-center space-y-2">
                <p className="text-xs text-rose-600 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="inline-flex items-center gap-1 text-xs text-[#0a66c2] hover:underline font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-800">No notifications yet</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Updates on assessments, AI evaluations, coaching feedback, and streak milestones will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const iconConfig = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;
                const Icon = iconConfig.icon;
                const assessmentId = item.data?.assessmentId;

                return (
                  <div
                    key={item._id}
                    onClick={() => {
                      if (!item.isRead) {
                        handleMarkAsRead(item._id);
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors ${
                      item.isRead
                        ? 'bg-white hover:bg-slate-50/70'
                        : 'bg-blue-50/40 hover:bg-blue-50/70'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconConfig.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <h4
                          className={`text-xs truncate ${
                            item.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                          }`}
                        >
                          {item.title}
                        </h4>
                        {!item.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#0a66c2] shrink-0"
                            title="Unread"
                          />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 leading-snug line-clamp-2 mb-1.5">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{formatDate(item.createdAt)}</span>

                        <div className="flex items-center gap-2">
                          {assessmentId && (
                            <Link
                              href={`/dashboard/assessments/${assessmentId}/results`}
                              onClick={() => {
                                if (!item.isRead) handleMarkAsRead(item._id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-0.5 text-[#0a66c2] hover:underline font-medium"
                            >
                              <span>View Results</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}

                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(item._id, e)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title="Mark as read"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
