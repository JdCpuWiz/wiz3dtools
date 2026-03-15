import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User, LoginDto } from '@wizqueue/shared';

const STORAGE_KEY = 'wiz3d_auth';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
const WARN_BEFORE_MS  = 60 * 1000;         // warn 1 minute before logout

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => void;
  idleWarning: boolean;         // true when the 60-second warning is showing
  resetIdleTimer: () => void;   // call to dismiss warning + reset timer
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { user: null, token: null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(loadFromStorage);
  const [idleWarning, setIdleWarning] = useState(false);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, token: null });
    setIdleWarning(false);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    setIdleWarning(false);

    warnTimerRef.current   = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    logoutTimerRef.current = setTimeout(() => logout(), IDLE_TIMEOUT_MS);
  }, [logout]);

  // Start/restart timer whenever auth state changes
  useEffect(() => {
    if (!state.token) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
      return;
    }

    resetIdleTimer();

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetIdleTimer();
    EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, handler));
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    };
  }, [state.token, resetIdleTimer]);

  const login = useCallback(async (credentials: LoginDto) => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Login failed');
    }

    const body = await res.json();
    const { user, token } = body.data as { user: User; token: string };
    const newState = { user, token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setState(newState);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.token, login, logout, idleWarning, resetIdleTimer }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
