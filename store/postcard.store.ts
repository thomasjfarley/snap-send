import { create } from 'zustand';
import type { Address } from '@/lib/database.types';
import type { FilterId, FrameId } from '@/constants/editor';

interface PostcardState {
  photoUri: string | null;
  filterId: FilterId;
  frameId: FrameId;
  message: string;
  location: string | null;
  recipient: Address | null;
  justSent: boolean;
  openedFromChooser: boolean;
  setPhoto: (uri: string) => void;
  setFilter: (id: FilterId) => void;
  setFrame: (id: FrameId) => void;
  setMessage: (msg: string) => void;
  setLocation: (loc: string | null) => void;
  setRecipient: (address: Address) => void;
  setJustSent: (v: boolean) => void;
  setOpenedFromChooser: (v: boolean) => void;
  reset: () => void;
}

export const usePostcardStore = create<PostcardState>((set) => ({
  photoUri: null,
  filterId: 'none',
  frameId: 'none',
  message: '',
  location: null,
  recipient: null,
  justSent: false,
  openedFromChooser: false,
  setPhoto: (uri) => set({ photoUri: uri }),
  setFilter: (id) => set({ filterId: id }),
  setFrame: (id) => set({ frameId: id }),
  setMessage: (msg) => set({ message: msg }),
  setLocation: (loc) => set({ location: loc }),
  setRecipient: (address) => set({ recipient: address }),
  setJustSent: (v) => set({ justSent: v }),
  setOpenedFromChooser: (v) => set({ openedFromChooser: v }),
  // reset clears the postcard draft but NOT justSent
  reset: () => set({ photoUri: null, filterId: 'none', frameId: 'none', message: '', location: null, recipient: null, openedFromChooser: false }),
}));
