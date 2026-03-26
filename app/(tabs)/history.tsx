import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useOrderStore } from '@/store/order.store';
import type { Postcard } from '@/lib/database.types';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

const STATUS_CONFIG: Record<Postcard['status'], { label: string; color: string; bg: string; emoji: string }> = {
  pending:   { label: 'Pending',   color: '#92400E', bg: '#FEF3C7', emoji: '⏳' },
  paid:      { label: 'Paid',      color: '#1E40AF', bg: '#DBEAFE', emoji: '💳' },
  submitted: { label: 'Printing',  color: '#6B21A8', bg: '#F3E8FF', emoji: '🖨️' },
  mailed:    { label: 'Mailed',    color: '#14532D', bg: '#DCFCE7', emoji: '✉️' },
  failed:    { label: 'Failed',    color: '#991B1B', bg: '#FEE2E2', emoji: '❌' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { postcards, loading, fetch } = useOrderStore();

  useFocusEffect(
    useCallback(() => {
      if (user) fetch(user.id);
    }, [user]),
  );

  function renderItem({ item }: { item: Postcard }) {
    const snapshot = item.recipient_snapshot as any;
    const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
    const price = `$${(item.price_cents / 100).toFixed(2)}`;

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
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
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user && fetch(user.id)}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No postcards yet</Text>
              <Text style={styles.emptySub}>Send your first postcard to see it here.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/postcard')}>
                <Text style={styles.ctaBtnText}>Create a Postcard</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  list: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1, gap: 3 },
  recipient: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  address: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  date: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: SPACING.xs },
  badge: { borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  price: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textPrimary },
  empty: { alignItems: 'center', gap: SPACING.md, paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  ctaBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
  ctaBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
});

