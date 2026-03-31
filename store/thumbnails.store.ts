import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThumbnailsState {
  paths: Record<string, string>; // postcardId → data URI (data:image/jpeg;base64,...)
  setThumbnail: (postcardId: string, dataUri: string) => void;
  getThumbnailPath: (postcardId: string) => string | undefined;
}

export const useThumbnailsStore = create<ThumbnailsState>()(
  persist(
    (set, get) => ({
      paths: {},
      setThumbnail: (postcardId, dataUri) =>
        set((state) => ({ paths: { ...state.paths, [postcardId]: dataUri } })),
      getThumbnailPath: (postcardId) => get().paths[postcardId],
    }),
    {
      name: 'postcard-thumbnails',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
