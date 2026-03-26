import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>📬</Text>
        <Text style={styles.title}>Snap Send</Text>
        <Text style={styles.tagline}>Turn your photos into real{'\n'}postcards. Mailed for you.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.btnPrimaryText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.btnSecondaryText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.xl,
      justifyContent: 'space-between',
      paddingTop: 120,
      paddingBottom: 60,
    },
    hero: { alignItems: 'center', gap: SPACING.md },
    logo: { fontSize: 72 },
    title: { fontSize: 40, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1 },
    tagline: { fontSize: FONT_SIZE.lg, color: colors.textSecondary, textAlign: 'center', lineHeight: 26 },
    actions: { gap: SPACING.sm },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: SPACING.md,
      alignItems: 'center',
    },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    btnSecondary: {
      borderRadius: 14,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    btnSecondaryText: { color: colors.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}
