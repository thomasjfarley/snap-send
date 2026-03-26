import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import { AddressForm } from '@/components/AddressForm';
import type { AddressFormData } from '@/store/address.store';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

const EMPTY_FORM: AddressFormData = {
  label: 'Home',
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

export default function YourAddressScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { profile, update: updateProfile } = useProfileStore();
  const { add, validate, loading, validating } = useAddressStore();

  const [form, setForm] = useState<AddressFormData>({
    ...EMPTY_FORM,
    full_name: profile?.full_name ?? '',
  });
  const [verified, setVerified] = useState<boolean | null>(null);
  const [validatedForm, setValidatedForm] = useState<AddressFormData | null>(null);

  function handleChange(field: keyof AddressFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setVerified(null); // reset verification when fields change
  }

  async function handleVerify() {
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in street, city, state, and ZIP.');
      return;
    }
    const { result, error } = await validate(form);
    if (error) {
      Alert.alert('Verification error', error);
      return;
    }
    if (result) {
      setVerified(result.verified);
      if (result.verified) {
        // Auto-fill standardized address from Lob
        setValidatedForm({
          ...form,
          line1: result.address.line1,
          line2: result.address.line2 ?? '',
          city: result.address.city,
          state: result.address.state,
          zip: result.address.zip,
        });
        setForm((prev) => ({
          ...prev,
          line1: result.address.line1,
          line2: result.address.line2 ?? '',
          city: result.address.city,
          state: result.address.state,
          zip: result.address.zip,
        }));
      }
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!form.full_name.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in all required address fields.');
      return;
    }

    const { data: newAddress, error: addErr } = await add(user.id, form, verified === true);
    if (addErr || !newAddress) {
      Alert.alert('Error', addErr ?? 'Could not save address.');
      return;
    }

    // Mark as personal and link to profile
    await supabaseMarkPersonal(newAddress.id);
    const { error: profileErr } = await updateProfile(user.id, {
      personal_address_id: newAddress.id,
    });
    if (profileErr) {
      Alert.alert('Error', profileErr);
      return;
    }

    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.step}>Step 2 of 2</Text>
          <Text style={styles.title}>Your mailing address</Text>
          <Text style={styles.subtitle}>
            This will appear as the return address on every postcard you send. US addresses only.
          </Text>
        </View>

        <AddressForm
          values={form}
          onChange={handleChange}
          verified={verified}
          validating={validating}
          onValidate={handleVerify}
          showLabel={false}
        />

        <TouchableOpacity
          style={[styles.btnPrimary, (loading || verified === null) && styles.disabled]}
          onPress={handleSave}
          disabled={loading || verified === null}
        >
          <Text style={styles.btnPrimaryText}>
            {loading ? 'Saving…' : 'Save & Continue →'}
          </Text>
        </TouchableOpacity>

        {verified === null && (
          <Text style={styles.hint}>Verify your address above before saving.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Mark the newly created address as personal via a direct Supabase update
async function supabaseMarkPersonal(addressId: string) {
  const { supabase } = await import('@/lib/supabase');
  await supabase.from('addresses').update({ is_personal: true }).eq('id', addressId);
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    paddingTop: 80,
    gap: SPACING.lg,
    paddingBottom: 40,
  },
  header: { gap: SPACING.sm },
  step: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 22 },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  hint: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: -SPACING.sm },
});
