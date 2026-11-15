import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const EMAIL_REGEX = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export default function RequestAddressScreen() {
  const router = useRouter();
  const { addressRequest, setAddressRequest } = usePostcardStore();
  const [email, setEmail] = useState(addressRequest?.email ?? '');
  const [name, setName] = useState(addressRequest?.name ?? '');
  const [international, setInternational] = useState<boolean | null>(addressRequest?.international ?? null);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function handleContinue() {
    const cleaned = email.trim().toLowerCase();
    if (!name.trim()) {
      Alert.alert('Add their name', "Please enter your recipient's name.");
      return;
    }
    if (!EMAIL_REGEX.test(cleaned)) {
      Alert.alert('Check the email', 'Please enter a valid email address.');
      return;
    }
    if (international === null) {
      Alert.alert('One more thing', 'Please choose US address or International (Outside the US).');
      return;
    }
    setAddressRequest({ email: cleaned, international, name: name.trim() });
    router.push('/postcard/preview');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Request Address</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Who should we ask for their address? We'll email them a link to see your postcard and enter where it should be mailed.
          </Text>

          <Text style={styles.label}>Recipient's name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Their name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            maxLength={60}
            textContentType="name"
          />

          <Text style={styles.label}>Recipient's email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <Text style={[styles.label, { marginTop: SPACING.lg }]}>Where will this be sent?</Text>
          <Text style={styles.help}>
            This sets the price and the kind of address your recipient can enter.
          </Text>
          {([
            { value: false, title: 'US address', sub: 'They must enter a US address.' },
            { value: true, title: 'International (Outside the US)', sub: 'They must enter an address outside the US.' },
          ] as const).map((opt) => {
            const selected = international === opt.value;
            return (
              <TouchableOpacity
                key={opt.title}
                style={[styles.radioRow, selected && styles.radioRowSelected]}
                onPress={() => setInternational(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioTitle}>{opt.title}</Text>
                  <Text style={styles.radioSub}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue to Payment</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    navText: { fontSize: FONT_SIZE.md, color: colors.textSecondary },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    scroll: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 40 },
    intro: { fontSize: FONT_SIZE.md, color: colors.textSecondary, lineHeight: 22, marginBottom: SPACING.sm },
    label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.textPrimary },
    help: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, marginBottom: SPACING.xs },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
      fontSize: FONT_SIZE.md, color: colors.textPrimary,
    },
    radioRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.md,
      borderWidth: 2, borderColor: colors.border,
    },
    radioRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    radioOuter: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    radioOuterSelected: { borderColor: colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    radioTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    radioSub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
    continueBtn: {
      backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md,
      alignItems: 'center', marginTop: SPACING.lg,
    },
    continueText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  });
}
