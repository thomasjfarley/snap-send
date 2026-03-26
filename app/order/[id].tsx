import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Postcard } from '@/lib/database.types';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

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
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('postcards')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPostcard(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
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
          <Text style={{ color: COLORS.error }}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const snapshot = postcard.recipient_snapshot as any;
  const status = STATUS_INFO[postcard.status];
  const isFailed = postcard.status === 'failed';
  const currentStepIndex = STATUS_STEPS.indexOf(postcard.status as any);

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
                    <View style={[styles.dot, done && { backgroundColor: COLORS.primary }]} />
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.line, done && i < currentStepIndex && { backgroundColor: COLORS.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.timelineLabel, done && { color: COLORS.textPrimary, fontWeight: '600' }]}>
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
            <Text style={styles.messageText}>{postcard.message}</Text>
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
          {postcard.lob_id && <Row label="Tracking ID" value={postcard.lob_id} mono />}
          {postcard.mailed_at && <Row label="Mailed" value={formatDate(postcard.mailed_at)} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.metaMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.xl, gap: SPACING.lg, paddingBottom: 60 },
  statusBanner: { borderRadius: 14, padding: SPACING.md, gap: 4 },
  statusLabel: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  statusDesc: { fontSize: FONT_SIZE.sm },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  timelineLeft: { alignItems: 'center', width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.border, borderWidth: 2, borderColor: COLORS.border },
  line: { width: 2, height: 28, backgroundColor: COLORS.border, marginTop: 2 },
  timelineLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, paddingTop: 1, flex: 1 },
  sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  postcardBack: {
    backgroundColor: '#FFFEF0', borderRadius: 12,
    borderWidth: 1, borderColor: '#E0DCC8',
    flexDirection: 'row', padding: SPACING.md, minHeight: 120,
  },
  backLeft: { flex: 3, paddingRight: SPACING.sm },
  messageText: { fontSize: FONT_SIZE.sm, color: '#333', lineHeight: 20 },
  backDivider: { width: 1, backgroundColor: '#D0CCAA', marginHorizontal: SPACING.sm },
  backRight: { flex: 2, justifyContent: 'center' },
  addrBlock: { gap: 2 },
  addrLabel: { fontSize: 8, fontWeight: '700', color: '#999', letterSpacing: 1 },
  addrName: { fontSize: 11, fontWeight: '600', color: '#333' },
  addrLine: { fontSize: 10, color: '#555', lineHeight: 14 },
  metaCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  metaLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  metaValue: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  metaMono: { fontFamily: 'monospace', fontSize: 11 },
});
