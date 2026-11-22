import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setAuthToken } from '../lib/api';

export interface AuthUser {
  id: number;
  uid: string | null;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  accountStatus: string;
  isDemo: boolean;
  roles: string[];
}

export interface DemoAccountSummary {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
}

export interface TaxonomyData {
  stages: Array<{ id: number; slug: string; nameAr: string; nameEn: string }>;
  fields: Array<{ id: number; slug: string; nameAr: string; nameEn: string; descriptionAr: string | null }>;
  subjects: Array<{ id: number; fieldId: number; stageId: number | null; nameAr: string; nameEn: string }>;
  skills: Array<{ id: number; fieldId: number; nameAr: string; nameEn: string }>;
  taskCategories: Array<{ id: number; slug: string; nameAr: string; nameEn: string }>;
  roles: Array<{ id: number; code: string; nameAr: string; nameEn: string }>;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  locale: 'ar' | 'en';
  setLocale: (loc: 'ar' | 'en') => void;
  taxonomy: TaxonomyData | null;
  refreshTaxonomy: () => Promise<void>;
  demoAccounts: DemoAccountSummary[];
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: {
    email: string;
    password: string;
    fullName: string;
    primaryRole: string;
    stageId?: number;
  }) => Promise<void>;
  loginAsDemo: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [locale, setLocaleState] = useState<'ar' | 'en'>('ar');
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountSummary[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const setLocale = (loc: 'ar' | 'en') => {
    setLocaleState(loc);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const refreshTaxonomy = useCallback(async () => {
    try {
      const data = await apiFetch<TaxonomyData>('/api/taxonomy');
      setTaxonomy(data);
    } catch (err) {
      console.error('Failed to load taxonomy:', err);
    }
  }, []);

  useEffect(() => {
    refreshTaxonomy();
    apiFetch<{ demoAccounts: DemoAccountSummary[] }>('/api/auth/demo-accounts')
      .then((res) => setDemoAccounts(res.demoAccounts))
      .catch(() => {});
  }, [refreshTaxonomy]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      await refreshUser();
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      setAuthToken(res.token);
      setUser(res.user);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (payload: {
    email: string;
    password: string;
    fullName: string;
    primaryRole: string;
    stageId?: number;
  }) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setAuthToken(res.token);
      setUser(res.user);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (email: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/demo-login',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setAuthToken(res.token);
      setUser(res.user);
      setAuthModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setAuthToken(null);
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore if not signed in via Firebase
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        locale,
        setLocale,
        taxonomy,
        refreshTaxonomy,
        demoAccounts,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginAsDemo,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
