'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard shell
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Please enter your email.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      errors.password = 'Password must be 6 characters or more.';
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
      await login(email, password);
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
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600 mt-1">
            Stay updated on your career assessments & skill milestones
          </p>
        </div>

        {/* Server Error Notification */}
        {authError && (
          <div className="mb-5 flex items-start gap-3 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{authError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: null }));
              }}
              error={formErrors.email}
              icon={Mail}
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: null }));
              }}
              error={formErrors.password}
              icon={Lock}
              autoComplete="current-password"
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

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold"
              isLoading={submitting}
              loadingText="Signing in..."
            >
              Sign in
            </Button>
          </div>
        </form>

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium">New member?</span>
          </div>
        </div>

        {/* Register CTA */}
        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center w-full h-11 px-6 rounded-full border border-slate-400 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-500 transition-colors"
          >
            Join CareerSaathi AI
          </Link>
        </div>
      </div>

      {/* Role notice footer */}
      <div className="mt-8 text-center text-xs text-slate-500 max-w-sm leading-relaxed">
        CareerSaathi AI connects Students, Trainers, and Administrators.
        Public registration provisions Student accounts.
      </div>
    </div>
  );
}
