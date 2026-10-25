'use client';

import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';

/**
 * Custom hook to consume authentication context.
 * Enforces usage within an AuthProvider hierarchy.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default useAuth;
