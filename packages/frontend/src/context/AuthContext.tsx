import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User, LoginDto } from '@wizqueue/shared';
import { setCsrfToken } from '../services/api';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
const WARN_BEFORE_MS  = 60 * 1000;         // warn 1 minute before logout

interface AuthState {
  user: User | null;
  csrfToken: string | null;
  loading: boolean;
}

interface AuthContextValue {
  user: User | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  idleWarning: boolean;
  resetIdleTimer: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ user: null, csrfToken: null, loading: true });
  const [idleWarning, setIdleWarning] = useState(false);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearTimers();
    setIdleWarning(false);
    setCsrfToken(null);
    // Best-effort server logout to clear the HttpOnly cookie
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // ignore — cookie will expire naturally
    }
    setState({ user: null, csrfToken: null, loading: false });
  }, [clearTimers]);

  const resetIdleTimer = useCallback(() => {
    clearTimers();
    setIdleWarning(false);
    warnTimerRef.current   = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    logoutTimerRef.current = setTimeout(() => doLogout(), IDLE_TIMEOUT_MS);
  }, [clearTimers, doLogout]);

  // Start/restart idle timer when authenticated
  useEffect(() => {
    if (!state.user) {
      clearTimers();
      return;
    }

    resetIdleTimer();

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetIdleTimer();
    EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, handler));
      clearTimers();
    };
  }, [state.user, resetIdleTimer, clearTimers]);

  // On mount: check if there's an active session via cookie
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiBase}/auth/me`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setState({ user: null, csrfToken: null, loading: false });
          return;
        }
        const body = await res.json();
        const { user, csrfToken } = body.data as { user: User; csrfToken: string };
        setCsrfToken(csrfToken);
        setState({ user, csrfToken, loading: false });
      })
      .catch(() => {
        setState({ user: null, csrfToken: null, loading: false });
      });
  }, []);

  const login = useCallback(async (credentials: LoginDto) => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Login failed');
    }

    const body = await res.json();
    const { user, csrfToken } = body.data as { user: User; csrfToken: string };
    setCsrfToken(csrfToken);
    setState({ user, csrfToken, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{
      user: state.user,
      csrfToken: state.csrfToken,
      isAuthenticated: !state.loading && !!state.user,
      loading: state.loading,
      login,
      logout: doLogout,
      idleWarning,
      resetIdleTimer,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
