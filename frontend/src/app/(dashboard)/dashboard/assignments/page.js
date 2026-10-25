'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  UserCheck,
  Users,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserX,
  ArrowRight,
  ShieldAlert,
  X,
  Layers,
  GraduationCap,
} from 'lucide-react';

export default function AssignmentManagementPage() {
  const { user: currentAdmin } = useAuth();
  const isAdmin = currentAdmin?.role === 'admin';

  // Active Tab: 'trainers' | 'unassigned'
  const [activeTab, setActiveTab] = useState('unassigned');

  // Trainers State
  const [trainers, setTrainers] = useState([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState(null);
  const [trainerStudents, setTrainerStudents] = useState([]);
  const [loadingTrainerStudents, setLoadingTrainerStudents] = useState(false);

  // Unassigned Students State
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [unassignedTotalPages, setUnassignedTotalPages] = useState(1);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Bulk Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Modals & Action State
  const [singleAssignModalOpen, setSingleAssignModalOpen] = useState(false);
  const [targetStudentForAssign, setTargetStudentForAssign] = useState(null);
  const [chosenTrainerId, setChosenTrainerId] = useState('');

  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkTargetTrainerId, setBulkTargetTrainerId] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // 1. Fetch Trainers Roster
  useEffect(() => {
    let ignore = false;
    async function loadTrainers() {
      if (!isAdmin) return;
      try {
        setLoadingTrainers(true);
        const res = await api.get('/admin/trainers');
        if (!ignore && res?.success) {
          setTrainers(res.data || []);
        }
      } catch (err) {
        if (!ignore) console.error('Failed to load trainers', err);
      } finally {
        if (!ignore) setLoadingTrainers(false);
      }
    }
    loadTrainers();
    return () => {
      ignore = true;
    };
  }, [isAdmin, reloadTrigger]);

  // 2. Fetch Unassigned Students
  useEffect(() => {
    let ignore = false;
    async function loadUnassigned() {
      if (!isAdmin) return;
      try {
        setLoadingUnassigned(true);
        const params = new URLSearchParams();
        params.append('page', unassignedPage.toString());
        params.append('limit', '10');
        if (unassignedSearch.trim()) params.append('search', unassignedSearch.trim());

        const res = await api.get(`/admin/students/unassigned?${params.toString()}`);
        if (!ignore && res?.success) {
          setUnassignedStudents(res.data || []);
          setUnassignedTotal(res.total || 0);
          setUnassignedTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        if (!ignore) console.error('Failed to load unassigned students', err);
      } finally {
        if (!ignore) setLoadingUnassigned(false);
      }
    }
    loadUnassigned();
    return () => {
      ignore = true;
    };
  }, [isAdmin, unassignedPage, unassignedSearch, reloadTrigger]);

  // 3. Fetch Students for Selected Trainer Filter
  useEffect(() => {
    let ignore = false;
    async function loadTrainerCohort() {
      if (!isAdmin || !selectedTrainerFilter) return;
      try {
        setLoadingTrainerStudents(true);
        const res = await api.get(`/admin/users?role=student&trainerId=${selectedTrainerFilter._id}&limit=50`);
        if (!ignore && res?.success) {
          setTrainerStudents(res.data || []);
        }
      } catch (err) {
        if (!ignore) console.error('Failed to load trainer cohort', err);
      } finally {
        if (!ignore) setLoadingTrainerStudents(false);
      }
    }
    loadTrainerCohort();
    return () => {
      ignore = true;
    };
  }, [isAdmin, selectedTrainerFilter, reloadTrigger]);

  // Handle Unassigned Search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setUnassignedPage(1);
    setUnassignedSearch(searchInput);
  };

  // Toggle selection for bulk assignment
  const handleToggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAllUnassignedOnPage = () => {
    if (selectedStudentIds.size === unassignedStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(unassignedStudents.map((s) => s._id)));
    }
  };

  // Open Single Assign Modal
  const handleOpenSingleAssign = (student) => {
    setTargetStudentForAssign(student);
    setChosenTrainerId(student.assignedTrainer?._id || student.assignedTrainer || '');
    setActionError(null);
    setActionSuccess(null);
    setSingleAssignModalOpen(true);
  };

  // Execute Single Assign / Unassign
  const handleExecuteSingleAssign = async () => {
    if (!targetStudentForAssign) return;
    try {
      setActionLoading(true);
      setActionError(null);

      const payload = {
        studentId: targetStudentForAssign._id,
        trainerId: chosenTrainerId || null,
      };

      const res = await api.post('/admin/assignments', payload);
      if (res?.success) {
        setActionSuccess(res.message || 'Assignment updated successfully');
        setTimeout(() => {
          setSingleAssignModalOpen(false);
          setTargetStudentForAssign(null);
          setActionSuccess(null);
          setReloadTrigger((p) => p + 1);
        }, 1200);
      } else {
        setActionError(res?.message || 'Failed to update assignment');
      }
    } catch (err) {
      setActionError(err.message || 'Error executing assignment');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Bulk Assign Modal
  const handleOpenBulkAssign = () => {
    if (selectedStudentIds.size === 0) return;
    setBulkTargetTrainerId(trainers[0]?._id || '');
    setActionError(null);
    setActionSuccess(null);
    setBulkAssignModalOpen(true);
  };

  // Execute Bulk Assignment
  const handleExecuteBulkAssign = async () => {
    if (selectedStudentIds.size === 0) return;
    try {
      setActionLoading(true);
      setActionError(null);

      const payload = {
        studentIds: Array.from(selectedStudentIds),
        trainerId: bulkTargetTrainerId || null,
      };

      const res = await api.post('/admin/assignments/bulk', payload);
      if (res?.success) {
        const modifiedCount = res.data?.summary?.databaseModified ?? selectedStudentIds.size;
        setActionSuccess(`Bulk operation complete: ${modifiedCount} student(s) updated`);
        setTimeout(() => {
          setBulkAssignModalOpen(false);
          setSelectedStudentIds(new Set());
          setActionSuccess(null);
          setReloadTrigger((p) => p + 1);
        }, 1200);
      } else {
        setActionError(res?.message || 'Bulk assignment failed');
      }
    } catch (err) {
      setActionError(err.message || 'Error executing bulk assignment');
    } finally {
      setActionLoading(false);
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
          You do not have administrative privileges to access Trainer &amp; Student Assignments.
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const totalAssignedStudents = trainers.reduce((sum, t) => sum + (t.assignedStudentsCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Trainer &amp; Student Allocations
              </h1>
              <Badge variant="warning" size="sm">
                Admin Console
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Manage trainer workloads, assign students from the unallocated pool, and execute batch student transfers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => setReloadTrigger((p) => p + 1)}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Allocation Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Active Trainers</p>
              <h3 className="text-2xl font-bold text-slate-900">{trainers.length}</h3>
              <p className="text-xs text-slate-400">Available mentors</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#0a66c2]">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Assigned Students</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalAssignedStudents}</h3>
              <p className="text-xs text-slate-400">Across all active cohorts</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Unassigned Pool</p>
              <h3 className="text-2xl font-bold text-slate-900">{unassignedTotal}</h3>
              <p className="text-xs text-amber-700 font-medium">Awaiting mentor allocation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab('unassigned');
            setSelectedTrainerFilter(null);
          }}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'unassigned'
              ? 'border-[#0a66c2] text-[#0a66c2]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Unassigned Student Pool
          {unassignedTotal > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
              {unassignedTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trainers')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'trainers'
              ? 'border-[#0a66c2] text-[#0a66c2]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Trainer Rosters &amp; Workload ({trainers.length})
        </button>
      </div>

      {/* TAB 1: Unassigned Student Pool */}
      {activeTab === 'unassigned' && (
        <div className="space-y-4">
          {/* Action and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search unassigned by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              />
            </form>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {selectedStudentIds.size > 0 && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Layers}
                  onClick={handleOpenBulkAssign}
                >
                  Allocate {selectedStudentIds.size} Selected Students
                </Button>
              )}
            </div>
          </div>

          {/* Unassigned Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {loadingUnassigned ? (
              <div className="p-10 space-y-3 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/4" />
                <div className="h-10 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
              </div>
            ) : unassignedStudents.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={
                              unassignedStudents.length > 0 &&
                              selectedStudentIds.size === unassignedStudents.length
                            }
                            onChange={handleSelectAllUnassignedOnPage}
                            className="rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]"
                          />
                        </th>
                        <th className="py-3 px-4 font-semibold">Student</th>
                        <th className="py-3 px-4 font-semibold">Registered</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unassignedStudents.map((s) => {
                        const isSelected = selectedStudentIds.has(s._id);
                        return (
                          <tr
                            key={s._id}
                            className={`hover:bg-slate-50/75 transition-colors ${
                              isSelected ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudentSelection(s._id)}
                                className="rounded border-slate-300 text-[#0a66c2] focus:ring-[#0a66c2]"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{s.name}</p>
                              <p className="text-xs text-slate-500">{s.email}</p>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {formatDate(s.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                Unassigned
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSingleAssign(s)}
                                className="h-8 text-xs font-semibold"
                              >
                                <UserCheck className="w-3.5 h-3.5 mr-1 text-[#0a66c2]" /> Assign Trainer
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
                    Page <span className="font-semibold text-slate-900">{unassignedPage}</span> of{' '}
                    <span className="font-semibold text-slate-900">{unassignedTotalPages}</span> (
                    {unassignedTotal} unassigned)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unassignedPage <= 1}
                      onClick={() => setUnassignedPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unassignedPage >= unassignedTotalPages}
                      onClick={() => setUnassignedPage((p) => Math.min(unassignedTotalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10">
                <EmptyState
                  icon={CheckCircle2}
                  title="No unassigned students"
                  description="All active students on the platform are currently allocated to trainers."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Trainer Rosters & Workload */}
      {activeTab === 'trainers' && (
        <div className="space-y-6">
          {/* Trainer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingTrainers ? (
              <div className="col-span-full p-8 text-center text-slate-400">Loading trainers...</div>
            ) : trainers.length > 0 ? (
              trainers.map((t) => {
                const isSelected = selectedTrainerFilter?._id === t._id;
                return (
                  <div
                    key={t._id}
                    className={`bg-white border rounded-xl p-5 transition-all shadow-xs ${
                      isSelected
                        ? 'border-[#0a66c2] ring-2 ring-[#0a66c2]/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-sm">
                          {t.name ? t.name.slice(0, 2).toUpperCase() : 'TR'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">{t.name}</h4>
                          <p className="text-xs text-slate-400">{t.email}</p>
                        </div>
                      </div>
                      <Badge variant="success" size="sm">
                        Active
                      </Badge>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 font-medium">Assigned Workload</span>
                      <span className="font-bold text-sm text-purple-700">
                        {t.assignedStudentsCount || 0} Students
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        variant={isSelected ? 'primary' : 'outline'}
                        onClick={() => setSelectedTrainerFilter(isSelected ? null : t)}
                        className="w-full text-xs font-semibold"
                      >
                        {isSelected ? 'Viewing Cohort Below' : 'View Assigned Students'}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full">
                <EmptyState
                  icon={GraduationCap}
                  title="No active trainers found"
                  description="Register or promote users to the trainer role in User Governance to assign students."
                />
              </div>
            )}
          </div>

          {/* Selected Trainer Cohort Details */}
          {selectedTrainerFilter && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Students Assigned to {selectedTrainerFilter.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedTrainerFilter.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTrainerFilter(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-medium inline-flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Close Cohort View
                </button>
              </div>

              {loadingTrainerStudents ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading student roster...</div>
              ) : trainerStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-600 text-xs uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Student Name</th>
                        <th className="py-3 px-4 font-semibold">Email</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trainerStudents.map((st) => (
                        <tr key={st._id} className="hover:bg-slate-50/75">
                          <td className="py-3 px-4 font-medium text-slate-900">{st.name}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">{st.email}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-semibold text-emerald-600">Active</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSingleAssign(st)}
                              className="h-8 text-xs"
                            >
                              Reassign / Unassign
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No students currently assigned to this trainer.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Single Assign / Reassign */}
      {singleAssignModalOpen && targetStudentForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0a66c2]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span>Assign Student to Trainer</span>
              </div>
              <button
                type="button"
                onClick={() => setSingleAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs">
              <p className="font-semibold text-slate-900">{targetStudentForAssign.name}</p>
              <p className="text-slate-500">{targetStudentForAssign.email}</p>
            </div>

            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Select Designated Trainer
              </label>
              <select
                value={chosenTrainerId}
                onChange={(e) => setChosenTrainerId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              >
                <option value="">-- Unassign (Remove Trainer) --</option>
                {trainers.map((tr) => (
                  <option key={tr._id} value={tr._id}>
                    {tr.name} ({tr.assignedStudentsCount || 0} students)
                  </option>
                ))}
              </select>
            </div>

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
                onClick={() => setSingleAssignModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleExecuteSingleAssign}
                loading={actionLoading}
              >
                Save Allocation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Assign */}
      {bulkAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <Layers className="w-5 h-5" />
                </div>
                <span>Bulk Allocate Students</span>
              </div>
              <button
                type="button"
                onClick={() => setBulkAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              You are assigning <strong className="text-purple-700">{selectedStudentIds.size}</strong> selected students to a single trainer cohort in a single safe transaction.
            </p>

            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Target Trainer
              </label>
              <select
                value={bulkTargetTrainerId}
                onChange={(e) => setBulkTargetTrainerId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              >
                {trainers.map((tr) => (
                  <option key={tr._id} value={tr._id}>
                    {tr.name} ({tr.assignedStudentsCount || 0} students currently)
                  </option>
                ))}
              </select>
            </div>

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
                onClick={() => setBulkAssignModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleExecuteBulkAssign}
                loading={actionLoading}
              >
                Confirm Bulk Allocation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
