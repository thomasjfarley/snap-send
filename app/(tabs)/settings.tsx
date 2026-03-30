import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import { useThemeStore, type ThemePreference } from '@/store/theme.store';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.md, marginBottom: SPACING.xs }}>{title}</Text>;
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
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={onPress} disabled={!onPress}>
      <Text style={{ fontSize: FONT_SIZE.md, color: destructive ? colors.error : colors.textPrimary, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, maxWidth: '50%' }}>
        {value ? <Text style={{ fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'right' }} numberOfLines={1}>{value}</Text> : null}
        {rightElement}
        {onPress && !rightElement && <Text style={{ fontSize: 20, color: colors.textSecondary, marginLeft: 2 }}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

function AppearancePicker() {
  const { colors } = useTheme();
  const { preference, setPreference } = useThemeStore();
  const options: { value: ThemePreference; label: string; emoji: string }[] = [
    { value: 'system', label: 'System', emoji: '⚙️' },
    { value: 'light',  label: 'Light',  emoji: '☀️' },
    { value: 'dark',   label: 'Dark',   emoji: '🌙' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
      {options.map((opt) => {
        const active = preference === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setPreference(opt.value)}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
              borderRadius: 10, borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primaryLight : colors.surface,
            }}
          >
            <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
            <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: active ? '700' : '400', color: active ? colors.primary : colors.textSecondary, marginTop: 2 }}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { profile, update: updateProfile } = useProfileStore();
  const { addresses, fetch: fetchAddresses, loading: addressesLoading } = useAddressStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Load addresses when screen mounts so label/nav are accurate immediately
  useEffect(() => {
    if (user) fetchAddresses(user.id);
  }, [user?.id]);

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
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) signOut();
      return;
    }
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
                  <ActivityIndicator size="small" color={colors.primary} />
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

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <View style={{ padding: SPACING.md }}>
            <AppearancePicker />
          </View>
        </View>

        {/* Return Address */}
        <SectionHeader title="Return Address" />
        <View style={styles.card}>
          {addressesLoading && !personalAddress ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : personalAddress ? (
            <SettingsRow
              label="Update return address"
              value={`${personalAddress.line1}, ${personalAddress.city}`}
              onPress={() => router.push(`/address/${personalAddress.id}`)}
            />
          ) : profile?.personal_address_id ? (
            <SettingsRow
              label="Update return address"
              onPress={() => router.push(`/address/${profile.personal_address_id}`)}
            />
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
            onPress={() => router.push('/change-password')}
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

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: SPACING.xl, paddingBottom: 60, gap: SPACING.xs },
    avatarRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingVertical: SPACING.md, marginBottom: SPACING.md,
    },
    avatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: FONT_SIZE.xl, fontWeight: '700' },
    avatarInfo: { flex: 1, gap: 4 },
    avatarName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    avatarEmail: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    nameInput: {
      flex: 1, fontSize: FONT_SIZE.md, borderBottomWidth: 2,
      borderBottomColor: colors.primary, paddingVertical: 4, color: colors.textPrimary,
    },
    saveBtn: { fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '700' },
    cancelBtn: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    card: {
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    loadingRow: { padding: SPACING.md, alignItems: 'center' },
    footer: {
      textAlign: 'center', fontSize: FONT_SIZE.xs, color: colors.textSecondary,
      marginTop: SPACING.xl,
    },
  });
}

