'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, clearAuthToken, getAuthToken, ApiError } from '@/lib/api';

export const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshUser: async () => {},
  clearError: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Fetch current authenticated user profile using active token.
   */
  const refreshUser = useCallback(async () => {
    try {
      const activeToken = getAuthToken();
      if (!activeToken) {
        setUser(null);
        setToken(null);
        return null;
      }

      setAuthToken(activeToken);
      const response = await api.get('/auth/me');
      if (response?.success && response?.user) {
        setUser(response.user);
        setToken(activeToken);
        return response.user;
      } else {
        throw new Error('Failed to retrieve user profile');
      }
    } catch (err) {
      // Clear invalid or expired credentials
      if (err?.status === 401 || err?.status === 403) {
        clearAuthToken();
        setUser(null);
        setToken(null);
      }
      throw err;
    }
  }, []);

  /**
   * Initial session bootstrap on mount & cross-tab synchronization.
   */
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        setAuthToken(storedToken);
        const response = await api.get('/auth/me');
        if (isMounted && response?.success && response?.user) {
          setUser(response.user);
          setToken(storedToken);
        }
      } catch (err) {
        if (isMounted) {
          if (err?.status === 401 || err?.status === 403) {
            clearAuthToken();
            setUser(null);
            setToken(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    // Cross-tab synchronization listener
    const handleStorageChange = async (event) => {
      if (event.key === 'token') {
        const newToken = event.newValue;
        if (!newToken) {
          // Token removed in another tab -> sync logout immediately
          clearAuthToken();
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        } else {
          // Token updated in another tab -> sync user session
          setAuthToken(newToken);
          try {
            const response = await api.get('/auth/me');
            if (isMounted && response?.success && response?.user) {
              setUser(response.user);
              setToken(newToken);
            }
          } catch {
            if (isMounted) {
              clearAuthToken();
              setUser(null);
              setToken(null);
            }
          }
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, []);

  /**
   * Authenticate user with email and password.
   */
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', {
        email: email?.trim(),
        password,
      });

      if (!response?.success || !response?.token) {
        throw new ApiError(response?.message || 'Authentication failed', 400);
      }

      const receivedToken = response.token;
      const receivedUser = response.user;

      setAuthToken(receivedToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', receivedToken);
      }

      setUser(receivedUser);
      setToken(receivedToken);
      return { success: true, user: receivedUser };
    } catch (err) {
      const message =
        err?.data?.message || err?.message || 'Invalid email or password.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register a new student.
   * Backend strictly forces role: 'student'.
   */
  const register = useCallback(async (registrationData) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        name: registrationData.name?.trim(),
        email: registrationData.email?.trim(),
        password: registrationData.password,
        targetRole: registrationData.targetRole?.trim() || 'Full Stack Developer',
        targetTimeline: registrationData.targetTimeline?.trim() || '3 months',
        currentSkillLevel: registrationData.currentSkillLevel || 'beginner',
        focusSkills: Array.isArray(registrationData.focusSkills) && registrationData.focusSkills.length > 0
          ? registrationData.focusSkills
          : ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        preferredLanguage: registrationData.preferredLanguage === 'hinglish' ? 'hinglish' : 'en',
      };

      const response = await api.post('/auth/register', payload);

      if (!response?.success || !response?.token) {
        throw new ApiError(response?.message || 'Registration failed', 400);
      }

      const receivedToken = response.token;
      const receivedUser = response.user;

      setAuthToken(receivedToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', receivedToken);
      }

      setUser(receivedUser);
      setToken(receivedToken);
      return { success: true, user: receivedUser };
    } catch (err) {
      const message =
        err?.data?.message || err?.message || 'Registration failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user, clear storage and sync across tabs.
   */
  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setToken(null);
    setError(null);
    if (typeof window !== 'undefined') {
      window.location.replace(`${window.location.origin}/login`);
    }
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
