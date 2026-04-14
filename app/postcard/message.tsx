import React, { useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const MAX_CHARS = 500;

export default function MessageScreen() {
  const router = useRouter();
  const { message, setMessage } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function handleNext() {
    if (message.trim().length === 0) return;
    router.push('/postcard/recipient');
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
              {message.length}/{MAX_CHARS}
            </Text>
          </View>

          <TextInput
            style={styles.messageInput}
            multiline
            scrollEnabled
            placeholder="Write something heartfelt..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, MAX_CHARS))}
            maxLength={MAX_CHARS}
            textAlignVertical="top"
            autoFocus
          />

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
    tip: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
