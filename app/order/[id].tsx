import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useThumbnailsStore } from '@/store/thumbnails.store';
import type { Postcard } from '@/lib/database.types';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - SPACING.xl * 2;
const CARD_H = CARD_W * (3 / 4);
const LOB_CHARS_PER_LINE = 40;

const STATUS_STEPS: Postcard['status'][] = ['pending', 'paid', 'submitted', 'mailed'];

const STATUS_INFO: Record<Postcard['status'], { label: string; color: string; bg: string; desc: string }> = {
  pending:   { label: 'Pending',   color: '#92400E', bg: '#FEF3C7', desc: 'Awaiting payment confirmation.' },
  paid:      { label: 'Paid',      color: '#1E40AF', bg: '#DBEAFE', desc: 'Payment confirmed.' },
  submitted: { label: 'Printing',  color: '#6B21A8', bg: '#F3E8FF', desc: 'Your postcard is being printed.' },
  mailed:    { label: 'Mailed',    color: '#14532D', bg: '#DCFCE7', desc: 'Your postcard is on its way! 🎉' },
  failed:    { label: 'Failed',    color: '#991B1B', bg: '#FEE2E2', desc: 'Something went wrong with this order.' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getThumbnailPath } = useThumbnailsStore();

  const messageFontSize = useMemo(() => {
    const trimmed = (postcard?.message ?? '').trim();
    const len = trimmed.length;
    const lines = trimmed.split('\n').length;
    const visualLines = trimmed
      .split('\n')
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / LOB_CHARS_PER_LINE)), 0);
    const byChars = len < 80 ? 18 : len < 200 ? 16 : len < 350 ? 14 : 12;
    const byLines = lines <= 5 ? 18 : lines <= 9 ? 16 : lines <= 13 ? 14 : 12;
    const byVisual = visualLines <= 7 ? 18 : visualLines <= 12 ? 16 : visualLines <= 17 ? 14 : 12;
    // Ensure all lines fit vertically within the preview card height
    const availableH = CARD_H - SPACING.md * 2;
    const byFit = visualLines > 0 ? Math.floor(availableH / (visualLines * 1.5)) : 18;
    return Math.min(byChars, byLines, byVisual, byFit);
  }, [postcard?.message]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('postcards')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPostcard(data as Postcard | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !postcard) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.error }}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const snapshot = postcard.recipient_snapshot as any;
  const status = STATUS_INFO[postcard.status];
  const isFailed = postcard.status === 'failed';
  const currentStepIndex = STATUS_STEPS.indexOf(postcard.status as any);
  const thumbUri = getThumbnailPath(postcard.id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Postcard thumbnail — only shown when a local copy was saved */}
        {thumbUri && (
          <Image source={{ uri: thumbUri }} style={styles.postcardThumb} resizeMode="cover" />
        )}
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={[styles.statusDesc, { color: status.color }]}>{status.desc}</Text>
        </View>

        {/* Progress timeline (not shown for failed) */}
        {!isFailed && (
          <View style={styles.timeline}>
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStepIndex;
              const info = STATUS_INFO[step];
              return (
                <View key={step} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.dot, done && { backgroundColor: colors.primary }]} />
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.line, done && i < currentStepIndex && { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.timelineLabel, done && { color: colors.textPrimary, fontWeight: '600' }]}>
                    {info.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Postcard back preview */}
        <Text style={styles.sectionTitle}>Message</Text>
        <View style={styles.postcardBack}>
          <View style={styles.backLeft}>
            <Text
              style={[styles.messageText, { fontSize: messageFontSize, lineHeight: messageFontSize * 1.5 }]}
            >{postcard.message}</Text>
          </View>
          <View style={styles.backDivider} />
          <View style={styles.backRight}>
            <View style={styles.addrBlock}>
              <Text style={styles.addrLabel}>TO</Text>
              <Text style={styles.addrName}>{snapshot?.full_name}</Text>
              <Text style={styles.addrLine}>{snapshot?.line1}</Text>
              {snapshot?.line2 ? <Text style={styles.addrLine}>{snapshot.line2}</Text> : null}
              <Text style={styles.addrLine}>{snapshot?.city}, {snapshot?.state} {snapshot?.zip}</Text>
            </View>
          </View>
        </View>

        {/* Order metadata */}
        <Text style={styles.sectionTitle}>Order Info</Text>
        <View style={styles.metaCard}>
          <Row label="Date" value={formatDate(postcard.created_at)} />
          <Row label="Amount" value={`$${(postcard.price_cents / 100).toFixed(2)}`} />
          <Row label="Frame" value={postcard.frame} />
          <Row label="Filter" value={postcard.filter} />
          {postcard.location && <Row label="Location" value={postcard.location} />}
          {postcard.lob_id && <Row label="Tracking ID" value={postcard.lob_id} mono />}
          {postcard.mailed_at && <Row label="Mailed" value={formatDate(postcard.mailed_at)} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.metaMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backText: { fontSize: FONT_SIZE.md, color: colors.textSecondary },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: SPACING.xl, gap: SPACING.lg, paddingBottom: 60 },
    postcardThumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.border },
    statusBanner: { borderRadius: 14, padding: SPACING.md, gap: 4 },
    statusLabel: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
    statusDesc: { fontSize: FONT_SIZE.sm },
    timeline: { gap: 0 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
    timelineLeft: { alignItems: 'center', width: 16 },
    dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.border },
    line: { width: 2, height: 28, backgroundColor: colors.border, marginTop: 2 },
    timelineLabel: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, paddingTop: 1, flex: 1 },
    sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
    postcardBack: {
      backgroundColor: '#FFFEF0', borderRadius: 12,
      borderWidth: 1, borderColor: '#E0DCC8',
      flexDirection: 'row', padding: SPACING.md, height: CARD_H,
      overflow: 'hidden',
    },
    backLeft: { width: Math.round(CARD_W * 0.44), flexShrink: 0, paddingRight: SPACING.sm },
    messageText: { color: '#333' },
    backDivider: { width: 1, backgroundColor: '#D0CCAA', marginHorizontal: SPACING.sm },
    backRight: { flex: 1, justifyContent: 'center' },
    addrBlock: { gap: 2 },
    addrLabel: { fontSize: 8, fontWeight: '700', color: '#999', letterSpacing: 1 },
    addrName: { fontSize: 11, fontWeight: '600', color: '#333' },
    addrLine: { fontSize: 10, color: '#555', lineHeight: 14 },
    metaCard: {
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    metaRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    metaLabel: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    metaValue: { fontSize: FONT_SIZE.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
    metaMono: { fontFamily: 'monospace', fontSize: 11 },
  });
}
