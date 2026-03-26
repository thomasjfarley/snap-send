import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { COLORS } from '@/constants/theme';

// StripeProvider is native-only — skip on web to avoid import errors
const StripeProvider = Platform.OS !== 'web'
  ? require('@stripe/stripe-react-native').StripeProvider
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { user, initialized } = useAuthStore();
  const { profile, fetch: fetchProfile } = useProfileStore();

  useEffect(() => {
    if (!initialized) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

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
  }, [user, initialized, profile, segments]);

  return null;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    initialize();
  }, []);

  if (!initialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
      <StatusBar style="auto" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="postcard" options={{ presentation: 'modal' }} />
        <Stack.Screen name="address" options={{ presentation: 'modal' }} />
      </Stack>
    </StripeProvider>
  );
}
