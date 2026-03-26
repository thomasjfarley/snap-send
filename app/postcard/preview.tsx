import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import { FRAMES } from '@/constants/editor';
import { COLORS, FONT_SIZE, SPACING } from '@/constants/theme';
import { POSTCARD_PRICE_CENTS } from '@/constants/config';

const FILTER_OVERLAYS: Record<string, { color: string; opacity: number } | null> = {
  none: null,
  warm: { color: 'rgba(255,140,0,1)', opacity: 0.18 },
  cool: { color: 'rgba(100,149,237,1)', opacity: 0.2 },
  bw:   null,
  fade: { color: 'rgba(255,255,255,1)', opacity: 0.25 },
  vivid:{ color: 'rgba(180,0,180,1)', opacity: 0.08 },
};

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - SPACING.xl * 2;
const CARD_H = CARD_W * (3 / 4);

export default function PreviewScreen() {
  const router = useRouter();
  const { photoUri, filterId, frameId, message, recipient } = usePostcardStore();
  const { profile } = useProfileStore();
  const { addresses } = useAddressStore();
  const personalAddress = addresses.find((a) => a.is_personal);

  if (!photoUri || !recipient) {
    router.replace('/postcard');
    return null;
  }

  const activeFrame = FRAMES.find((f) => f.id === frameId)!;
  const overlay = FILTER_OVERLAYS[filterId];
  const isGrayscale = filterId === 'bw';
  const priceStr = `$${(POSTCARD_PRICE_CENTS / 100).toFixed(2)}`;

  function handleSend() {
    Alert.alert('Coming soon', 'Payment flow is in the next phase! 🎉');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Preview</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Front */}
        <Text style={styles.sideLabel}>FRONT</Text>
        <View style={[
          styles.cardFront,
          { borderWidth: activeFrame.borderWidth, borderColor: activeFrame.borderColor, padding: activeFrame.padding }
        ]}>
          <View style={{ position: 'relative', width: CARD_W - activeFrame.borderWidth * 2 - activeFrame.padding * 2, height: CARD_H - activeFrame.borderWidth * 2 - activeFrame.padding * 2 }}>
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {isGrayscale && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(128,128,128,0.55)' }]} />}
            {overlay && <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay.color, opacity: overlay.opacity }]} />}
          </View>
        </View>

        {/* Back */}
        <Text style={styles.sideLabel}>BACK</Text>
        <View style={styles.cardBack}>
          <View style={styles.backMessage}>
            <Text style={styles.backMessageText}>{message}</Text>
          </View>
          <View style={styles.backDivider} />
          <View style={styles.backRight}>
            <View style={styles.backAddresses}>
              {personalAddress && (
                <View style={styles.addressBlock}>
                  <Text style={styles.addrLabel}>FROM</Text>
                  <Text style={styles.addrText}>{personalAddress.full_name}</Text>
                  <Text style={styles.addrText}>{personalAddress.line1}</Text>
                  {personalAddress.line2 ? <Text style={styles.addrText}>{personalAddress.line2}</Text> : null}
                  <Text style={styles.addrText}>{personalAddress.city}, {personalAddress.state} {personalAddress.zip}</Text>
                </View>
              )}
              <View style={styles.addressBlock}>
                <Text style={styles.addrLabel}>TO</Text>
                <Text style={[styles.addrText, { fontWeight: '600' }]}>{recipient.full_name}</Text>
                <Text style={styles.addrText}>{recipient.line1}</Text>
                {recipient.line2 ? <Text style={styles.addrText}>{recipient.line2}</Text> : null}
                <Text style={styles.addrText}>{recipient.city}, {recipient.state} {recipient.zip}</Text>
              </View>
            </View>
            <View style={styles.stampBox}>
              <Text style={styles.stampText}>STAMP</Text>
            </View>
          </View>
        </View>

        {/* Send button */}
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send for {priceStr} 📬</Text>
        </TouchableOpacity>
        <Text style={styles.sendNote}>Your postcard will be printed and mailed within 1–2 business days.</Text>
      </ScrollView>
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
  scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: 60 },
  sideLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 2, textTransform: 'uppercase' },
  cardFront: { width: CARD_W, overflow: 'hidden', borderRadius: 4 },
  cardBack: {
    width: CARD_W, minHeight: CARD_H,
    backgroundColor: '#FFFEF0', borderRadius: 4,
    borderWidth: 1, borderColor: '#E0DCC8',
    flexDirection: 'row', padding: SPACING.md, gap: 0,
  },
  backMessage: { flex: 3, paddingRight: SPACING.sm },
  backMessageText: { fontSize: FONT_SIZE.sm, color: '#333', lineHeight: 22 },
  backDivider: { width: 1, backgroundColor: '#D0CCAA', marginHorizontal: SPACING.sm },
  backRight: { flex: 2, justifyContent: 'space-between' },
  backAddresses: { gap: SPACING.md, flex: 1, justifyContent: 'center' },
  addressBlock: { gap: 2 },
  addrLabel: { fontSize: 8, fontWeight: '700', color: '#999', letterSpacing: 1 },
  addrText: { fontSize: 10, color: '#444', lineHeight: 14 },
  stampBox: { width: 40, height: 48, borderWidth: 1.5, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', borderRadius: 2 },
  stampText: { fontSize: 7, color: '#BBB', letterSpacing: 1 },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: SPACING.lg, alignItems: 'center', marginTop: SPACING.xl },
  sendBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  sendNote: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
});
