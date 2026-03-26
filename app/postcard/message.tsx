import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';

const MAX_CHARS = 300;

export default function MessageScreen() {
  const router = useRouter();
  const { message, setMessage } = usePostcardStore();

  function handleNext() {
    if (message.trim().length === 0) return;
    router.push('/postcard/recipient');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.navText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Write Message</Text>
          <TouchableOpacity onPress={handleNext} disabled={message.trim().length === 0}>
            <Text style={[styles.navText, { color: message.trim().length > 0 ? COLORS.primary : COLORS.textSecondary, fontWeight: '700' }]}>Next →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Postcard back mockup */}
          <View style={styles.postcardBack}>
            <View style={styles.messageArea}>
              <Text style={styles.postcardHint}>Your message</Text>
              <TextInput
                style={styles.messageInput}
                multiline
                placeholder="Write something heartfelt..."
                placeholderTextColor="#aaa"
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, MAX_CHARS))}
                maxLength={MAX_CHARS}
                autoFocus
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.addressArea}>
              <View style={styles.addressLines}>
                <View style={styles.addressLine} />
                <View style={styles.addressLine} />
                <View style={styles.addressLine} />
              </View>
              <View style={styles.stampBox}>
                <Text style={styles.stampText}>STAMP</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.charCount, message.length > MAX_CHARS * 0.9 && { color: COLORS.error }]}>
            {message.length}/{MAX_CHARS}
          </Text>

          <Text style={styles.tip}>✉️ Your message will appear on the back of the postcard, just like a real one.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  navText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  body: { padding: SPACING.xl, gap: SPACING.md },
  postcardBack: {
    backgroundColor: '#FFFEF0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DCC8',
    padding: SPACING.md,
    flexDirection: 'row',
    minHeight: 200,
    gap: 0,
  },
  messageArea: { flex: 3, paddingRight: SPACING.sm },
  postcardHint: { fontSize: 9, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  messageInput: {
    flex: 1, fontSize: FONT_SIZE.sm, color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 22, minHeight: 140, textAlignVertical: 'top',
  },
  divider: { width: 1, backgroundColor: '#D0CCAA', marginHorizontal: SPACING.sm },
  addressArea: { flex: 2, justifyContent: 'space-between' },
  addressLines: { flex: 1, gap: 8, paddingTop: SPACING.sm, justifyContent: 'center' },
  addressLine: { height: 1, backgroundColor: '#CCC', borderRadius: 1 },
  stampBox: {
    width: 48, height: 56, borderWidth: 1.5, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
    borderRadius: 3,
  },
  stampText: { fontSize: 8, color: '#BBB', letterSpacing: 1 },
  charCount: { textAlign: 'right', fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  tip: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: SPACING.md },
});
