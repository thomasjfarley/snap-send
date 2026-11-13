import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getRequestCardUri } from '@/lib/request-cards';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Detail view for an address request, using the copy saved on this device
// until the printed postcard exists.
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [f, b, { data }] = await Promise.all([
        getRequestCardUri(id, 'front'),
        getRequestCardUri(id, 'back'),
        (supabase as any)
          .from('address_requests')
          .select('recipient_email, status, created_at, expires_at, amount_cents, message, location, downloaded_at')
          .eq('id', id)
          .single(),
      ]);
      setFront(f);
      setBack(b);
      setReq(data);
      setLoading(false);
    })();
  }, [id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {front ? (
            <Image source={{ uri: front }} style={styles.card} resizeMode="cover" />
          ) : null}
          <Text style={styles.sectionTitle}>Back</Text>
          {back ? (
            <Image source={{ uri: back }} style={styles.card} resizeMode="cover" />
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.fallbackText}>{req?.message || 'Preview not available on this device.'}</Text>
            </View>
          )}
          {!front && !back && (
            <Text style={styles.note}>The preview images are only stored on the phone that sent this postcard.</Text>
          )}
          {req && (
            <>
              <Text style={styles.sectionTitle}>Request Info</Text>
              <View style={styles.metaCard}>
                <Row label="Sent to" value={req.recipient_email} />
                <Row label="Date" value={formatDate(req.created_at)} />
                <Row label="Link expires" value={formatDate(req.expires_at)} />
                <Row label="Amount" value={`$${(req.amount_cents / 100).toFixed(2)}`} />
                {req.location ? <Row label="Location" value={req.location} /> : null}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

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
    card: { width: '100%', aspectRatio: 3 / 2, borderRadius: 4 },
    sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
    fallback: { backgroundColor: colors.surface, borderRadius: 12, padding: SPACING.md, borderWidth: 1, borderColor: colors.border },
    fallbackText: { color: colors.textPrimary, fontSize: FONT_SIZE.sm },
    note: { color: colors.textSecondary, fontSize: FONT_SIZE.sm },
    metaCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    metaRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    metaLabel: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    metaValue: { fontSize: FONT_SIZE.sm, color: colors.textPrimary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  });
}
