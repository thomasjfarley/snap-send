import { create } from 'zustand';
import type { Address } from '@/lib/database.types';
import type { FilterId, FrameId } from '@/constants/editor';

interface PostcardState {
  photoUri: string | null;
  filterId: FilterId;
  frameId: FrameId;
  message: string;
  recipient: Address | null;
  justSent: boolean;
  setPhoto: (uri: string) => void;
  setFilter: (id: FilterId) => void;
  setFrame: (id: FrameId) => void;
  setMessage: (msg: string) => void;
  setRecipient: (address: Address) => void;
  setJustSent: (v: boolean) => void;
  reset: () => void;
}

export const usePostcardStore = create<PostcardState>((set) => ({
  photoUri: null,
  filterId: 'none',
  frameId: 'none',
  message: '',
  recipient: null,
  justSent: false,
  setPhoto: (uri) => set({ photoUri: uri }),
  setFilter: (id) => set({ filterId: id }),
  setFrame: (id) => set({ frameId: id }),
  setMessage: (msg) => set({ message: msg }),
  setRecipient: (address) => set({ recipient: address }),
  setJustSent: (v) => set({ justSent: v }),
  // reset clears the postcard draft but NOT justSent
  reset: () => set({ photoUri: null, filterId: 'none', frameId: 'none', message: '', recipient: null }),
}));
