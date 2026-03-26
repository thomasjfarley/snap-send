import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter the email address on your account.');
      return;
    }
    const { error } = await resetPassword(email.trim());
    if (error) {
      Alert.alert('Error', error);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a password reset link to {email}. Follow the link to set a new password.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/(auth)/sign-in')}>
          <Text style={styles.btnPrimaryText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter the email address on your account and we'll send you a reset link.
        </Text>

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

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.disabled]}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>{loading ? 'Sending…' : 'Send Reset Link'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    paddingTop: 60,
    gap: SPACING.md,
  },
  back: { marginBottom: SPACING.sm },
  backText: { color: COLORS.primary, fontSize: FONT_SIZE.md },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: SPACING.sm },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    marginTop: SPACING.sm,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
