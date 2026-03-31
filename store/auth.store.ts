import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  passwordRecovery: boolean;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  resetPassword: (email: string, redirectTo?: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listener registered at store-creation time so PASSWORD_RECOVERY is never missed
  supabase.auth.onAuthStateChange((event, session) => {
    // Merge into a single set so routing effects always see user + passwordRecovery together
    set({
      session,
      user: session?.user ?? null,
      ...(event === 'PASSWORD_RECOVERY' ? { passwordRecovery: true } : {}),
    });
  });

  return {
  user: null,
  session: null,
  loading: false,
  initialized: false,
  passwordRecovery: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, initialized: true });
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ user: null, session: null, loading: false });
  },

  deleteAccount: async () => {
    set({ loading: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ loading: false });
      return { error: 'Not signed in' };
    }
    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      set({ loading: false });
      return { error: error.message ?? 'Failed to delete account' };
    }
    await supabase.auth.signOut();
    set({ user: null, session: null, loading: false });
    return { error: null };
  },

  resetPassword: async (email, redirectTo) => {
    set({ loading: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  updatePassword: async (newPassword) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { has_password: true },
    });
    set({ loading: false, ...(data.user ? { user: data.user } : {}) });
    return { error: error?.message ?? null };
  },

  clearPasswordRecovery: () => set({ passwordRecovery: false }),

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },
  };
});
