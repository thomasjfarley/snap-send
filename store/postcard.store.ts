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
  // Set when the sender asks the recipient to supply their own address by email
  addressRequest: { email: string; international: boolean } | null;
  justSent: boolean;
  openedFromChooser: boolean;
  draftId: string | null;
  setPhoto: (uri: string) => void;
  setFilter: (id: FilterId) => void;
  setFrame: (id: FrameId) => void;
  setMessage: (msg: string) => void;
  setLocation: (loc: string | null) => void;
  setRecipient: (address: Address) => void;
  setAddressRequest: (req: { email: string; international: boolean }) => void;
  setJustSent: (v: boolean) => void;
  setOpenedFromChooser: (v: boolean) => void;
  setDraftId: (id: string | null) => void;
  loadDraft: (d: { id: string; photoUri: string; filterId: FilterId; frameId: FrameId; message: string; location: string | null; recipient: Address | null }) => void;
  reset: () => void;
}

export const usePostcardStore = create<PostcardState>((set) => ({
  photoUri: null,
  filterId: 'none',
  frameId: 'none',
  message: '',
  location: null,
  recipient: null,
  addressRequest: null,
  justSent: false,
  openedFromChooser: false,
  draftId: null,
  setPhoto: (uri) => set({ photoUri: uri }),
  setFilter: (id) => set({ filterId: id }),
  setFrame: (id) => set({ frameId: id }),
  setMessage: (msg) => set({ message: msg }),
  setLocation: (loc) => set({ location: loc }),
  setRecipient: (address) => set({ recipient: address, addressRequest: null }),
  setAddressRequest: (req) => set({ addressRequest: req, recipient: null }),
  setJustSent: (v) => set({ justSent: v }),
  setOpenedFromChooser: (v) => set({ openedFromChooser: v }),
  setDraftId: (id) => set({ draftId: id }),
  loadDraft: (d) => set({ draftId: d.id, photoUri: d.photoUri, filterId: d.filterId, frameId: d.frameId, message: d.message, location: d.location, recipient: d.recipient, addressRequest: null, openedFromChooser: false }),
  // reset clears the postcard draft but NOT justSent
  reset: () => set({ photoUri: null, filterId: 'none', frameId: 'none', message: '', location: null, recipient: null, addressRequest: null, openedFromChooser: false, draftId: null }),
}));
