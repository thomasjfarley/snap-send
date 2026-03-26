import { useState, useMemo } from 'react';
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
import { useAddressStore } from '@/store/address.store';
import { AddressForm } from '@/components/AddressForm';
import type { AddressFormData } from '@/store/address.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const EMPTY_FORM: AddressFormData = {
  label: 'Friend',
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

export default function NewAddressScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { add, validate, loading, validating } = useAddressStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [form, setForm] = useState<AddressFormData>(EMPTY_FORM);
  const [verified, setVerified] = useState<boolean | null>(null);

  function handleChange(field: keyof AddressFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setVerified(null);
  }

  async function handleVerify() {
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in street, city, state, and ZIP first.');
      return;
    }
    const { result, error } = await validate(form);
    if (error) { Alert.alert('Verification error', error); return; }
    if (result) {
      setVerified(result.verified);
      if (result.verified) {
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
    if (!form.full_name.trim()) { Alert.alert('Missing name', 'Please enter the recipient\'s full name.'); return; }
    if (!form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.zip.trim()) {
      Alert.alert('Incomplete address', 'Please fill in all required fields.'); return;
    }
    const { error } = await add(user.id, form, verified === true);
    if (error) { Alert.alert('Error', error); return; }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Recipient</Text>
          <View style={{ width: 60 }} />
        </View>

        <AddressForm
          values={form}
          onChange={handleChange}
          verified={verified}
          validating={validating}
          onValidate={handleVerify}
          showLabel={true}
        />

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.disabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>{loading ? 'Saving…' : 'Save Recipient'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: colors.background, padding: SPACING.xl, paddingTop: 60, gap: SPACING.lg, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cancel: { color: colors.primary, fontSize: FONT_SIZE.md },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
    btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
