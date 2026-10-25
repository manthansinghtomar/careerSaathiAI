'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  User,
  Mail,
  Lock,
  Target,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';

const AVAILABLE_SKILLS = [
  'JavaScript',
  'React',
  'Node.js',
  'MongoDB',
  'Express',
  'SQL',
  'Python',
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    targetRole: 'Full Stack Developer',
    targetTimeline: '3 months',
    currentSkillLevel: 'beginner',
    focusSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
    preferredLanguage: 'en',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard shell
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const toggleSkill = (skill) => {
    setFormData((prev) => {
      const exists = prev.focusSkills.includes(skill);
      if (exists) {
        if (prev.focusSkills.length === 1) return prev; // Keep at least one
        return { ...prev, focusSkills: prev.focusSkills.filter((s) => s !== skill) };
      } else {
        return { ...prev, focusSkills: [...prev.focusSkills, skill] };
      }
    });
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Please enter your full name.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Please enter your email address.';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Please enter a password.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be 6 characters or more.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.focusSkills || formData.focusSkills.length === 0) {
      errors.focusSkills = 'Select at least one focus skill.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        targetRole: formData.targetRole,
        targetTimeline: formData.targetTimeline,
        currentSkillLevel: formData.currentSkillLevel,
        focusSkills: formData.focusSkills,
        preferredLanguage: formData.preferredLanguage,
      });
      router.push('/dashboard');
    } catch {
      // Error handled by AuthContext error state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#f3f4f6]">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-[#0a66c2] text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            CareerSaathi <span className="text-[#0a66c2]">AI</span>
          </span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-slate-900">Join as a Student</h1>
            <Badge variant="primary" size="sm">
              Student Account
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            Accelerate your career preparation with adaptive skill assessments & personalized recommendations
          </p>
        </div>

        {/* Server Error Notification */}
        {authError && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{authError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Section 1: Account Information */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
              Account Credentials
            </h2>

            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: null }));
              }}
              error={formErrors.name}
              icon={User}
              autoComplete="name"
              disabled={submitting}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: null }));
              }}
              error={formErrors.email}
              icon={Mail}
              autoComplete="email"
              disabled={submitting}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="6 or more characters"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: null }));
                  }}
                  error={formErrors.password}
                  icon={Lock}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-8 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <Input
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, confirmPassword: e.target.value });
                    if (formErrors.confirmPassword)
                      setFormErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  error={formErrors.confirmPassword}
                  icon={Lock}
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Career Profile */}
          <div className="space-y-4 pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
              Career Focus & Preferences
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Target Job Role"
                placeholder="e.g. Full Stack Developer"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                icon={Target}
                disabled={submitting}
              />

              <div className="w-full space-y-1 text-left">
                <label className="block text-xs font-semibold text-slate-700">
                  Target Timeline
                </label>
                <select
                  value={formData.targetTimeline}
                  onChange={(e) => setFormData({ ...formData, targetTimeline: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-white border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]"
                  disabled={submitting}
                >
                  <option value="1 month">1 Month (Fast Track)</option>
                  <option value="3 months">3 Months (Recommended)</option>
                  <option value="6 months">6 Months (Comprehensive)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full space-y-1 text-left">
                <label className="block text-xs font-semibold text-slate-700">
                  Current Skill Level
                </label>
                <select
                  value={formData.currentSkillLevel}
                  onChange={(e) => setFormData({ ...formData, currentSkillLevel: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-white border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]"
                  disabled={submitting}
                >
                  <option value="beginner">Beginner (Foundations)</option>
                  <option value="intermediate">Intermediate (Hands-on)</option>
                  <option value="advanced">Advanced (Proficient)</option>
                </select>
              </div>

              <div className="w-full space-y-1 text-left">
                <label className="block text-xs font-semibold text-slate-700">
                  Explanation Language
                </label>
                <select
                  value={formData.preferredLanguage}
                  onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-white border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2]"
                  disabled={submitting}
                >
                  <option value="en">English</option>
                  <option value="hinglish">Hinglish (Hindi + English)</option>
                </select>
              </div>
            </div>

            {/* Focus Skills Selection */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-slate-700">
                Primary Focus Skills (Choose at least one)
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_SKILLS.map((skill) => {
                  const isSelected = formData.focusSkills.includes(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 border cursor-pointer ${
                        isSelected
                          ? 'bg-[#0a66c2] text-white border-[#0a66c2]'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      {skill}
                    </button>
                  );
                })}
              </div>
              {formErrors.focusSkills && (
                <p className="text-xs text-rose-600 font-medium">{formErrors.focusSkills}</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold"
              isLoading={submitting}
              loadingText="Creating account..."
            >
              Agree & Join
            </Button>
          </div>
        </form>

        {/* Footer Navigation */}
        <div className="mt-6 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Already on CareerSaathi AI?{' '}
            <Link
              href="/login"
              className="font-semibold text-[#0a66c2] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Role notice footer */}
      <div className="mt-8 text-center text-xs text-slate-500 max-w-sm leading-relaxed">
        Looking for Trainer or Admin access? Those accounts are provisioned directly by institution administrators.
      </div>
    </div>
  );
}
