'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  FileText,
  SlidersHorizontal,
  PenTool,
} from 'lucide-react';

const TOPICS = ['all', 'JavaScript', 'React', 'Node.js', 'MongoDB'];
const DIFFICULTIES = ['all', 'easy', 'medium', 'hard'];
const TYPES = ['all', 'mcq', 'text'];

export default function QuestionBankPage() {
  const { user } = useAuth();
  const userRole = user?.role || 'student';

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Form Fields
  const [formType, setFormType] = useState('mcq'); // 'mcq' | 'text'
  const [formTopic, setFormTopic] = useState('JavaScript');
  const [formSubtopic, setFormSubtopic] = useState('General');
  const [formDifficulty, setFormDifficulty] = useState('medium');
  const [formTargetRole, setFormTargetRole] = useState('Full Stack Developer');
  const [formQuestionEn, setFormQuestionEn] = useState('');
  const [formExplanationEn, setFormExplanationEn] = useState('');
  const [formQuestionHinglish, setFormQuestionHinglish] = useState('');
  const [formOptions, setFormOptions] = useState([
    { id: 'A', textEn: '' },
    { id: 'B', textEn: '' },
    { id: 'C', textEn: '' },
    { id: 'D', textEn: '' },
  ]);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('A');
  const [formTags, setFormTags] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (userRole !== 'trainer' && userRole !== 'admin') {
      return;
    }

    async function load() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
        });
        if (search.trim()) params.append('search', search.trim());
        if (topic !== 'all') params.append('topic', topic);
        if (difficulty !== 'all') params.append('difficulty', difficulty);
        if (type !== 'all') params.append('type', type);

        const res = await api.get(`/questions?${params.toString()}`);
        if (!ignore) {
          if (res?.success) {
            setQuestions(res.data || []);
            setTotalPages(res.pages || 1);
            setTotalCount(res.total || 0);
            setError(null);
          } else {
            setError('Failed to load question bank');
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Error connecting to question bank service');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [userRole, page, search, topic, difficulty, type, reloadIndex]);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    setReloadIndex((i) => i + 1);
  }, []);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormType('mcq');
    setFormTopic('JavaScript');
    setFormSubtopic('General');
    setFormDifficulty('medium');
    setFormTargetRole('Full Stack Developer');
    setFormQuestionEn('');
    setFormExplanationEn('');
    setFormQuestionHinglish('');
    setFormOptions([
      { id: 'A', textEn: '' },
      { id: 'B', textEn: '' },
      { id: 'C', textEn: '' },
      { id: 'D', textEn: '' },
    ]);
    setFormCorrectAnswer('A');
    setFormTags('');
    setFormError(null);
    setFormSuccess(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (q) => {
    resetForm();
    setIsEditing(true);
    setEditingId(q._id);
    setIsModalOpen(true);

    try {
      const res = await api.get(`/questions/${q._id}`);
      if (res?.success && res.data) {
        const full = res.data;
        setFormType(full.type || 'mcq');
        setFormTopic(full.topic || 'JavaScript');
        setFormSubtopic(full.subtopic || 'General');
        setFormDifficulty(full.difficulty || 'medium');
        setFormTargetRole(full.targetRole || 'Full Stack Developer');
        setFormQuestionEn(full.content?.en?.question || '');
        setFormExplanationEn(full.content?.en?.explanation || '');
        setFormQuestionHinglish(full.content?.hinglish?.question || '');
        setFormTags(Array.isArray(full.tags) ? full.tags.join(', ') : '');

        if (full.type === 'mcq') {
          if (Array.isArray(full.options) && full.options.length > 0) {
            setFormOptions(
              full.options.map((opt) => ({
                id: opt.id,
                textEn: opt.text?.en || '',
              }))
            );
          }
          setFormCorrectAnswer(full.correctAnswer || 'A');
        } else {
          setFormCorrectAnswer(full.correctAnswer || '');
        }
      }
    } catch (err) {
      setFormError('Cannot load full question details for editing');
    }
  };

  const handleSaveQuestion = async (e) => {
    e?.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formQuestionEn.trim()) {
      setFormError('English question text is required');
      return;
    }

    if (formType === 'mcq') {
      const hasEmptyOpt = formOptions.some((opt) => !opt.textEn.trim());
      if (hasEmptyOpt) {
        setFormError('All MCQ options must contain non-empty text');
        return;
      }
      if (!formCorrectAnswer) {
        setFormError('Please select a correct answer option ID');
        return;
      }
    } else {
      if (!formCorrectAnswer.trim()) {
        setFormError('Reference answer or rubric criteria is required for text questions');
        return;
      }
    }

    try {
      setFormSubmitting(true);

      const payload = {
        targetRole: formTargetRole.trim(),
        topic: formTopic,
        subtopic: formSubtopic.trim(),
        difficulty: formDifficulty,
        type: formType,
        content: {
          en: {
            question: formQuestionEn.trim(),
            explanation: formExplanationEn.trim(),
          },
          hinglish: {
            question: formQuestionHinglish.trim(),
          },
        },
        correctAnswer: formCorrectAnswer.trim(),
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (formType === 'mcq') {
        payload.options = formOptions.map((opt) => ({
          id: opt.id,
          text: { en: opt.textEn.trim() },
        }));
      }

      let res;
      if (isEditing && editingId) {
        res = await api.put(`/questions/${editingId}`, payload);
      } else {
        res = await api.post('/questions', payload);
      }

      if (res?.success) {
        setFormSuccess(isEditing ? 'Question updated successfully!' : 'Question created successfully!');
        setTimeout(() => {
          setIsModalOpen(false);
          resetForm();
          fetchQuestions();
        }, 800);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save question');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (q) => {
    try {
      await api.patch(`/questions/${q._id}/status`, { isActive: !q.isActive });
      fetchQuestions();
    } catch (err) {
      alert(err.message || 'Cannot update question status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await api.delete(`/questions/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchQuestions();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete question');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Role Protection
  if (userRole === 'student') {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center max-w-lg mx-auto shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h3>
        <p className="text-sm text-slate-600 mb-4">
          The Question Bank curation repository is reserved for trainers and platform administrators.
        </p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Question Bank
              </h1>
              <Badge variant="primary" size="sm">
                {totalCount} Questions
              </Badge>
            </div>
            <p className="text-sm text-slate-600">
              Manage technical questions, configure options, and calibrate reference answers for automatic AI evaluation.
            </p>
          </div>

          <Button icon={Plus} onClick={handleOpenAddModal}>
            Add Question
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by text, subtopic, or tags..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-[#0a66c2] bg-white text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Topic Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Topic:</span>
            <select
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-[#0a66c2]"
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All Topics' : t}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Difficulty:</span>
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-800 capitalize focus:outline-none focus:border-[#0a66c2]"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d === 'all' ? 'All Difficulties' : d}
                </option>
              ))}
            </select>
          </div>

          {/* Type Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Type:</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-800 uppercase focus:outline-none focus:border-[#0a66c2]"
            >
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {tp === 'all' ? 'All Types' : tp.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        {loading ? (
          <div className="space-y-3 animate-pulse py-4">
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-14 bg-slate-100 rounded-lg" />
            <div className="h-14 bg-slate-100 rounded-lg" />
            <div className="h-14 bg-slate-100 rounded-lg" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900 mb-2">{error}</p>
            <Button onClick={fetchQuestions} variant="secondary" size="sm" icon={RotateCcw}>
              Retry
            </Button>
          </div>
        ) : questions.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead className="w-2/5">Question Preview</TableHead>
                  <TableHead>Topic & Subtopic</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q._id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm line-clamp-2">
                          {q.content?.en?.question}
                        </p>
                        {q.content?.hinglish?.question && (
                          <p className="text-xs text-slate-400 italic line-clamp-1 mt-0.5">
                            {q.content.hinglish.question}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">{q.topic}</span>
                        <span className="text-[11px] text-slate-400">{q.subtopic || 'General'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={q.type === 'mcq' ? 'primary' : 'warning'}
                        size="sm"
                      >
                        {q.type === 'mcq' ? 'MCQ' : 'Descriptive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          q.difficulty === 'hard'
                            ? 'danger'
                            : q.difficulty === 'medium'
                            ? 'warning'
                            : 'success'
                        }
                        size="sm"
                      >
                        {q.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleStatus(q)}
                        title={q.isActive ? 'Click to deactivate' : 'Click to activate'}
                        className="cursor-pointer"
                      >
                        <Badge variant={q.isActive ? 'success' : 'neutral'} size="sm" dot>
                          {q.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(q)}
                          title="Edit Question"
                          className="p-1.5 text-slate-400 hover:text-[#0a66c2] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(q)}
                          title="Delete Question"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-sm">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages} ({totalCount} total)
                </span>
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
            )}
          </>
        ) : (
          <EmptyState
            icon={HelpCircle}
            title="No questions found"
            description={
              search.trim()
                ? `No questions matching search term "${search}".`
                : 'No questions matching the selected filter criteria.'
            }
            action={
              <Button icon={Plus} onClick={handleOpenAddModal}>
                Create New Question
              </Button>
            }
          />
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Question' : 'Add New Question'}
        size="lg"
      >
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
              Question Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormType('mcq')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  formType === 'mcq'
                    ? 'border-[#0a66c2] bg-blue-50/50 ring-1 ring-[#0a66c2]'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-xs text-slate-900 block">Multiple Choice (MCQ)</span>
                <span className="text-[11px] text-slate-500">Auto-evaluated radio options</span>
              </button>

              <button
                type="button"
                onClick={() => setFormType('text')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  formType === 'text'
                    ? 'border-[#0a66c2] bg-blue-50/50 ring-1 ring-[#0a66c2]'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-xs text-slate-900 block">Descriptive (Text)</span>
                <span className="text-[11px] text-slate-500">AI-evaluated answer rubric</span>
              </button>
            </div>
          </div>

          {/* Topic & Difficulty Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Topic</label>
              <select
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
              >
                <option value="JavaScript">JavaScript</option>
                <option value="React">React</option>
                <option value="Node.js">Node.js</option>
                <option value="MongoDB">MongoDB</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Subtopic</label>
              <input
                type="text"
                value={formSubtopic}
                onChange={(e) => setFormSubtopic(e.target.value)}
                placeholder="e.g. Async/Await, Hooks"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Difficulty</label>
              <select
                value={formDifficulty}
                onChange={(e) => setFormDifficulty(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900 capitalize focus:outline-none focus:border-[#0a66c2]"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Question Text (EN) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              English Question Text <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formQuestionEn}
              onChange={(e) => setFormQuestionEn(e.target.value)}
              placeholder="Enter technical question prompt..."
              className="w-full text-xs rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
              required
            />
          </div>

          {/* Hinglish Question Text (Optional) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Roman Hinglish Question (Optional)
            </label>
            <input
              type="text"
              value={formQuestionHinglish}
              onChange={(e) => setFormQuestionHinglish(e.target.value)}
              placeholder="e.g. JavaScript me closure kya hota hai aur kaise work karta hai?"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
            />
          </div>

          {/* MCQ Options vs Text Rubric */}
          {formType === 'mcq' ? (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 uppercase block">
                Answer Options & Correct Key
              </label>
              <div className="space-y-2">
                {formOptions.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {opt.id}
                    </span>
                    <input
                      type="text"
                      value={opt.textEn}
                      onChange={(e) => {
                        const next = [...formOptions];
                        next[idx].textEn = e.target.value;
                        setFormOptions(next);
                      }}
                      placeholder={`Option ${opt.id} text...`}
                      className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
                      required
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="correctAnswerKey"
                        checked={formCorrectAnswer === opt.id}
                        onChange={() => setFormCorrectAnswer(opt.id)}
                        className="text-[#0a66c2] focus:ring-[#0a66c2]"
                      />
                      <span>Correct Key</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reference Answer / AI Evaluation Rubric Criteria <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={formCorrectAnswer}
                onChange={(e) => setFormCorrectAnswer(e.target.value)}
                placeholder="Specify the key technical concepts and keywords that the Gemini AI evaluator must look for in the student's answer..."
                className="w-full text-xs rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
                required
              />
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Explanation (Revealed to students on results page)
            </label>
            <textarea
              rows={2}
              value={formExplanationEn}
              onChange={(e) => setFormExplanationEn(e.target.value)}
              placeholder="Detailed technical explanation of the correct solution..."
              className="w-full text-xs rounded-lg border border-slate-200 p-3 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tags (Comma-separated)
            </label>
            <input
              type="text"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="e.g. closures, scope, es6"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:border-[#0a66c2]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : isEditing ? 'Update Question' : 'Create Question'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Question"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to delete this question? This action will permanently remove it from the Question Bank.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
            <strong>{deleteTarget?.topic}:</strong> {deleteTarget?.content?.en?.question}
          </div>

          {deleteError && (
            <p className="text-xs text-rose-600">{deleteError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
