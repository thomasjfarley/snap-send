import React, { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useOrderStore } from '@/store/order.store';
import type { Postcard } from '@/lib/database.types';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { POSTCARD_STATUS_INFO } from '@/constants/order-status';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { postcards, loading, fetch } = useOrderStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [requests, setRequests] = useState<any[]>([]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('address_requests')
      .select('id, recipient_email, status, expires_at, amount_cents, created_at')
      .in('status', ['awaiting_address', 'processing', 'expired_digital', 'refunded'])
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) { fetch(user.id); loadRequests(); }
    }, [user, loadRequests]),
  );

  function requestStatus(r: any) {
    switch (r.status) {
      case 'awaiting_address': {
        const days = Math.max(0, Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000));
        return { label: `Waiting for address · ${days}d left`, color: '#92400E', bg: '#FEF3C7', emoji: '✉️' };
      }
      case 'processing':
        return { label: 'Address received', color: '#6B21A8', bg: '#F3E8FF', emoji: '🖨️' };
      case 'expired_digital':
        return { label: 'Sent digitally', color: '#14532D', bg: '#DCFCE7', emoji: '💌' };
      default:
        return { label: 'Refunded', color: '#991B1B', bg: '#FEE2E2', emoji: '↩️' };
    }
  }

  function renderRequest(r: any) {
    const s = requestStatus(r);
    return (
      <View key={r.id} style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.recipient}>{r.recipient_email}</Text>
          <Text style={styles.address}>Address requested by email</Text>
          <Text style={styles.date}>{formatDate(r.created_at)}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.color }]}>{s.emoji} {s.label}</Text>
          </View>
          <Text style={styles.price}>${(r.amount_cents / 100).toFixed(2)}</Text>
        </View>
      </View>
    );
  }

  function renderItem({ item }: { item: Postcard }) {
    const snapshot = item.recipient_snapshot as any;
    const status = POSTCARD_STATUS_INFO[item.status] ?? POSTCARD_STATUS_INFO.pending;
    const price = `$${(item.price_cents / 100).toFixed(2)}`;

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
        {item.lob_front_url && (
          <Image source={{ uri: item.lob_front_url }} style={styles.thumbnail} resizeMode="cover" />
        )}
        <View style={styles.cardLeft}>
          <Text style={styles.recipient}>{snapshot?.full_name ?? 'Unknown recipient'}</Text>
          <Text style={styles.address}>
            {snapshot?.city}, {snapshot?.state}
          </Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>
              {status.emoji} {status.label}
            </Text>
          </View>
          <Text style={styles.price}>{price}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
      </View>

      <FlatList
        data={postcards}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={requests.length > 0 ? <View style={{ gap: SPACING.sm }}>{requests.map(renderRequest)}</View> : null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { if (user) { fetch(user.id); loadRequests(); } }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading && requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No postcards yet</Text>
              <Text style={styles.emptySub}>Send your first postcard to see it here.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/postcard')}>
                <Text style={styles.ctaBtnText}>Create a Postcard</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    list: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.md,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      gap: SPACING.sm,
    },
    thumbnail: { width: 52, height: 39, borderRadius: 6, backgroundColor: colors.border },
    cardLeft: { flex: 1, gap: 3 },
    recipient: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    address: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    date: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: SPACING.xs },
    badge: { borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
    badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
    price: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.textPrimary },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: 80 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    emptySub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center' },
    ctaBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
    ctaBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}
