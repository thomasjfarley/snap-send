import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Platform } from 'react-native';
import { setAnalyticsEnabled, getAppInstanceId, getCreationId } from '@/lib/analytics';
import { requiresAnalyticsConsent } from '@/lib/consent-region';

interface AnalyticsState {
  // null = the user hasn't chosen yet
  choice: boolean | null;
  hydrated: boolean;
  setChoice: (choice: boolean) => void;
}

const storage = Platform.OS === 'web'
  ? createJSONStorage(() => localStorage)
  : createJSONStorage(() => require('@react-native-async-storage/async-storage').default);

// Without a choice: on where consent isn't required, off where it is
export function isAnalyticsEnabled(choice: boolean | null): boolean {
  return choice ?? !requiresAnalyticsConsent();
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      choice: null,
      hydrated: false,
      setChoice: (choice) => {
        setAnalyticsEnabled(choice);
        set({ choice });
      },
    }),
    {
      name: 'snap-send-analytics',
      storage,
      partialize: (s) => ({ choice: s.choice }),
      // Native collection is off (firebase.json) until this runs, so nothing is
      // sent before the saved choice or regional default is applied
      onRehydrateStorage: () => (state) => {
        setAnalyticsEnabled(isAnalyticsEnabled(state?.choice ?? null));
        useAnalyticsStore.setState({ hydrated: true });
      },
    },
  ),
);

// Sent with the payment so the server can report the verified purchase to GA4.
// Null when analytics is off (opt-out or no consent), so nothing is reported.
export async function getAnalyticsContext() {
  if (!isAnalyticsEnabled(useAnalyticsStore.getState().choice)) return null;
  const appInstanceId = await getAppInstanceId();
  if (!appInstanceId) return null;
  return {
    appInstanceId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    creationId: getCreationId(),
  };
}

export function useAnalyticsEnabled() {
  return useAnalyticsStore((s) => isAnalyticsEnabled(s.choice));
}
