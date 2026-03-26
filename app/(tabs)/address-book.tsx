import { useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import type { Address } from '@/lib/database.types';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function AddressBookScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
  const { addresses, fetch, remove, loading } = useAddressStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetch(user.id);
    }, [user]),
  );

  function confirmDelete(address: Address) {
    if (address.is_personal) {
      Alert.alert('Cannot delete', 'This is your personal return address. Update it in Settings.');
      return;
    }
    Alert.alert(
      'Delete recipient?',
      `Remove ${address.full_name} from your address book?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(address.id) },
      ],
    );
  }

  function renderItem({ item }: { item: Address }) {
    const isPersonal = item.is_personal;
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{item.full_name}</Text>
            {isPersonal && <View style={styles.personalBadge}><Text style={styles.personalBadgeText}>You</Text></View>}
            {item.lob_verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedBadgeText}>✓ Verified</Text></View>}
          </View>
          {!isPersonal && <Text style={styles.cardLabel}>{item.label}</Text>}
          <Text style={styles.cardAddress}>{item.line1}{item.line2 ? `, ${item.line2}` : ''}</Text>
          <Text style={styles.cardAddress}>{item.city}, {item.state} {item.zip}</Text>
        </View>

        <View style={styles.cardActions}>
          {isPersonal ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push(`/address/${item.id}`)}
              >
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => confirmDelete(item)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Address Book</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/address/new')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => user && fetch(user.id)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No recipients yet</Text>
              <Text style={styles.emptySubtitle}>Add someone to get started.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/address/new')}>
                <Text style={styles.btnPrimaryText}>Add First Recipient</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    addBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
    addBtnText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '600' },
    list: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.md,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm,
    },
    cardLeft: { flex: 1, gap: 3 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
    cardName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    personalBadge: { backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    personalBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
    verifiedBadge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    verifiedBadgeText: { fontSize: 10, fontWeight: '600', color: '#15803D' },
    cardLabel: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, fontWeight: '500' },
    cardAddress: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    cardActions: { gap: SPACING.xs, alignItems: 'flex-end' },
    actionBtn: { padding: SPACING.xs },
    editText: { fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '500' },
    deleteText: { fontSize: FONT_SIZE.sm, color: colors.error, fontWeight: '500' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: 80 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    emptySubtitle: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, alignItems: 'center', marginTop: SPACING.sm },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}
