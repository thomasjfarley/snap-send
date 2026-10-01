import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MAILING_COUNTRIES, getMailingCountry } from '@/constants/countries';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

interface CountryPickerProps {
  value: string;
  onChange: (countryCode: string) => void;
}

export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const selected = getMailingCountry(value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return MAILING_COUNTRIES;
    return MAILING_COUNTRIES.filter((country) =>
      country.name.toLocaleLowerCase().includes(normalized) ||
      country.code.toLocaleLowerCase().includes(normalized),
    );
  }, [query]);

  function selectCountry(code: string) {
    onChange(code);
    setVisible(false);
    setQuery('');
  }

  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setVisible(true)}>
        <Text style={styles.flag}>{selected.flag}</Text>
        <View style={styles.selectorText}>
          <Text style={styles.label}>Country</Text>
          <Text style={styles.value}>{selected.name}</Text>
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Select country</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search countries"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              const previous = filtered[index - 1];
              const showStandardHeader =
                !query && index === 2 && item.riskTier === 'standard';
              const showLimitedHeader =
                !query && item.riskTier === 'limited' && previous?.riskTier !== 'limited';
              return (
                <>
                  {showStandardHeader && <Text style={styles.section}>Standard destinations</Text>}
                  {showLimitedHeader && <Text style={styles.section}>More destinations</Text>}
                  <TouchableOpacity style={styles.row} onPress={() => selectCountry(item.code)}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.name}</Text>
                    {item.code === selected.code && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                </>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No countries found.</Text>}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    selector: {
      minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: SPACING.md, backgroundColor: colors.surface,
    },
    selectorText: { flex: 1 },
    label: { color: colors.textSecondary, fontSize: FONT_SIZE.xs },
    value: { color: colors.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
    flag: { fontSize: 24 },
    chevron: { color: colors.textSecondary, fontSize: 22 },
    modal: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { color: colors.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
    done: { color: colors.primary, fontSize: FONT_SIZE.md, fontWeight: '600' },
    search: {
      margin: SPACING.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: SPACING.md, paddingVertical: 12,
      color: colors.textPrimary, backgroundColor: colors.surface, fontSize: FONT_SIZE.md,
    },
    list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
    section: {
      paddingTop: SPACING.lg, paddingBottom: SPACING.sm,
      color: colors.textSecondary, fontSize: FONT_SIZE.xs,
      fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1,
    },
    row: {
      minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    countryName: { flex: 1, color: colors.textPrimary, fontSize: FONT_SIZE.md },
    check: { color: colors.primary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
    empty: { color: colors.textSecondary, textAlign: 'center', padding: SPACING.xl },
  });
}

