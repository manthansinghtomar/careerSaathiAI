'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  User,
  Mail,
  Lock,
  Globe,
  Briefcase,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  Layers,
} from 'lucide-react';

const AVAILABLE_FOCUS_SKILLS = [
  'JavaScript',
  'React',
  'Node.js',
  'MongoDB',
  'Express',
  'TypeScript',
  'SQL',
  'Python',
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    preferredLanguage: user?.preferredLanguage || 'en',
    targetRole: user?.careerProfile?.targetRole || 'Full Stack Developer',
    targetTimeline: user?.careerProfile?.targetTimeline || '3 months',
    currentSkillLevel: user?.careerProfile?.currentSkillLevel || 'beginner',
    focusSkills: Array.isArray(user?.careerProfile?.focusSkills) && user.careerProfile.focusSkills.length > 0
      ? user.careerProfile.focusSkills
      : ['JavaScript', 'React', 'Node.js', 'MongoDB'],
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const userLoadedRef = React.useRef(Boolean(user));

  // Populate form once authenticated user details arrive
  useEffect(() => {
    let ignore = false;
    if (user && !userLoadedRef.current) {
      userLoadedRef.current = true;
      Promise.resolve().then(() => {
        if (!ignore) {
          setFormData({
            name: user.name || '',
            email: user.email || '',
            preferredLanguage: user.preferredLanguage || 'en',
            targetRole: user.careerProfile?.targetRole || 'Full Stack Developer',
            targetTimeline: user.careerProfile?.targetTimeline || '3 months',
            currentSkillLevel: user.careerProfile?.currentSkillLevel || 'beginner',
            focusSkills: Array.isArray(user.careerProfile?.focusSkills) && user.careerProfile.focusSkills.length > 0
              ? user.careerProfile.focusSkills
              : ['JavaScript', 'React', 'Node.js', 'MongoDB'],
          });
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [user]);

  const toggleSkill = (skill) => {
    setFormData((prev) => {
      const exists = prev.focusSkills.includes(skill);
      if (exists) {
        if (prev.focusSkills.length === 1) return prev; // Retain at least one
        return { ...prev, focusSkills: prev.focusSkills.filter((s) => s !== skill) };
      } else {
        return { ...prev, focusSkills: [...prev.focusSkills, skill] };
      }
    });
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Please provide your full name.';
    }

    if (formData.focusSkills.length === 0) {
      errors.focusSkills = 'Select at least one focus skill.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validate()) return;

    try {
      setSaving(true);

      const payload = {
        name: formData.name.trim(),
        preferredLanguage: formData.preferredLanguage,
        targetRole: formData.targetRole.trim(),
        targetTimeline: formData.targetTimeline.trim(),
        currentSkillLevel: formData.currentSkillLevel,
        focusSkills: formData.focusSkills,
      };

      const res = await api.put('/auth/profile', payload);

      if (res?.success) {
        setSuccessMessage('Profile and career preferences updated successfully.');
        await refreshUser();
      } else {
        setErrorMessage(res?.message || 'Failed to update profile.');
      }
    } catch (err) {
      setErrorMessage(err?.data?.message || err?.message || 'Network error while updating profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Profile &amp; Settings
            </h1>
            <Badge
              variant={
                user?.role === 'admin'
                  ? 'warning'
                  : user?.role === 'trainer'
                  ? 'success'
                  : 'primary'
              }
              size="sm"
            >
              {user?.role ? user.role.toUpperCase() : 'STUDENT'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Manage your personal profile, preferred language, target job role, and technical skill goals.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="font-semibold leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="font-semibold leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Identity */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
            <User className="w-4 h-4 text-[#0a66c2]" />
            <span>Personal Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Alex Johnson"
              error={formErrors.name}
              disabled={saving}
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <Lock className="w-3 h-3" />
                  Read-only
                </span>
              </div>
              <input
                type="email"
                value={formData.email}
                readOnly
                disabled
                className="w-full h-10 rounded-md bg-slate-50 border border-slate-200 px-3 text-sm text-slate-500 cursor-not-allowed select-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Account email is linked to active session tokens and cannot be changed here.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Preferred Language & AI Interaction */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
            <Globe className="w-4 h-4 text-[#0a66c2]" />
            <span>Preferred Language for AI Explanations</span>
          </div>

          <p className="text-xs text-slate-500">
            Choose how questions, explanations, AI rubric feedback, and recommendations are authored.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                formData.preferredLanguage === 'en'
                  ? 'border-[#0a66c2] bg-blue-50/70 shadow-xs ring-1 ring-[#0a66c2]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="preferredLanguage"
                value="en"
                checked={formData.preferredLanguage === 'en'}
                onChange={() => setFormData({ ...formData, preferredLanguage: 'en' })}
                className="mt-0.5 text-[#0a66c2]"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block mb-0.5">
                  English (Standard)
                </span>
                <span className="text-xs text-slate-500 leading-relaxed block">
                  Professional technical English for standard industry interview assessments.
                </span>
              </div>
            </label>

            <label
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                formData.preferredLanguage === 'hinglish'
                  ? 'border-[#0a66c2] bg-blue-50/70 shadow-xs ring-1 ring-[#0a66c2]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="preferredLanguage"
                value="hinglish"
                checked={formData.preferredLanguage === 'hinglish'}
                onChange={() => setFormData({ ...formData, preferredLanguage: 'hinglish' })}
                className="mt-0.5 text-[#0a66c2]"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block mb-0.5">
                  Hinglish (Roman Script)
                </span>
                <span className="text-xs text-slate-500 leading-relaxed block">
                  Conversational Roman-script Hindi/English mix for accessible coaching and explanations.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: Career Calibration & Target Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
            <Briefcase className="w-4 h-4 text-[#0a66c2]" />
            <span>Target Role &amp; Experience Level</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Input
                label="Target Job Role"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                placeholder="e.g. Full Stack Developer"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Timeline
              </label>
              <select
                value={formData.targetTimeline}
                onChange={(e) => setFormData({ ...formData, targetTimeline: e.target.value })}
                disabled={saving}
                className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2]"
              >
                <option value="1 month">1 month (Accelerated)</option>
                <option value="3 months">3 months (Standard)</option>
                <option value="6 months">6 months (Comprehensive)</option>
                <option value="1 year">1 year (Long-term Mastery)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Current Skill Level
              </label>
              <select
                value={formData.currentSkillLevel}
                onChange={(e) => setFormData({ ...formData, currentSkillLevel: e.target.value })}
                disabled={saving}
                className="w-full h-10 rounded-md bg-white border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0a66c2] focus:border-[#0a66c2]"
              >
                <option value="beginner">Beginner (Foundations)</option>
                <option value="intermediate">Intermediate (Hands-on)</option>
                <option value="advanced">Advanced (Production Engineering)</option>
              </select>
            </div>
          </div>

          {/* Focus Skills */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Focus Skills for Recommendations <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_FOCUS_SKILLS.map((skill) => {
                const isSelected = formData.focusSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-[#0a66c2] bg-blue-50/70 text-[#0a66c2]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{skill}</span>
                    {isSelected && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
            {formErrors.focusSkills && (
              <p className="text-xs text-rose-600 mt-1">{formErrors.focusSkills}</p>
            )}
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={saving}
            loadingText="Saving Changes..."
            icon={Save}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
