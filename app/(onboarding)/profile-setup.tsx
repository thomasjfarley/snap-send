import { useState, useMemo } from 'react';
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
import { useProfileStore } from '@/store/profile.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { update, loading } = useProfileStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [fullName, setFullName] = useState('');

  async function handleContinue() {
    if (!fullName.trim()) {
      Alert.alert('Enter your name', 'Please enter your full name to continue.');
      return;
    }
    if (!user) return;

    const { error } = await update(user.id, { full_name: fullName.trim() });
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    router.replace('/(onboarding)/your-address');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.step}>Step 1 of 2</Text>
          <Text style={styles.title}>What's your name?</Text>
          <Text style={styles.subtitle}>
            This is how your postcards will be signed from you.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor={colors.textSecondary}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.disabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            <Text style={styles.btnPrimaryText}>{loading ? 'Saving…' : 'Continue →'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      padding: SPACING.xl, paddingTop: 80, gap: SPACING.xl,
    },
    header: { gap: SPACING.sm },
    step: { fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 },
    input: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: SPACING.md, paddingVertical: 14,
      fontSize: FONT_SIZE.xl, color: colors.textPrimary, backgroundColor: colors.surface,
    },
    footer: { marginTop: 'auto' },
    btnPrimary: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: SPACING.md, alignItems: 'center',
    },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
