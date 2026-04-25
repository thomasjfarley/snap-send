import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const MAX_CHARS = 500;
const MAX_LINES = 18;
// Approximate characters that fit on one visual line of the printed card
// (13px Helvetica in the 48%-wide message area at Lob's render resolution)
const CHARS_PER_LINE = 35;

function countVisualLines(text: string): number {
  return text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: {
    city?: string; town?: string; village?: string;
    county?: string; state?: string; country?: string;
  };
}

interface ReverseResult {
  display_name: string;
  address?: {
    neighbourhood?: string; suburb?: string; hamlet?: string; quarter?: string;
    city?: string; town?: string; village?: string; county?: string; state?: string;
  };
}

interface LocationOption { id: number; label: string }

function formatLocationLabel(item: NominatimResult): string {
  const parts = item.display_name.split(', ');
  const name = parts[0];
  const addr = item.address ?? {};
  const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? parts[1] ?? '';
  const state = addr.state ?? '';
  return [name, city, state].filter(Boolean).join(', ');
}

export default function MessageScreen() {
  const router = useRouter();
  const { message, setMessage, location, setLocation } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [locationQuery, setLocationQuery] = useState(location ?? '');
  const [locationResults, setLocationResults] = useState<LocationOption[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsCoords = useRef<{ lat: number; lon: number } | null>(null);

  // Fetch GPS on mount so coords are ready before the user starts typing
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        gpsCoords.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch {
        // GPS is optional — silently skip
      }
    })();
  }, []);

  function handleNext() {
    if (message.trim().length === 0) return;
    router.push('/postcard/recipient');
  }

  async function handleLocationFocus() {
    // Only show GPS suggestions when field is empty and coords are available
    if (locationQuery.trim() || !gpsCoords.current) return;
    const { lat, lon } = gpsCoords.current;
    setLocationLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`,
        { headers: { 'User-Agent': 'SnapSend/1.0 (snapsend.live)' } },
      );
      const data: ReverseResult = await res.json();
      const addr = data.address ?? {};
      const neighbourhood = addr.neighbourhood ?? addr.suburb ?? addr.hamlet ?? addr.quarter ?? '';
      const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? '';
      const state = addr.state ?? '';

      const variants: string[] = [];
      if (neighbourhood && city) variants.push([neighbourhood, city, state].filter(Boolean).join(', '));
      if (city) variants.push([city, state].filter(Boolean).join(', '));
      if (addr.county && addr.county !== city && state) variants.push([addr.county, state].filter(Boolean).join(', '));

      const unique = [...new Set(variants)];
      if (unique.length > 0) {
        setLocationResults(unique.map((label, i) => ({ id: -(i + 1), label })));
        setShowDropdown(true);
      }
    } catch {
      // GPS is optional — silently skip
    } finally {
      setLocationLoading(false);
    }
  }

  function handleLocationChange(text: string) {
    setLocationQuery(text);
    if (!text.trim()) {
      setLocation(null);
      setLocationResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocation(text), 400);
  }

  async function searchLocation(query: string) {
    setLocationLoading(true);
    try {
      const coords = gpsCoords.current;
      // If we have GPS coords, add a soft geographic bias without restricting global results
      const biasParam = coords
        ? `&viewbox=${coords.lon - 5},${coords.lat + 5},${coords.lon + 5},${coords.lat - 5}&bounded=0`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1${biasParam}`,
        { headers: { 'User-Agent': 'SnapSend/1.0 (snapsend.live)' } },
      );
      const data: NominatimResult[] = await res.json();
      setLocationResults(data.map((r) => ({ id: r.place_id, label: formatLocationLabel(r) })));
      setShowDropdown(data.length > 0);
    } catch {
      // silently fail — location is optional
    } finally {
      setLocationLoading(false);
    }
  }

  function selectLocation(label: string) {
    setLocation(label);
    setLocationQuery(label);
    setShowDropdown(false);
    setLocationResults([]);
  }

  function clearLocation() {
    setLocation(null);
    setLocationQuery('');
    setShowDropdown(false);
    setLocationResults([]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.navText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Write Message</Text>
          <TouchableOpacity onPress={handleNext} disabled={message.trim().length === 0}>
            <Text style={[styles.navText, { color: message.trim().length > 0 ? colors.primary : colors.textSecondary, fontWeight: '700' }]}>Next →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Your message</Text>
            <Text style={[styles.charCount, message.length > MAX_CHARS * 0.9 && { color: colors.error }]}>
              {message.length}/{MAX_CHARS} · {message.split('\n').length}/{MAX_LINES} lines
            </Text>
          </View>

          <TextInput
            style={styles.messageInput}
            multiline
            scrollEnabled
            placeholder="Write something heartfelt..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={(t) => {
              const lines = t.split('\n');
              if (lines.length > MAX_LINES) return;
              if (countVisualLines(t) > MAX_LINES) return;
              setMessage(t.slice(0, MAX_CHARS));
            }}
            maxLength={MAX_CHARS}
            textAlignVertical="top"
            autoFocus
          />

          {/* Location picker */}
          <View style={styles.locationWrapper}>
            <View style={styles.locationRow}>
              <Text style={styles.locationPin}>📍</Text>
              <TextInput
                style={styles.locationInput}
                placeholder="Add a location (optional)"
                placeholderTextColor={colors.textSecondary}
                value={locationQuery}
                onChangeText={handleLocationChange}
                onFocus={handleLocationFocus}
                returnKeyType="search"
                autoCorrect={false}
              />
              {locationLoading && <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginRight: SPACING.sm }} />}
              {!!locationQuery && !locationLoading && (
                <TouchableOpacity onPress={clearLocation} hitSlop={8}>
                  <Text style={styles.locationClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {showDropdown && (
              <FlatList
                style={styles.dropdown}
                data={locationResults}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => selectLocation(item.label)}>
                    <Text style={styles.dropdownText} numberOfLines={1}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          <Text style={styles.tip}>✉️ Your message will appear on the back of the postcard, just like a real one.</Text>
        </View>
      </KeyboardAvoidingView>
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
    body: { flex: 1, padding: SPACING.xl, gap: SPACING.md },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.textPrimary },
    charCount: { fontSize: FONT_SIZE.xs, color: colors.textSecondary },
    messageInput: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: colors.textPrimary,
      lineHeight: 24,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: SPACING.md,
      backgroundColor: colors.surface ?? colors.background,
    },
    locationWrapper: { gap: 0 },
    locationRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      backgroundColor: colors.surface ?? colors.background,
    },
    locationPin: { fontSize: FONT_SIZE.md, marginRight: SPACING.sm },
    locationInput: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    locationClear: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, paddingLeft: SPACING.sm },
    dropdown: {
      borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
      borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
      backgroundColor: colors.surface ?? colors.background,
      overflow: 'hidden',
    },
    dropdownItem: {
      paddingHorizontal: SPACING.md, paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    dropdownText: { fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    tip: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
