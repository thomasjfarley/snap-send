import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Alert, Platform } from 'react-native';

type ReviewPreference = 'rated' | 'later' | 'never';

const REVIEW_PREFERENCE_KEY = `snap-send:store-review-preference:${Platform.OS}`;

async function setReviewPreference(preference: ReviewPreference) {
  await AsyncStorage.setItem(REVIEW_PREFERENCE_KEY, preference);
}

export async function requestStoreReview() {
  if (Platform.OS === 'web') return false;

  const hasAction = await StoreReview.hasAction();
  if (!hasAction) return false;

  await StoreReview.requestReview();
  await setReviewPreference('rated');
  return true;
}

export async function promptForStoreReviewAfterSend() {
  if (Platform.OS === 'web') return false;

  const preference = await AsyncStorage.getItem(REVIEW_PREFERENCE_KEY);
  if (preference === 'rated' || preference === 'never') return false;
  if (!(await StoreReview.hasAction())) return false;

  Alert.alert(
    'Enjoying Snap Send?',
    'Would you take a moment to rate Snap Send? Your review helps other people discover the app.',
    [
      {
        text: 'Remind Me Later',
        onPress: () => {
          setReviewPreference('later').catch((error) => {
            console.error('[store-review] could not save reminder preference:', error);
          });
        },
      },
      {
        text: "Don't Ask Again",
        style: 'cancel',
        onPress: () => {
          setReviewPreference('never').catch((error) => {
            console.error('[store-review] could not save opt-out preference:', error);
          });
        },
      },
      {
        text: 'Rate Snap Send',
        onPress: () => {
          requestStoreReview().catch((error) => {
            console.error('[store-review] request failed:', error);
          });
        },
      },
    ],
    { cancelable: false },
  );

  return true;
}
