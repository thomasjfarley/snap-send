import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AppleSignInResult {
  user: User | null;
  canceled: boolean;
  error: string | null;
}

function getFullName(credential: AppleAuthentication.AppleAuthenticationCredential) {
  return [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { user: null, canceled: false, error: 'Apple did not return an identity token.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error || !data.user) {
      return {
        user: null,
        canceled: false,
        error: error?.message ?? 'Apple sign-in did not return a user.',
      };
    }

    const fullName =
      getFullName(credential) ||
      data.user.user_metadata.full_name ||
      data.user.user_metadata.name ||
      '';

    if (fullName) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (metadataError) {
        return { user: data.user, canceled: false, error: metadataError.message };
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', data.user.id);
      if (profileError) {
        return { user: data.user, canceled: false, error: profileError.message };
      }
    }

    return { user: data.user, canceled: false, error: null };
  } catch (error: any) {
    if (error?.code === 'ERR_REQUEST_CANCELED') {
      return { user: null, canceled: true, error: null };
    }
    return {
      user: null,
      canceled: false,
      error: error?.message ?? 'Apple sign-in failed.',
    };
  }
}
