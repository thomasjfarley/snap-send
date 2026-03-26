import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuthStore } from '@/store/auth.store';
import { supabase } from '@/lib/supabase';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleEmailSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    const { error } = await signIn(email.trim(), password);
    if (error) Alert.alert('Sign in failed', error);
  }

  async function handleGoogleSignIn() {
    const redirectUri = makeRedirectUri({ scheme: 'snapsend' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Alert.alert('Error', error?.message ?? 'Could not start Google sign-in');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  }

  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: credential.nonce ?? undefined,
      });
      if (error) Alert.alert('Apple sign-in failed', error.message);
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in failed', e.message);
      }
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Snap Send account.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.disabled]}
            onPress={handleEmailSignIn}
            disabled={loading}
          >
            <Text style={styles.btnPrimaryText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.btnSocial} onPress={handleGoogleSignIn}>
          <Text style={styles.btnSocialText}>🔵  Continue with Google</Text>
        </TouchableOpacity>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={14}
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
        />

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
          <Text style={styles.switchText}>
            Don't have an account? <Text style={styles.link}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    paddingTop: 60,
    gap: SPACING.md,
  },
  back: { marginBottom: SPACING.sm },
  backText: { color: COLORS.primary, fontSize: FONT_SIZE.md },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: -SPACING.sm },
  form: { gap: SPACING.sm },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  forgotText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, textAlign: 'right' },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  btnSocial: {
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnSocialText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.textPrimary },
  appleBtn: { height: 50 },
  switchText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  link: { color: COLORS.primary, fontWeight: '600' },
});
