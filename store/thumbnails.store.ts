import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, getInfoAsync, makeDirectoryAsync, copyAsync } from 'expo-file-system';

const THUMB_DIR = (documentDirectory ?? '') + 'thumbnails/';

async function ensureThumbDir() {
  const info = await getInfoAsync(THUMB_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(THUMB_DIR, { intermediates: true });
  }
}

interface ThumbnailsState {
  // postcardId → persistent file:// URI (or legacy data: URI for older entries)
  paths: Record<string, string>;
  // Copies a captured URI to the app's documents directory and persists the path.
  saveThumbnail: (postcardId: string, capturedUri: string) => Promise<void>;
  getThumbnailPath: (postcardId: string) => string | undefined;
}

export const useThumbnailsStore = create<ThumbnailsState>()(
  persist(
    (set, get) => ({
      paths: {},
      saveThumbnail: async (postcardId, capturedUri) => {
        try {
          await ensureThumbDir();
          const dest = `${THUMB_DIR}${postcardId}.jpg`;
          await copyAsync({ from: capturedUri, to: dest });
          set((state) => ({ paths: { ...state.paths, [postcardId]: dest } }));
        } catch (err) {
          console.error('[thumbnails] failed to save thumbnail:', err);
        }
      },
      getThumbnailPath: (postcardId) => get().paths[postcardId],
    }),
    {
      name: 'postcard-thumbnails',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
