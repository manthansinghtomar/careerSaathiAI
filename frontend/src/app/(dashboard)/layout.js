'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/shared/Sidebar';
import { Topbar } from '@/components/shared/Topbar';
import { Sparkles, Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Loading state while verifying token & session
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f3f4f6] p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col items-center text-center max-w-xs w-full">
          <div className="w-12 h-12 rounded-lg bg-[#0a66c2] text-white flex items-center justify-center mb-4 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">CareerSaathi AI</h2>
          <p className="text-xs text-slate-500 mb-4">Verifying session...</p>
          <Loader2 className="w-5 h-5 text-[#0a66c2] animate-spin" />
        </div>
      </div>
    );
  }

  // If not authenticated, guard will redirect to /login
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col">
      {/* Sidebar (Fixed on desktop, drawer on mobile) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
