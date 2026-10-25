'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function UserGovernancePage() {
  const { user: currentAdmin } = useAuth();
  const isAdmin = currentAdmin?.role === 'admin';

  // Directory State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Action Modals State
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [detailedUserData, setDetailedUserData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Status Change Dialog
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusActionTarget, setStatusActionTarget] = useState(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Role Change Dialog
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleActionTarget, setRoleActionTarget] = useState(null);
  const [newSelectedRole, setNewSelectedRole] = useState('student');
  const [roleActionLoading, setRoleActionLoading] = useState(false);

  // Load User Directory
  useEffect(() => {
    let ignore = false;

    async function fetchUsers() {
      if (!isAdmin) return;
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (roleFilter) params.append('role', roleFilter);
        if (statusFilter) params.append('isActive', statusFilter);

        const res = await api.get(`/admin/users?${params.toString()}`);
        if (!ignore) {
          if (res?.success) {
            setUsers(res.data || []);
            setTotalUsers(res.total || 0);
            setTotalPages(res.totalPages || 1);
          } else {
            setError(res?.message || 'Failed to fetch user directory');
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Cannot load users from backend');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchUsers();

    return () => {
      ignore = true;
    };
  }, [isAdmin, page, limit, searchQuery, roleFilter, statusFilter, reloadTrigger]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  // Inspect User Details
  const handleViewUser = async (targetUser) => {
    setSelectedUser(targetUser);
    setViewDetailsModal(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/users/${targetUser._id}`);
      if (res?.success && res.data) {
        setDetailedUserData(res.data);
      } else {
        setDetailedUserData(targetUser);
      }
    } catch (err) {
      setDetailedUserData(targetUser);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Status Confirmation Dialog
  const handleInitiateStatusToggle = (targetUser) => {
    setActionError(null);
    setActionSuccess(null);
    setStatusActionTarget(targetUser);
    setStatusModalOpen(true);
  };

  // Confirm Status Change
  const handleConfirmStatusToggle = async () => {
    if (!statusActionTarget) return;
    try {
      setStatusActionLoading(true);
      setActionError(null);
      const newStatus = !statusActionTarget.isActive;
      const res = await api.patch(`/admin/users/${statusActionTarget._id}/status`, {
        isActive: newStatus,
      });

      if (res?.success) {
        setActionSuccess(res.message || `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
        setTimeout(() => {
          setStatusModalOpen(false);
          setStatusActionTarget(null);
          setActionSuccess(null);
          setReloadTrigger((prev) => prev + 1);
        }, 1200);
      } else {
        setActionError(res?.message || 'Failed to update user status');
      }
    } catch (err) {
      setActionError(err.message || 'Error updating status');
    } finally {
      setStatusActionLoading(false);
    }
  };

  // Open Role Change Dialog
  const handleInitiateRoleChange = (targetUser) => {
    setActionError(null);
    setActionSuccess(null);
    setRoleActionTarget(targetUser);
    setNewSelectedRole(targetUser.role);
    setRoleModalOpen(true);
  };

  // Confirm Role Change
  const handleConfirmRoleChange = async () => {
    if (!roleActionTarget) return;
    try {
      setRoleActionLoading(true);
      setActionError(null);
      const res = await api.patch(`/admin/users/${roleActionTarget._id}/role`, {
        role: newSelectedRole,
      });

      if (res?.success) {
        setActionSuccess(res.message || `User role updated to ${newSelectedRole}`);
        setTimeout(() => {
          setRoleModalOpen(false);
          setRoleActionTarget(null);
          setActionSuccess(null);
          setReloadTrigger((prev) => prev + 1);
        }, 1200);
      } else {
        setActionError(res?.message || 'Failed to update user role');
      }
    } catch (err) {
      setActionError(err.message || 'Error updating role');
    } finally {
      setRoleActionLoading(false);
    }
  };

  // Guard: Unauthorized if not admin
  if (!isAdmin) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          You do not have administrative privileges to access User Governance.
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
                User Governance & Directory
              </h1>
              <Badge variant="warning" size="sm">
                Admin Console
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Audit user accounts, manage role permissions, toggle activation states, and inspect profile histories.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
              {totalUsers} Registered Accounts
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => setReloadTrigger((prev) => prev + 1)}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email address..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
            >
              <option value="">All Roles</option>
              <option value="student">Students</option>
              <option value="trainer">Trainers</option>
              <option value="admin">Administrators</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Deactivated Only</option>
            </select>

            <Button type="submit" size="sm" variant="primary">
              Search
            </Button>

            {(searchQuery || roleFilter || statusFilter) && (
              <Button type="button" size="sm" variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Error Banner */}
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

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/4" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        ) : users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">User</th>
                    <th className="py-3.5 px-4 font-semibold">Role</th>
                    <th className="py-3.5 px-4 font-semibold">Account Status</th>
                    <th className="py-3.5 px-4 font-semibold">Assignment</th>
                    <th className="py-3.5 px-4 font-semibold">Registered</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = currentAdmin?._id === u._id;
                    return (
                      <tr key={u._id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 leading-snug">
                                {u.name} {isSelf && <span className="text-[10px] text-[#0a66c2] font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1 border border-blue-200">YOU</span>}
                              </p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'warning'
                                : u.role === 'trainer'
                                ? 'success'
                                : 'primary'
                            }
                            size="sm"
                          >
                            {u.role}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {u.role === 'student' ? (
                            u.assignedTrainer ? (
                              <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-[#0a66c2]" />
                                {u.assignedTrainer.name || 'Assigned'}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Unassigned
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not applicable</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {formatDate(u.createdAt)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUser(u)}
                              title="Inspect user details"
                              className="h-8 px-2.5"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInitiateRoleChange(u)}
                              title="Change user role"
                              className="h-8 px-2.5"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" /> Role
                            </Button>

                            <Button
                              size="sm"
                              variant={u.isActive ? 'outline' : 'primary'}
                              onClick={() => handleInitiateStatusToggle(u)}
                              title={u.isActive ? 'Deactivate account' : 'Activate account'}
                              className={`h-8 px-2.5 ${
                                u.isActive
                                  ? 'text-rose-600 hover:text-rose-700 hover:border-rose-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {u.isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 mr-1" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activate
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
              <div>
                Showing page <span className="font-semibold text-slate-900">{page}</span> of{' '}
                <span className="font-semibold text-slate-900">{totalPages}</span> ({totalUsers} total users)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={ChevronRight}
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
              icon={Users}
              title="No users found"
              description="No user accounts matched the specified search criteria or filters."
              action={
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear All Filters
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* MODAL 1: Confirm Status Change */}
      {statusModalOpen && statusActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <div
                  className={`p-2 rounded-xl ${
                    statusActionTarget.isActive
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {statusActionTarget.isActive ? (
                    <UserX className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <span>
                  {statusActionTarget.isActive ? 'Deactivate User Account' : 'Reactivate User Account'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to{' '}
              <strong className={statusActionTarget.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                {statusActionTarget.isActive ? 'deactivate' : 'reactivate'}
              </strong>{' '}
              the account for <strong>{statusActionTarget.name}</strong> ({statusActionTarget.email})?
            </p>

            {statusActionTarget.role === 'trainer' && statusActionTarget.isActive && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold mb-0.5">Automated Workload CAS Unassignment</p>
                  <p>
                    Deactivating a trainer will automatically unassign all students assigned to them in
                    a single safe transaction.
                  </p>
                </div>
              </div>
            )}

            {actionError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs mb-4">
                {actionSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusModalOpen(false)}
                disabled={statusActionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={statusActionTarget.isActive ? 'destructive' : 'primary'}
                onClick={handleConfirmStatusToggle}
                loading={statusActionLoading}
              >
                {statusActionTarget.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Change User Role */}
      {roleModalOpen && roleActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0a66c2]">
                  <Edit2 className="w-5 h-5" />
                </div>
                <span>Change User Role</span>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Update role permission level for <strong>{roleActionTarget.name}</strong> ({roleActionTarget.email}).
            </p>

            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-700 uppercase">Select Target Role</label>
              <div className="grid grid-cols-3 gap-2">
                {['student', 'trainer', 'admin'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewSelectedRole(r)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold capitalize border transition-all ${
                      newSelectedRole === r
                        ? 'bg-blue-50 border-[#0a66c2] text-[#0a66c2]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {roleActionTarget.role === 'trainer' && newSelectedRole !== 'trainer' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4">
                <strong>Notice:</strong> Changing this trainer&apos;s role will unassign all their current students.
              </div>
            )}

            {actionError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs mb-4">
                {actionSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoleModalOpen(false)}
                disabled={roleActionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleConfirmRoleChange}
                loading={roleActionLoading}
                disabled={newSelectedRole === roleActionTarget.role}
              >
                Update Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed User Profile Inspection */}
      {viewDetailsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-sm text-[#0a66c2]">
                  {selectedUser.name ? selectedUser.name.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewDetailsModal(false);
                  setSelectedUser(null);
                  setDetailedUserData(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
                Loading detailed profile from backend...
              </div>
            ) : detailedUserData ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Role</span>
                    <p className="font-semibold text-slate-900 capitalize">{detailedUserData.role}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Account Status</span>
                    <p className={`font-semibold ${detailedUserData.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {detailedUserData.isActive ? 'Active' : 'Deactivated'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">User ID</span>
                    <p className="font-mono text-xs text-slate-700">{detailedUserData._id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Language</span>
                    <p className="text-xs text-slate-700 uppercase font-semibold">
                      {detailedUserData.preferredLanguage || 'en'}
                    </p>
                  </div>
                </div>

                {/* If Student: Show Assessment Summary */}
                {detailedUserData.role === 'student' && detailedUserData.assessmentSummary && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-white">
                    <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#0a66c2]">
                      Assessment Performance Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-xs text-slate-500 block">Tests Done</span>
                        <span className="font-bold text-slate-900 text-base">
                          {detailedUserData.assessmentSummary.totalCompleted ?? 0}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-xs text-slate-500 block">Overall GPA</span>
                        <span className="font-bold text-slate-900 text-base">
                          {detailedUserData.assessmentSummary.averageOverallPercentage ?? 0}%
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-xs text-slate-500 block">Latest Score</span>
                        <span className="font-bold text-slate-900 text-base">
                          {detailedUserData.assessmentSummary.latestOverallPercentage !== null && detailedUserData.assessmentSummary.latestOverallPercentage !== undefined
                            ? `${detailedUserData.assessmentSummary.latestOverallPercentage}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {detailedUserData.assessmentSummary.weakTopics?.length > 0 && (
                      <div>
                        <span className="text-xs text-slate-500 block mb-1 font-medium">Diagnosed Weak Topics:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {detailedUserData.assessmentSummary.weakTopics.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded text-xs bg-rose-50 text-rose-700 border border-rose-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* If Trainer: Show Assigned Student Roster */}
                {detailedUserData.role === 'trainer' && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-900 text-xs uppercase text-[#0a66c2]">
                        Assigned Student Workload
                      </h4>
                      <Badge variant="success" size="sm">
                        {detailedUserData.assignedStudentsCount ?? 0} Students
                      </Badge>
                    </div>

                    {Array.isArray(detailedUserData.assignedStudents) && detailedUserData.assignedStudents.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {detailedUserData.assignedStudents.map((s) => (
                          <div key={s._id} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-900">{s.name}</p>
                              <p className="text-slate-400">{s.email}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {s.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        No students currently assigned to this trainer.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewDetailsModal(false);
                      setSelectedUser(null);
                      setDetailedUserData(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
