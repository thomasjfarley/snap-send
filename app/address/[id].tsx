import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useAddressStore } from '@/store/address.store';
import { AddressForm } from '@/components/AddressForm';
import type { AddressFormData } from '@/store/address.store';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

export default function EditAddressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { addresses, fetch: fetchAddresses, update, validate, loading, validating } = useAddressStore();

  // Fetch addresses if store is empty (e.g. navigated directly)
  useEffect(() => {
    if (addresses.length === 0 && user) fetchAddresses(user.id);
  }, []);

  const existing = addresses.find((a) => a.id === id);

  const [form, setForm] = useState<AddressFormData>({
    label: existing?.label ?? '',
    full_name: existing?.full_name ?? '',
    line1: existing?.line1 ?? '',
    line2: existing?.line2 ?? '',
    city: existing?.city ?? '',
    state: existing?.state ?? '',
    zip: existing?.zip ?? '',
    country: existing?.country ?? 'US',
  });
  const [verified, setVerified] = useState<boolean | null>(existing?.lob_verified ?? null);
  const [suggestedAddress, setSuggestedAddress] = useState<AddressFormData | null>(null);

  // Populate form once address loads from store
  useEffect(() => {
    if (existing) {
      setForm({
        label: existing.label,
        full_name: existing.full_name,
        line1: existing.line1,
        line2: existing.line2 ?? '',
        city: existing.city,
        state: existing.state,
        zip: existing.zip,
        country: existing.country,
      });
      setVerified(existing.lob_verified ?? null);
    }
  }, [existing?.id]);

  // Only bounce back if we've finished loading and still can't find the address
  useEffect(() => {
    if (!loading && addresses.length > 0 && !existing) router.back();
  }, [loading, addresses.length, existing]);

  function handleChange(field: keyof AddressFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setVerified(null);
    setSuggestedAddress(null);
  }

  async function handleVerify() {
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in street, city, state, and ZIP first.');
      return;
    }
    const { result, error } = await validate(form);
    if (error) { Alert.alert('Verification error', error); return; }
    if (result) {
      const suggested: AddressFormData = {
        ...form,
        line1: result.address.line1,
        line2: result.address.line2 ?? '',
        city: result.address.city,
        state: result.address.state,
        zip: result.address.zip,
      };
      const isDifferent =
        suggested.line1 !== form.line1 ||
        suggested.line2 !== form.line2 ||
        suggested.city !== form.city ||
        suggested.state !== form.state ||
        suggested.zip !== form.zip;

      if (isDifferent) {
        setSuggestedAddress(suggested);
      } else {
        setVerified(result.verified);
      }
    }
  }

  function handleAcceptSuggestion() {
    if (!suggestedAddress) return;
    setForm(suggestedAddress);
    setSuggestedAddress(null);
    setVerified(true);
  }

  function handleRejectSuggestion() {
    setSuggestedAddress(null);
    setVerified(false);
  }

  async function handleSave() {
    if (!id) return;
    if (!form.full_name.trim()) { Alert.alert('Missing name', 'Please enter the recipient\'s full name.'); return; }
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in all required fields.'); return;
    }
    const { error } = await update(id, { ...form, lob_verified: verified === true });
    if (error) { Alert.alert('Error', error); return; }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loading && !existing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Address</Text>
          <View style={{ width: 60 }} />
        </View>

        <AddressForm
          values={form}
          onChange={handleChange}
          verified={verified}
          validating={validating}
          onValidate={handleVerify}
          suggestedAddress={suggestedAddress}
          onAcceptSuggestion={handleAcceptSuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          showLabel={true}
        />

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.disabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>{loading ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.background, padding: SPACING.xl, paddingTop: 60, gap: SPACING.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { color: COLORS.primary, fontSize: FONT_SIZE.md },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
