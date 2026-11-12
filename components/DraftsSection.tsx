import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useAddressStore } from '@/store/address.store';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { deleteDraft, listDrafts, type DraftStep, type PostcardDraft } from '@/lib/drafts';

const STEP_ROUTES: Record<DraftStep, string[]> = {
  editor: ['/postcard/editor'],
  message: ['/postcard/editor', '/postcard/message'],
  recipient: ['/postcard/editor', '/postcard/message', '/postcard/recipient'],
  preview: ['/postcard/editor', '/postcard/message', '/postcard/recipient', '/postcard/preview'],
};

const STEP_LABELS: Record<DraftStep, string> = {
  editor: 'Editing photo',
  message: 'Writing message',
  recipient: 'Choosing recipient',
  preview: 'Ready to preview',
};

export function DraftsSection() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const [drafts, setDrafts] = useState<PostcardDraft[]>([]);
  const [opening, setOpening] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACING.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: colors.surface,
      borderRadius: 14, padding: SPACING.sm, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.sm,
    },
    thumb: { width: 64, height: 48, borderRadius: 8, backgroundColor: colors.border },
    info: { flex: 1 },
    step: { fontSize: FONT_SIZE.md, fontWeight: '600', color: colors.textPrimary },
    sub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, marginTop: 2 },
    del: { padding: SPACING.sm },
    delText: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  }), [colors]);

  const refresh = useCallback(() => {
    if (!user) { setDrafts([]); return; }
    listDrafts(user.id).then(setDrafts).catch(() => setDrafts([]));
  }, [user]);

  useFocusEffect(refresh);

  async function resume(draft: PostcardDraft) {
    if (opening || !user) return;
    setOpening(true);
    try {
      let recipient = null;
      if (draft.recipientId) {
        const addrStore = useAddressStore.getState();
        if (!addrStore.addresses.length) await addrStore.fetch(user.id);
        recipient = useAddressStore.getState().addresses.find((a) => a.id === draft.recipientId) ?? null;
      }
      // A saved recipient may have been deleted since; fall back to the recipient step.
      const step: DraftStep = draft.step === 'preview' && !recipient ? 'recipient' : draft.step;
      usePostcardStore.getState().loadDraft({ ...draft, recipient });
      STEP_ROUTES[step].forEach((r) => router.push(r as never));
    } finally {
      setOpening(false);
    }
  }

  function confirmDelete(draft: PostcardDraft) {
    Alert.alert('Delete draft?', 'This draft will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDraft(draft.id); refresh(); } },
    ]);
  }

  if (drafts.length === 0) return null;

  return (
    <View>
      <Text style={styles.title}>Drafts</Text>
      {drafts.map((d) => (
        <TouchableOpacity key={d.id} style={styles.row} onPress={() => resume(d)} disabled={opening}>
          <Image source={{ uri: d.photoUri }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.info}>
            <Text style={styles.step}>{STEP_LABELS[d.step]}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {d.message.trim() || 'No message yet'} · {new Date(d.updatedAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity style={styles.del} onPress={() => confirmDelete(d)} hitSlop={8}>
            <Text style={styles.delText}>Delete</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}
