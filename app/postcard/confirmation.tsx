import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function ConfirmationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.title}>Postcard Sent!</Text>
        <Text style={styles.subtitle}>
          Your postcard is on its way to the printer.{'\n'}It will arrive in 3–5 business days.
        </Text>

        <View style={styles.details}>
          {[
            { emoji: '🖨️', text: 'Printing in 1 business day' },
            { emoji: '✉️', text: 'Mailed via USPS First Class' },
            { emoji: '📍', text: 'Arrives in 3–5 business days' },
          ].map((item, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailEmoji}>{item.emoji}</Text>
              <Text style={styles.detailText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => {
            router.dismissAll();
            router.replace('/(tabs)');
          }}
        >
          <Text style={styles.btnPrimaryText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => {
            router.dismissAll();
            router.replace('/postcard');
          }}
        >
          <Text style={styles.btnSecondaryText}>Send Another</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
    emoji: { fontSize: 80 },
    title: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: FONT_SIZE.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
    details: {
      backgroundColor: colors.surface, borderRadius: 16, padding: SPACING.lg,
      borderWidth: 1, borderColor: colors.border, width: '100%', gap: SPACING.sm, marginVertical: SPACING.md,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    detailEmoji: { fontSize: 20, width: 28 },
    detailText: { fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: SPACING.md, alignItems: 'center', width: '100%' },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
    btnSecondary: { paddingVertical: SPACING.sm, alignItems: 'center', width: '100%' },
    btnSecondaryText: { color: colors.primary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}

