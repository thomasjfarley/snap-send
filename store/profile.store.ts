import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  fetch: (userId: string) => Promise<void>;
  update: (userId: string, data: Partial<Pick<Profile, 'full_name' | 'personal_address_id'>>) => Promise<{ error: string | null }>;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,

  fetch: async (userId) => {
    set({ loading: true });
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    set({ profile: (data as Profile | null) ?? null, loading: false });
  },

  update: async (userId, data) => {
    set({ loading: true });
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
    if (updated) {
      set({ profile: updated as Profile });
    }
    set({ loading: false });
    if (!error && !updated) {
      return { error: 'Profile update affected 0 rows — permission denied or profile not found.' };
    }
    return { error: error?.message ?? null };
  },

  clear: () => set({ profile: null }),
}));
