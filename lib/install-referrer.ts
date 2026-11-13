import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CHECKED_KEY = 'install_referrer_checked';
const PENDING_KEY = 'install_campaign_pending';

// Android only: the Play Store passes the referrer from the postcard QR link on first launch.
async function readReferrerOnce() {
  if (Platform.OS !== 'android') return;
  if (await AsyncStorage.getItem(CHECKED_KEY)) return;
  try {
    const Application = require('expo-application');
    const referrer: string = await Application.getInstallReferrerAsync();
    const source = new URLSearchParams(referrer ?? '').get('utm_source');
    if (source === 'postcard') await AsyncStorage.setItem(PENDING_KEY, 'postcard');
    await AsyncStorage.setItem(CHECKED_KEY, '1');
  } catch {
    // Not available (older build or Play Store missing): try again next launch
  }
}

// Saves the campaign on the signed-in user's profile once; never overwrites an existing value.
export async function syncInstallCampaign(userId: string) {
  try {
    await readReferrerOnce();
    const campaign = await AsyncStorage.getItem(PENDING_KEY);
    if (!campaign) return;
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ install_campaign: campaign, install_campaign_at: new Date().toISOString() })
      .eq('id', userId)
      .is('install_campaign', null);
    if (!error) await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Attribution is best-effort
  }
}
