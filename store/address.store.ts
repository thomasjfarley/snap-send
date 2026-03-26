import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Address } from '@/lib/database.types';

export interface AddressFormData {
  label: string;
  full_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ValidationResult {
  verified: boolean;
  deliverability: string;
  address: Omit<AddressFormData, 'label' | 'full_name' | 'country'> & {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

interface AddressState {
  addresses: Address[];
  loading: boolean;
  validating: boolean;

  fetch: (userId: string) => Promise<void>;
  add: (userId: string, data: AddressFormData, lobVerified: boolean) => Promise<{ data: Address | null; error: string | null }>;
  update: (id: string, data: Partial<AddressFormData>) => Promise<{ error: string | null }>;
  remove: (id: string) => Promise<{ error: string | null }>;
  validate: (address: Pick<AddressFormData, 'line1' | 'line2' | 'city' | 'state' | 'zip'>) => Promise<{ result: ValidationResult | null; error: string | null }>;
  clear: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  loading: false,
  validating: false,

  fetch: async (userId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    set({ addresses: data ?? [], loading: false });
  },

  add: async (userId, form, lobVerified) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        label: form.label,
        full_name: form.full_name,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country || 'US',
        lob_verified: lobVerified,
        is_personal: false,
      })
      .select()
      .single();
    if (data) set((s) => ({ addresses: [...s.addresses, data] }));
    set({ loading: false });
    return { data: data ?? null, error: error?.message ?? null };
  },

  update: async (id, form) => {
    set({ loading: true });
    const { error } = await supabase.from('addresses').update(form).eq('id', id);
    if (!error) {
      set((s) => ({
        addresses: s.addresses.map((a) => (a.id === id ? { ...a, ...form } : a)),
      }));
    }
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  remove: async (id) => {
    set({ loading: true });
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (!error) set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) }));
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  validate: async (address) => {
    set({ validating: true });
    const { data, error } = await supabase.functions.invoke('validate-address', {
      body: {
        line1: address.line1,
        line2: address.line2 || undefined,
        city: address.city,
        state: address.state,
        zip: address.zip,
      },
    });
    set({ validating: false });
    if (error) return { result: null, error: error.message };
    if (data?.error) return { result: null, error: data.error };
    return { result: data as ValidationResult, error: null };
  },

  clear: () => set({ addresses: [] }),
}));
