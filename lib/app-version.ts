import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { AppVersionPolicy } from '@/lib/database.types';

const POLICY_CACHE_KEY = 'app-version-policy-v1';
const VERSION_PATTERN = /^\d+(?:\.\d+)*$/;
const POLICY_TIMEOUT_MS = 8000;

export type NativePlatform = 'ios' | 'android';

export interface RequiredUpdate {
  currentVersion: string;
  currentBuildNumber: number;
  minimumVersion: string;
  minimumBuildNumber: number;
  latestVersion: string;
  message: string;
  storeUrl: string;
}

function parseVersion(version: string) {
  if (!VERSION_PATTERN.test(version)) return null;
  return version.split('.').map(Number);
}

export function compareVersions(left: string, right: string) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) {
    throw new Error(`Invalid app version comparison: "${left}" and "${right}"`);
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function isNativePlatform(platform: string): platform is NativePlatform {
  return platform === 'ios' || platform === 'android';
}

function isPolicy(value: unknown): value is AppVersionPolicy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as Partial<AppVersionPolicy>;
  return (
    isNativePlatform(policy.platform ?? '') &&
    typeof policy.minimum_version === 'string' &&
    typeof policy.latest_version === 'string' &&
    typeof policy.minimum_build_number === 'number' &&
    Number.isSafeInteger(policy.minimum_build_number) &&
    policy.minimum_build_number > 0 &&
    typeof policy.latest_build_number === 'number' &&
    Number.isSafeInteger(policy.latest_build_number) &&
    policy.latest_build_number > 0 &&
    typeof policy.message === 'string' &&
    typeof policy.store_url === 'string' &&
    parseVersion(policy.minimum_version) !== null &&
    parseVersion(policy.latest_version) !== null
  );
}

async function readCachedPolicy(platform: NativePlatform) {
  const cached = await AsyncStorage.getItem(`${POLICY_CACHE_KEY}:${platform}`);
  if (!cached) return null;

  try {
    const policy: unknown = JSON.parse(cached);
    return isPolicy(policy) && policy.platform === platform ? policy : null;
  } catch {
    await AsyncStorage.removeItem(`${POLICY_CACHE_KEY}:${platform}`);
    return null;
  }
}

async function fetchPolicy(platform: NativePlatform) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const request = supabase
      .from('app_version_policy')
      .select('*')
      .eq('platform', platform)
      .single();
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('App version policy request timed out')),
        POLICY_TIMEOUT_MS,
      );
    });
    const { data, error } = await Promise.race([request, timeout]);

    if (error) throw error;
    if (!isPolicy(data)) throw new Error(`Invalid ${platform} app version policy`);

    await AsyncStorage.setItem(`${POLICY_CACHE_KEY}:${platform}`, JSON.stringify(data));
    return data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getRequiredUpdate(): Promise<RequiredUpdate | null> {
  if (!isNativePlatform(Platform.OS)) return null;

  const platform = Platform.OS;
  const currentVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  const currentBuildNumber = Number(Constants.nativeBuildVersion);
  if (!currentVersion || !parseVersion(currentVersion)) {
    throw new Error(`Unable to determine the installed app version: "${currentVersion ?? ''}"`);
  }
  if (!Number.isSafeInteger(currentBuildNumber) || currentBuildNumber <= 0) {
    throw new Error(
      `Unable to determine the installed app build number: "${Constants.nativeBuildVersion ?? ''}"`,
    );
  }

  let policy: AppVersionPolicy | null = null;
  try {
    policy = await fetchPolicy(platform);
  } catch (error) {
    console.error('Failed to fetch app version policy', error);
    policy = await readCachedPolicy(platform);
  }

  if (!policy || currentBuildNumber >= policy.minimum_build_number) {
    return null;
  }

  return {
    currentVersion,
    currentBuildNumber,
    minimumVersion: policy.minimum_version,
    minimumBuildNumber: policy.minimum_build_number,
    latestVersion: policy.latest_version,
    message: policy.message,
    storeUrl: policy.store_url,
  };
}
