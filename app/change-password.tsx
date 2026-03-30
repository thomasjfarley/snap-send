import { useState, useMemo } from 'react';
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
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, updatePassword, loading } = useAuthStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isEmailUser = user?.identities?.some((i) => i.provider === 'email') ?? false;
  const hasPassword = isEmailUser || (user?.user_metadata?.has_password === true);

  const [currentPassword, setCurrentPassword] = useState('');
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

    if (hasPassword) {
      if (!currentPassword) {
        Alert.alert('Enter current password', 'Please enter your current password.');
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (authError) {
        Alert.alert('Incorrect password', 'Your current password is incorrect. Try again or use "Forgot password" to reset it.');
        return;
      }
    }

    const { error } = await updatePassword(newPassword);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>{hasPassword ? 'Password updated!' : 'Password set!'}</Text>
        <Text style={styles.subtitle}>
          {hasPassword
            ? 'Your password has been changed successfully.'
            : 'You can now sign in with your email and password in addition to your existing sign-in method.'}
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.back()}>
          <Text style={styles.btnPrimaryText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{hasPassword ? 'Change password' : 'Set a password'}</Text>
        <Text style={styles.subtitle}>
          {hasPassword
            ? 'Enter your current password, then choose a new one.'
            : 'You signed in with a social account. Set a password to also sign in with your email and password.'}
        </Text>

        {!hasPassword && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              🔗 Setting a password won't remove your existing sign-in method — you'll be able to use either.
            </Text>
          </View>
        )}

        {hasPassword && (
          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor={colors.textSecondary}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoComplete="current-password"
          />
        )}

        <TextInput
          style={[styles.input, newPasswordError && styles.inputError]}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          value={newPassword}
          onChangeText={setNewPassword}
          onBlur={() => setTouched((t) => ({ ...t, newPassword: true }))}
          secureTextEntry
          autoComplete="new-password"
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
          <Text style={styles.btnPrimaryText}>
            {loading ? 'Saving…' : hasPassword ? 'Update Password' : 'Set Password'}
          </Text>
        </TouchableOpacity>

        {hasPassword && (
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotLink}>Forgot current password?</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: SPACING.xl,
      paddingTop: 60,
      gap: SPACING.md,
    },
    scrollContent: {
      backgroundColor: colors.background,
      padding: SPACING.xl,
      paddingTop: 60,
      gap: SPACING.md,
    },
    back: { marginBottom: SPACING.sm },
    backText: { color: colors.primary, fontSize: FONT_SIZE.md },
    emoji: { fontSize: 56, textAlign: 'center', marginBottom: SPACING.sm },
    title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 },
    infoBanner: {
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      padding: SPACING.md,
    },
    infoText: { fontSize: FONT_SIZE.sm, color: colors.primary, lineHeight: 20 },
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
    passwordHint: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
      marginTop: -SPACING.xs,
    },
    inputError: {
      borderColor: colors.error,
    },
    fieldError: {
      fontSize: FONT_SIZE.xs,
      color: colors.error,
      marginTop: -SPACING.xs,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    disabled: { opacity: 0.6 },
    forgotLink: {
      textAlign: 'center',
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      marginTop: SPACING.xs,
    },
  });
}
