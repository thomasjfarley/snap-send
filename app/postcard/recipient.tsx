import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { useAddressStore, type AddressFormData } from '@/store/address.store';
import { useAuthStore } from '@/store/auth.store';
import type { Address } from '@/lib/database.types';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { analytics } from '@/lib/analytics';
import { SaveDraftButton } from '@/components/SaveDraftButton';

export default function RecipientScreen() {
  const router = useRouter();
  const { recipient, setRecipient } = usePostcardStore();
  const { user } = useAuthStore();
  const { addresses, fetch, validate, update } = useAddressStore();
  const [verifying, setVerifying] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (user) fetch(user.id);
    }, [user])
  );

  // Exclude personal address from the general list
  const recipients = addresses.filter((a) => !a.is_personal);
  const personalAddress = addresses.find((a) => a.is_personal && (a.country === 'US' || !a.country));

  function proceed(address: Address, unverifiedOk = false) {
    setRecipient(address);
    analytics.postcardCompleted(
      !!usePostcardStore.getState().photoUri &&
        !!usePostcardStore.getState().message?.trim() &&
        address.lob_verified !== false,
    );
    router.push(unverifiedOk ? '/postcard/preview?unverifiedOk=1' : '/postcard/preview');
  }

  function offerUnverifiedSend(address: Address) {
    if ((address.country || 'US').toUpperCase() === 'US') {
      Alert.alert(
        'Address could not be verified',
        'We could not verify this address. This can happen for rural or tribal-land addresses. You can still send, but the postcard may not be deliverable and no refund is guaranteed.',
        [
          { text: 'Edit Address', onPress: () => router.push(`/address/${address.id}`) },
          { text: 'Send Anyway', onPress: () => proceed(address, true) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      Alert.alert(
        'Address could not be verified',
        'Addresses outside the US must be verified before sending. Please update the address and try again.',
        [
          { text: 'Edit Address', onPress: () => router.push(`/address/${address.id}`) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }

  async function markVerified(address: Address, fields: Partial<AddressFormData> = {}) {
    const { error } = await update(address.id, { ...fields, lob_verified: true });
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    proceed({ ...address, ...fields, lob_verified: true } as Address);
  }

  async function handleSelect(address: Address) {
    if (address.lob_verified !== false) {
      proceed(address);
      return;
    }
    if (verifying) return;
    setVerifying(true);
    const { result, error } = await validate({
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country || 'US',
    });
    setVerifying(false);

    if (error) {
      Alert.alert('Verification error', `${error}\n\nPlease try again.`);
      return;
    }
    if (!result || !result.verified) {
      offerUnverifiedSend(address);
      return;
    }

    const suggested = {
      line1: result.address.line1,
      line2: result.address.line2 ?? '',
      city: result.address.city,
      state: result.address.state,
      zip: result.address.zip,
    };
    const isDifferent =
      suggested.line1 !== address.line1 ||
      suggested.line2 !== (address.line2 ?? '') ||
      suggested.city !== address.city ||
      suggested.state !== address.state ||
      suggested.zip !== address.zip;

    if (!isDifferent) {
      await markVerified(address);
      return;
    }
    const lines = `${suggested.line1}${suggested.line2 ? `, ${suggested.line2}` : ''}\n${suggested.city}, ${suggested.state} ${suggested.zip}`;
    Alert.alert(
      'Use verified address?',
      `Lob suggests this standardized address:\n\n${lines}`,
      [
        { text: 'Use Verified Address', onPress: () => markVerified(address, suggested) },
        { text: 'Edit Address', onPress: () => router.push(`/address/${address.id}`) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function requestAddressByEmail() {
    Alert.alert(
      'Request address via email',
      "Your recipient will get an email with a link to see a digital version of your postcard and enter their mailing address so we can mail them the real one.\n\nYou'll be charged when you pay. If they don't enter an address or download the card within 45 days, you'll be refunded automatically.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.push('/postcard/request-address') },
      ],
    );
  }

  const requestButton = (
    <TouchableOpacity style={styles.requestBtn} onPress={requestAddressByEmail}>
      <Text style={styles.requestBtnSub}>Don't have their address?</Text>
      <Text style={styles.requestBtnTitle}>Request it by email</Text>
    </TouchableOpacity>
  );

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

      <SaveDraftButton step="recipient" disabled={verifying} />

      <FlatList
        data={recipients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: SPACING.sm }}>
            {personalAddress ? (
          <TouchableOpacity
            style={[styles.card, styles.selfCard, recipient?.id === personalAddress.id && styles.cardSelected]}
            onPress={() => handleSelect(personalAddress)}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.selfRow}>
                <Text style={styles.name}>{personalAddress.full_name}</Text>
                <View style={styles.selfBadge}><Text style={styles.selfBadgeText}>Send to Myself</Text></View>
              </View>
              <Text style={styles.addr}>{personalAddress.line1}{personalAddress.line2 ? `, ${personalAddress.line2}` : ''}</Text>
              <Text style={styles.addr}>{personalAddress.city}, {personalAddress.state} {personalAddress.zip}</Text>
            </View>
            {recipient?.id === personalAddress.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
            ) : null}
          </View>
        }
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
        ListFooterComponent={requestButton}
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
      {verifying && (
        <View style={styles.verifyOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.verifyText}>Verifying address…</Text>
        </View>
      )}
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
    selfCard: { borderStyle: 'dashed' },
    requestBtn: {
      alignItems: 'center', paddingVertical: SPACING.lg, gap: 2,
    },
    requestBtnTitle: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: colors.textSecondary, textDecorationLine: 'underline' },
    requestBtnSub: { fontSize: FONT_SIZE.xs, color: colors.textSecondary },
    selfRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
    selfBadge: { backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    selfBadgeText: { fontSize: FONT_SIZE.xs, color: colors.primary, fontWeight: '600' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: 80 },
    verifyOverlay: {
      ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    },
    verifyText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    emptySub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center' },
    addBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
    addBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  });
}
