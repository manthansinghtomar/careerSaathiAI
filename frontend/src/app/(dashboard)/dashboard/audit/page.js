'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileCode,
  Lock,
} from 'lucide-react';

const ACTION_BADGES = {
  USER_ACTIVATED: { label: 'User Activated', variant: 'success' },
  USER_DEACTIVATED: { label: 'User Deactivated', variant: 'danger' },
  ROLE_UPDATED: { label: 'Role Updated', variant: 'warning' },
  STUDENT_ASSIGNED: { label: 'Student Assigned', variant: 'primary' },
  STUDENT_UNASSIGNED: { label: 'Student Unassigned', variant: 'warning' },
  BULK_ASSIGNED: { label: 'Bulk Assigned', variant: 'primary' },
  BULK_UNASSIGNED: { label: 'Bulk Unassigned', variant: 'warning' },
  ASSESSMENT_INSPECTED: { label: 'Assessment Inspected', variant: 'info' },
};

export default function AuditLogsPage() {
  const { user: currentAdmin } = useAuth();
  const isAdmin = currentAdmin?.role === 'admin';

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Detail Modal State
  const [inspectLog, setInspectLog] = useState(null);

  // Fetch Audit Logs
  useEffect(() => {
    let ignore = false;
    async function fetchLogs() {
      if (!isAdmin) return;
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', '15');
        if (actionFilter) params.append('action', actionFilter);

        const res = await api.get(`/admin/audit-logs?${params.toString()}`);
        if (!ignore && res?.success) {
          setLogs(res.data || []);
          setTotalLogs(res.total || 0);
          setTotalPages(res.totalPages || 1);
        } else if (!ignore) {
          setError(res?.message || 'Failed to load audit logs');
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Error communicating with audit logger');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchLogs();
    return () => {
      ignore = true;
    };
  }, [isAdmin, page, actionFilter, reloadTrigger]);

  // Format Timestamp
  const formatExactTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch {
      return formatDate(dateStr);
    }
  };

  // Unauthorized guard
  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          You do not have administrative privileges to access Security Audit Logs.
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Security Audit Logs &amp; Audit Trail
              </h1>
              <Badge variant="warning" size="sm">
                Admin Console
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Immutable forensic log of all administrative state modifications, role changes, and inspection events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
              {totalLogs} Recorded Events
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => setReloadTrigger((p) => p + 1)}
            >
              Refresh Logs
            </Button>
          </div>
        </div>
      </div>

      {/* Security & Immutability Notice Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-blue-100 text-[#0a66c2] shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-sm text-blue-950 mb-0.5">Tamper-Proof Audit Record</p>
          <p className="text-blue-800 leading-relaxed">
            Audit logs are cryptographically bound to the performing administrator and client IP.
            Records are strictly read-only and cannot be altered or removed through the application interface.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-600 uppercase">Filter by Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
          >
            <option value="">All Administrative Actions</option>
            <option value="USER_ACTIVATED">User Activated</option>
            <option value="USER_DEACTIVATED">User Deactivated</option>
            <option value="ROLE_UPDATED">Role Updated</option>
            <option value="STUDENT_ASSIGNED">Student Assigned</option>
            <option value="STUDENT_UNASSIGNED">Student Unassigned</option>
            <option value="BULK_ASSIGNED">Bulk Assigned</option>
            <option value="BULK_UNASSIGNED">Bulk Unassigned</option>
            <option value="ASSESSMENT_INSPECTED">Assessment Inspected</option>
          </select>
        </div>

        {actionFilter && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActionFilter('');
              setPage(1);
            }}
            className="text-xs"
          >
            Clear Filter
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadTrigger((p) => p + 1)}>
            Retry
          </Button>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-10 space-y-3 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/4" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Actor</th>
                    <th className="py-3 px-4 font-semibold">Target Entity</th>
                    <th className="py-3 px-4 font-semibold">Client IP</th>
                    <th className="py-3 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const badgeConfig = ACTION_BADGES[log.action] || {
                      label: log.action,
                      variant: 'primary',
                    };
                    return (
                      <tr key={log._id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {formatExactTime(log.createdAt)}
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant={badgeConfig.variant} size="sm">
                            {badgeConfig.label}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          {log.actor ? (
                            <div>
                              <p className="font-semibold text-xs text-slate-900">{log.actor.name}</p>
                              <p className="text-[11px] text-slate-400">{log.actor.email}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">System Worker</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {log.targetType || 'Entity'}: {log.targetId ? String(log.targetId).slice(-6) : '—'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs font-mono text-slate-500">
                          {log.ipAddress || '127.0.0.1'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setInspectLog(log)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-[#0a66c2]" /> Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
                <span className="font-semibold text-slate-900">{totalPages}</span> ({totalLogs} events)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-10">
            <EmptyState
              icon={ScrollText}
              title="No audit logs found"
              description="No audit events matched the specified action filter."
            />
          </div>
        )}
      </div>

      {/* Audit Detail Inspection Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0a66c2]">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Event Payload</h3>
                  <p className="text-xs text-slate-400 font-mono">{inspectLog._id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase font-semibold block text-[10px]">Action</span>
                  <span className="font-bold text-slate-900">{inspectLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold block text-[10px]">Timestamp</span>
                  <span className="font-mono text-slate-700">{formatExactTime(inspectLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold block text-[10px]">Actor Email</span>
                  <span className="font-semibold text-slate-800">{inspectLog.actor?.email || 'System'}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold block text-[10px]">IP Address</span>
                  <span className="font-mono text-slate-700">{inspectLog.ipAddress || '127.0.0.1'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-600 font-semibold block mb-1">Event Details Payload:</span>
                <pre className="bg-slate-950 text-emerald-400 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56">
                  {JSON.stringify(inspectLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
