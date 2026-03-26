import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Postcard } from '@/lib/database.types';

interface OrderState {
  postcards: Postcard[];
  loading: boolean;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set) => ({
  postcards: [],
  loading: false,
  error: null,

  fetch: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('postcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set({ postcards: (data as Postcard[] | null) ?? [], loading: false });
    }
  },
}));
