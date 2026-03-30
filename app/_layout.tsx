import { useEffect, useCallback } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ExpoLinking from 'expo-linking';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// StripeProvider is native-only — skip on web to avoid import errors
const StripeProvider = Platform.OS !== 'web'
  ? require('@stripe/stripe-react-native').StripeProvider
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

const useStripeHandleURL: () => { handleURLCallback: (url: string) => Promise<boolean> } =
  Platform.OS !== 'web'
    ? require('@stripe/stripe-react-native').useStripe
    : () => ({ handleURLCallback: async () => false });

// Forwards deep links to Stripe SDK so 3DS / bank-redirect flows can return to the app
function StripeDeepLinkHandler() {
  const { handleURLCallback } = useStripeHandleURL();

  const handleDeepLink = useCallback(
    async (incomingUrl: string | null) => {
      if (incomingUrl) {
        await handleURLCallback(incomingUrl);
      }
    },
    [handleURLCallback],
  );

  useEffect(() => {
    const getInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      handleDeepLink(initialUrl);
    };
    getInitialUrl();

    const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    return () => sub.remove();
  }, [handleDeepLink]);

  return null;
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, initialized, passwordRecovery, clearPasswordRecovery } = useAuthStore();
  const { profile, fetch: fetchProfile } = useProfileStore();

  // Navigate to reset-password screen when a recovery link opens the app.
  // Don't clear passwordRecovery until after navigation so the routing effect
  // below sees it and doesn't override the destination.
  useEffect(() => {
    if (!passwordRecovery || !initialized) return;
    router.push('/(auth)/reset-password');
  }, [passwordRecovery, initialized]);

  useEffect(() => {
    if (!initialized) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inResetPassword = segments.includes('reset-password');

    // Don't interfere with the reset-password flow
    if (inResetPassword || passwordRecovery) return;

    if (!user) {
      if (!inAuth) router.replace('/(auth)/welcome');
      return;
    }

    // User is signed in — fetch their profile if needed
    if (!profile) {
      fetchProfile(user.id);
      return;
    }

    const onboardingComplete = profile.full_name && profile.personal_address_id;

    if (!onboardingComplete) {
      if (!inOnboarding) {
        router.replace(
          profile.full_name ? '/(onboarding)/your-address' : '/(onboarding)/profile-setup',
        );
      }
    } else {
      if (inAuth || inOnboarding) router.replace('/(tabs)');
    }
  }, [user, initialized, profile, segments, passwordRecovery]);

  return null;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const { colors, isDark } = useTheme();
  const url = ExpoLinking.useURL();

  useEffect(() => {
    initialize();
  }, []);

  // Process auth deep links (password-reset, magic links, etc.)
  useEffect(() => {
    if (!url) return;

    const processDeepLink = async () => {
      // Try PKCE code exchange first (works if server issued a code)
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error) return; // Success — onAuthStateChange handles PASSWORD_RECOVERY
      } catch {
        // exchangeCodeForSession threw — fall through to implicit flow
      }

      // Implicit flow: parse tokens from URL hash
      try {
        const parsed = new URL(url);
        const params = parsed.hash
          ? new URLSearchParams(parsed.hash.slice(1))
          : parsed.searchParams;

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          // setSession fires SIGNED_IN, not PASSWORD_RECOVERY,
          // so flag recovery manually when the link is a recovery type.
          if (type === 'recovery') {
            useAuthStore.setState({ passwordRecovery: true });
          }
        }
      } catch {
        // URL wasn't parseable — ignore
      }
    };

    processDeepLink();
  }, [url]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      urlScheme="snapsend"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {Platform.OS !== 'web' && <StripeDeepLinkHandler />}
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="postcard" options={{ presentation: 'modal' }} />
        <Stack.Screen name="address" options={{ presentation: 'modal' }} />
        <Stack.Screen name="order" options={{ presentation: 'modal' }} />
      </Stack>
    </StripeProvider>
  );
}
