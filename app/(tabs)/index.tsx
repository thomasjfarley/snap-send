import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '@/store/profile.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useProfileStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
            <Text style={styles.sub}>Send someone a real postcard today.</Text>
          </View>
        </View>

        {/* Hero CTA */}
        <TouchableOpacity style={styles.heroCta} onPress={() => router.push('/postcard')}>
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
  });
}
