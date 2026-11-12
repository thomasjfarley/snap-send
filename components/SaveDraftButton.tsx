import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { usePostcardStore } from '@/store/postcard.store';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { saveDraft, type DraftStep } from '@/lib/drafts';

export function SaveDraftButton({ step, disabled }: { step: DraftStep; disabled?: boolean }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    btn: { alignSelf: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
    text: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.primary },
  }), [colors]);

  async function onPress() {
    const s = usePostcardStore.getState();
    if (!user || !s.photoUri || saving) return;
    setSaving(true);
    try {
      await saveDraft({
        id: s.draftId,
        userId: user.id,
        photoUri: s.photoUri,
        filterId: s.filterId,
        frameId: s.frameId,
        message: s.message,
        location: s.location,
        recipientId: s.recipient?.id ?? null,
        step,
      });
      router.dismissTo('/(tabs)');
      // Reset after the flow unmounts so screens with "no photo -> go to chooser" guards don't redirect.
      setTimeout(() => usePostcardStore.getState().reset(), 400);
    } catch (err) {
      console.error('[drafts] save failed', err);
      Alert.alert('Could not save draft', 'Something went wrong saving your draft. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} disabled={disabled || saving} accessibilityRole="button">
      <Text style={styles.text}>{saving ? 'Saving…' : '💾 Save Draft'}</Text>
    </TouchableOpacity>
  );
}
