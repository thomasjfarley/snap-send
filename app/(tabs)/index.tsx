import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '@/store/profile.store';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useProfileStore();
  const { justSent, setJustSent } = usePostcardStore();
  const heroBlockedRef = useRef(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
            <Text style={styles.sub}>Send someone a real postcard today.</Text>
          </View>
        </View>

        {/* Hero CTA */}
        <TouchableOpacity style={styles.heroCta} onPress={() => { if (!heroBlockedRef.current) router.push('/postcard'); }}>
          <Text style={styles.heroEmoji}>📬</Text>
          <Text style={styles.heroTitle}>Create a Postcard</Text>
          <Text style={styles.heroSub}>Take a photo, add a message, and we'll mail it.</Text>
          <View style={styles.heroBtn}>
            <Text style={styles.heroBtnText}>Get Started →</Text>
          </View>
        </TouchableOpacity>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.steps}>
          {[
            { emoji: '📸', title: 'Snap a photo', desc: 'Take or pick any photo from your library' },
            { emoji: '🎨', title: 'Customize it', desc: 'Add filters, frames, and a personal message' },
            { emoji: '📮', title: 'We mail it', desc: 'A real postcard arrives in 3–5 business days' },
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepEmoji}>{step.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Postcard sent confirmation sheet — conditional render avoids invisible Android Dialog */}
      {justSent && <Modal visible={true} transparent animationType="slide" onRequestClose={() => setJustSent(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetEmoji}>📬</Text>
            <Text style={styles.sheetTitle}>Postcard Sent!</Text>
            <Text style={styles.sheetSub}>
              Your postcard is on its way to the printer and will arrive in 3–5 business days.
            </Text>
            <View style={styles.sheetDetails}>
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
            <TouchableOpacity style={styles.sheetBtn} onPress={() => {
              heroBlockedRef.current = true;
              setJustSent(false);
              setTimeout(() => { heroBlockedRef.current = false; }, 600);
            }}>
              <Text style={styles.sheetBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetBtnSecondary}
              onPress={() => { setTimeout(() => { setJustSent(false); router.push('/postcard'); }, 100); }}
            >
              <Text style={styles.sheetBtnSecondaryText}>Send Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: SPACING.xl, gap: SPACING.xl, paddingBottom: 60 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    greeting: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.textPrimary },
    sub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, marginTop: 4 },
    heroCta: {
      backgroundColor: colors.primary, borderRadius: 24, padding: SPACING.xl,
      alignItems: 'center', gap: SPACING.sm,
    },
    heroEmoji: { fontSize: 56 },
    heroTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: '#fff' },
    heroSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
    heroBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
    heroBtnText: { color: colors.primary, fontSize: FONT_SIZE.md, fontWeight: '700' },
    sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    steps: { gap: SPACING.md },
    step: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
    stepEmoji: { fontSize: 28 },
    stepTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    stepDesc: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, marginTop: 2 },
    // Confirmation sheet
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: SPACING.xl, paddingBottom: 40, alignItems: 'center', gap: SPACING.md,
    },
    sheetEmoji: { fontSize: 72, marginTop: SPACING.sm },
    sheetTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
    sheetSub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    sheetDetails: {
      backgroundColor: colors.surface, borderRadius: 16, padding: SPACING.lg,
      borderWidth: 1, borderColor: colors.border, width: '100%', gap: SPACING.sm,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    detailEmoji: { fontSize: 20, width: 28 },
    detailText: { fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    sheetBtn: {
      backgroundColor: colors.primary, borderRadius: 16, paddingVertical: SPACING.md,
      alignItems: 'center', width: '100%',
    },
    sheetBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
    sheetBtnSecondary: { paddingVertical: SPACING.sm, alignItems: 'center', width: '100%' },
    sheetBtnSecondaryText: { color: colors.primary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}

