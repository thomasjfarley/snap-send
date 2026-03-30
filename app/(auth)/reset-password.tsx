import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword, signOut, loading, clearPasswordRecovery } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const doneRef = useRef(false);

  // Clear the recovery flag now that we've safely landed on this screen.
  // On unmount, sign out if the reset wasn't completed — prevents the user
  // from being silently logged in just by swiping back.
  useEffect(() => {
    clearPasswordRecovery();
    return () => {
      if (!doneRef.current) signOut();
    };
  }, []);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState({ newPassword: false, confirmPassword: false });

  const newPasswordError = touched.newPassword && newPassword.length > 0
    ? newPassword.length < 8
      ? 'Password must be at least 8 characters'
      : !/[a-zA-Z]/.test(newPassword)
        ? 'Password must contain at least one letter'
        : !/[0-9]/.test(newPassword)
          ? 'Password must contain at least one number'
          : null
    : null;

  const confirmPasswordError = touched.confirmPassword && confirmPassword.length > 0 && newPassword !== confirmPassword
    ? "Passwords don't match"
    : null;

  async function handleSubmit() {
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      Alert.alert('Weak password', 'Password must be at least 8 characters and contain a letter and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Please make sure both passwords match.');
      return;
    }
    const { error } = await updatePassword(newPassword);
    if (error) {
      Alert.alert('Error', error);
    } else {
      doneRef.current = true;
      setDone(true);
    }
  }

  if (done) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>Password updated!</Text>
          <Text style={styles.subtitle}>Your password has been reset. You can now sign in with your new password.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.btnPrimaryText}>Go to App</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>Choose a strong password for your Snap Send account.</Text>

        <TextInput
          style={[styles.input, newPasswordError && styles.inputError]}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          value={newPassword}
          onChangeText={setNewPassword}
          onBlur={() => setTouched((t) => ({ ...t, newPassword: true }))}
          secureTextEntry
          autoComplete="new-password"
          autoFocus
        />
        {newPasswordError
          ? <Text style={styles.fieldError}>{newPasswordError}</Text>
          : <Text style={styles.passwordHint}>Must be 8+ characters with at least one letter and one number.</Text>
        }

        <TextInput
          style={[styles.input, confirmPasswordError && styles.inputError]}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textSecondary}
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            if (touched.confirmPassword && v === newPassword) {
              setTouched((t) => ({ ...t, confirmPassword: false }));
            }
          }}
          onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
          secureTextEntry
          autoComplete="new-password"
        />
        {confirmPasswordError && <Text style={styles.fieldError}>{confirmPasswordError}</Text>}

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.disabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>{loading ? 'Saving…' : 'Set New Password'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    scrollContent: {
      backgroundColor: colors.background,
      padding: SPACING.xl,
      paddingTop: 80,
      gap: SPACING.md,
    },
    emoji: { fontSize: 56, textAlign: 'center', marginBottom: SPACING.sm },
    title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: SPACING.md,
      paddingVertical: 14,
      fontSize: FONT_SIZE.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.error },
    fieldError: { fontSize: FONT_SIZE.xs, color: colors.error, marginTop: -SPACING.xs },
    passwordHint: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, marginTop: -SPACING.xs },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
