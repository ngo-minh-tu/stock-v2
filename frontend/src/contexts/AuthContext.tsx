'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/constants';
import type { LoginResponseData } from '@/lib/types';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(STORAGE_KEYS.token));
    setIsHydrated(true);
  }, []);

  const login = useCallback(
    async (password: string) => {
      const data = await apiFetch<LoginResponseData>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      window.localStorage.setItem(STORAGE_KEYS.token, data.token);
      setToken(data.token);
      router.replace('/');
    },
    [router],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEYS.token);
    setToken(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== null,
      isHydrated,
      login,
      logout,
    }),
    [token, isHydrated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
