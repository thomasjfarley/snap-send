import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  label, value, onPress, destructive, rightElement,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.rowLabel, destructive && { color: COLORS.error }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {rightElement}
        {onPress && !rightElement && <Text style={styles.chevron}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { profile, update: updateProfile } = useProfileStore();
  const { addresses } = useAddressStore();
  const personalAddress = addresses.find((a) => a.is_personal);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function saveName() {
    if (!nameInput.trim() || !user) return;
    setSavingName(true);
    const { error } = await updateProfile(user.id, { full_name: nameInput.trim() });
    setSavingName(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setEditingName(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Supabase doesn't support client-side user deletion — show instructions
            Alert.alert(
              'Contact support',
              'To delete your account, email support@snapsend.app and we will process it within 48 hours.',
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar + name */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.avatarInfo}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
                {savingName ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <TouchableOpacity onPress={saveName}>
                    <Text style={styles.saveBtn}>Save</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setEditingName(false); setNameInput(profile?.full_name ?? ''); }}>
                  <Text style={styles.cancelBtn}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setNameInput(profile?.full_name ?? ''); setEditingName(true); }}>
                <Text style={styles.avatarName}>{profile?.full_name ?? 'Your Name'} ✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.avatarEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Return Address */}
        <SectionHeader title="Return Address" />
        <View style={styles.card}>
          {personalAddress ? (
            <>
              <SettingsRow
                label={personalAddress.full_name}
                value={`${personalAddress.line1}, ${personalAddress.city}`}
                onPress={() => router.push(`/address/${personalAddress.id}`)}
              />
            </>
          ) : (
            <SettingsRow
              label="Add your return address"
              onPress={() => router.push('/(onboarding)/your-address')}
            />
          )}
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingsRow
            label="Change Password"
            onPress={() => router.push('/(auth)/forgot-password')}
          />
          <SettingsRow
            label="Address Book"
            onPress={() => router.push('/(tabs)/address-book')}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow label="Version" value={APP_VERSION} />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => Alert.alert('Coming soon', 'Privacy policy will be available before launch.')}
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => Alert.alert('Coming soon', 'Terms of service will be available before launch.')}
          />
          <SettingsRow
            label="Rate Snap Send ⭐"
            onPress={() => Alert.alert('Thank you!', 'Rating will be available once the app is live on the stores.')}
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="" />
        <View style={styles.card}>
          <SettingsRow label="Sign Out" onPress={confirmSignOut} destructive />
        </View>
        <View style={[styles.card, { marginTop: SPACING.sm }]}>
          <SettingsRow label="Delete Account" onPress={confirmDeleteAccount} destructive />
        </View>

        <Text style={styles.footer}>Snap Send · Made with ❤️</Text>
      </ScrollView>
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
  scroll: { padding: SPACING.xl, paddingBottom: 60, gap: SPACING.xs },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, marginBottom: SPACING.md,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: FONT_SIZE.xl, fontWeight: '700' },
  avatarInfo: { flex: 1, gap: 4 },
  avatarName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  avatarEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  nameInput: {
    flex: 1, fontSize: FONT_SIZE.md, borderBottomWidth: 2,
    borderBottomColor: COLORS.primary, paddingVertical: 4, color: COLORS.textPrimary,
  },
  saveBtn: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },
  cancelBtn: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  sectionHeader: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, maxWidth: '50%' },
  rowValue: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'right' },
  chevron: { fontSize: 20, color: COLORS.textSecondary, marginLeft: 2 },
  footer: {
    textAlign: 'center', fontSize: FONT_SIZE.xs, color: COLORS.textSecondary,
    marginTop: SPACING.xl,
  },
});

