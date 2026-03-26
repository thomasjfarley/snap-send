import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';
import type { AddressFormData } from '@/store/address.store';

interface AddressFormProps {
  values: AddressFormData;
  onChange: (field: keyof AddressFormData, value: string) => void;
  verified: boolean | null; // null = not yet validated
  validating: boolean;
  onValidate: () => void;
  showLabel?: boolean;
}

export function AddressForm({
  values,
  onChange,
  verified,
  validating,
  onValidate,
  showLabel = true,
}: AddressFormProps) {
  return (
    <View style={styles.container}>
      {showLabel && (
        <TextInput
          style={styles.input}
          placeholder='Label (e.g. "Home", "Mom")'
          placeholderTextColor={COLORS.textSecondary}
          value={values.label}
          onChangeText={(v) => onChange('label', v)}
          autoCapitalize="words"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Full name of recipient"
        placeholderTextColor={COLORS.textSecondary}
        value={values.full_name}
        onChangeText={(v) => onChange('full_name', v)}
        autoCapitalize="words"
        autoComplete="name"
      />

      <TextInput
        style={styles.input}
        placeholder="Street address"
        placeholderTextColor={COLORS.textSecondary}
        value={values.line1}
        onChangeText={(v) => onChange('line1', v)}
        autoCapitalize="words"
        autoComplete="street-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Apt, suite, unit (optional)"
        placeholderTextColor={COLORS.textSecondary}
        value={values.line2}
        onChangeText={(v) => onChange('line2', v)}
        autoCapitalize="words"
      />

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex2]}
          placeholder="City"
          placeholderTextColor={COLORS.textSecondary}
          value={values.city}
          onChangeText={(v) => onChange('city', v)}
          autoCapitalize="words"
          autoComplete="postal-address-locality"
        />
        <TextInput
          style={[styles.input, styles.stateInput]}
          placeholder="State"
          placeholderTextColor={COLORS.textSecondary}
          value={values.state}
          onChangeText={(v) => onChange('state', v.toUpperCase().slice(0, 2))}
          autoCapitalize="characters"
          maxLength={2}
          autoComplete="postal-address-region"
        />
        <TextInput
          style={[styles.input, styles.zipInput]}
          placeholder="ZIP"
          placeholderTextColor={COLORS.textSecondary}
          value={values.zip}
          onChangeText={(v) => onChange('zip', v)}
          keyboardType="number-pad"
          maxLength={10}
          autoComplete="postal-code"
        />
      </View>

      <TouchableOpacity
        style={[styles.verifyBtn, validating && styles.disabled]}
        onPress={onValidate}
        disabled={validating}
      >
        <Text style={styles.verifyBtnText}>
          {validating ? 'Verifying…' : verified === null ? 'Verify Address' : 'Re-verify Address'}
        </Text>
      </TouchableOpacity>

      {verified === true && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✅ Address verified</Text>
        </View>
      )}
      {verified === false && (
        <View style={[styles.badge, styles.badgeWarn]}>
          <Text style={styles.badgeWarnText}>
            ⚠️ Address could not be verified. Double-check before sending.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm },
  flex2: { flex: 2 },
  stateInput: { width: 56 },
  zipInput: { width: 90 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  verifyBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: SPACING.xs,
  },
  verifyBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  badge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  badgeText: { color: '#15803D', fontSize: FONT_SIZE.sm, fontWeight: '500' },
  badgeWarn: { backgroundColor: '#FEF9C3' },
  badgeWarnText: { color: '#854D0E', fontSize: FONT_SIZE.sm },
});
