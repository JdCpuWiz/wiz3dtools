import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, LoginDto } from '@wizqueue/shared';

const STORAGE_KEY = 'wiz3d_auth';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => void;
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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, token: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
