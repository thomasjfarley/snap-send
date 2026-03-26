import React, { useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { useAddressStore } from '@/store/address.store';
import { useAuthStore } from '@/store/auth.store';
import type { Address } from '@/lib/database.types';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

export default function RecipientScreen() {
  const router = useRouter();
  const { recipient, setRecipient } = usePostcardStore();
  const { user } = useAuthStore();
  const { addresses, fetch } = useAddressStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetch(user.id);
    }, [user])
  );

  // Exclude personal address — you can't mail a postcard to yourself from this flow
  const recipients = addresses.filter((a) => !a.is_personal);

  function handleSelect(address: Address) {
    setRecipient(address);
    router.push('/postcard/preview');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Recipient</Text>
        <TouchableOpacity onPress={() => router.push('/address/new')}>
          <Text style={[styles.navText, { color: colors.primary }]}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={recipients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selected = recipient?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => handleSelect(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.full_name}</Text>
                {item.label ? <Text style={styles.label}>{item.label}</Text> : null}
                <Text style={styles.addr}>{item.line1}{item.line2 ? `, ${item.line2}` : ''}</Text>
                <Text style={styles.addr}>{item.city}, {item.state} {item.zip}</Text>
              </View>
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No recipients saved</Text>
            <Text style={styles.emptySub}>Add someone to your address book first.</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/address/new')}>
              <Text style={styles.addBtnText}>Add Recipient</Text>
            </TouchableOpacity>
          </View>
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    navText: { fontSize: FONT_SIZE.md, color: colors.textSecondary },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    list: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.md,
      borderWidth: 2, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    },
    cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    name: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    label: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, fontWeight: '500' },
    addr: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    checkmark: { fontSize: 20, color: colors.primary, fontWeight: '700' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: 80 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    emptySub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center' },
    addBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
    addBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}
