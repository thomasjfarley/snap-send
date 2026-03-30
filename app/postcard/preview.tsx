import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { usePostcardStore } from '@/store/postcard.store';
import { useProfileStore } from '@/store/profile.store';
import { useAddressStore } from '@/store/address.store';
import { FRAMES } from '@/constants/editor';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { POSTCARD_PRICE_CENTS } from '@/constants/config';
import { supabase } from '@/lib/supabase';

// Native-only imports — gracefully skipped on web
const captureRef: (ref: React.RefObject<View | null>, opts?: Record<string, unknown>) => Promise<string> =
  Platform.OS !== 'web'
    ? require('react-native-view-shot').captureRef
    : async () => '';

const useStripe: () => { initPaymentSheet: Function; presentPaymentSheet: Function } =
  Platform.OS !== 'web'
    ? require('@stripe/stripe-react-native').useStripe
    : () => ({ initPaymentSheet: async () => ({}), presentPaymentSheet: async () => ({ error: { code: 'WEB_UNSUPPORTED' } }) });

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
  const { photoUri, filterId, frameId, message, recipient, reset, setJustSent } = usePostcardStore();
  const { profile } = useProfileStore();
  const { addresses } = useAddressStore();
  const personalAddress = addresses.find((a) => a.is_personal);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const cardFrontRef = useRef<View>(null);
  const submittedRef = useRef(false);
  const [sending, setSending] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (submittedRef.current) return; // success path — guard suppressed
    if (!photoUri || !recipient) router.replace('/postcard');
  }, [photoUri, recipient]);

  if (!photoUri || !recipient) {
    return null;
  }

  const activeFrame = FRAMES.find((f) => f.id === frameId)!;
  const overlay = FILTER_OVERLAYS[filterId];
  const isGrayscale = filterId === 'bw';
  const priceStr = `$${(POSTCARD_PRICE_CENTS / 100).toFixed(2)}`;

  async function handleSend() {
    if (!recipient) return;
    if (Platform.OS === 'web') {
      Alert.alert('Mobile only', 'Payments are available in the iOS and Android app.');
      return;
    }
    if (!personalAddress) {
      Alert.alert('Missing return address', 'Please add your personal address in Settings first.');
      return;
    }

    setSending(true);
    try {
      // 1. Create PaymentIntent
      const { data: piData, error: piError } = await supabase.functions.invoke('create-payment-intent');
      if (piError || !piData?.clientSecret) throw new Error(piError?.message ?? 'Failed to create payment');

      // 2. Init Stripe PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Snap Send',
        paymentIntentClientSecret: piData.clientSecret,
        returnURL: 'snapsend://stripe-redirect',
        defaultBillingDetails: { name: profile?.full_name ?? '' },
      });
      if (initError) throw new Error(initError.message);

      // 3. Present PaymentSheet — must happen before captureRef so the native
      //    view-shot snapshot doesn't disrupt the iOS view controller hierarchy
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') {
          Alert.alert('Payment failed', payError.message);
        }
        setSending(false);
        return;
      }

      // 4. Capture and resize image after payment is confirmed
      const tmpUri = await captureRef(cardFrontRef, { format: 'jpg', quality: 0.9 });
      const resized = await ImageManipulator.manipulateAsync(
        tmpUri,
        [{ resize: { width: 1875, height: 1275 } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = resized.base64!;

      // 5. Submit postcard via Edge Function
      const { data: submitData, error: submitError } = await supabase.functions.invoke('submit-postcard', {
        body: {
          imageBase64: base64,
          message,
          frame: frameId,
          filter: filterId,
          fromAddressId: personalAddress.id,
          toAddressId: recipient.id,
          recipientSnapshot: {
            full_name: recipient.full_name,
            line1: recipient.line1,
            line2: recipient.line2,
            city: recipient.city,
            state: recipient.state,
            zip: recipient.zip,
          },
          paymentIntentId: piData.paymentIntentId,
        },
      });

      if (submitError) {
        // supabase.functions.invoke returns data:null on non-2xx; read body from error.context
        let detail = submitError.message;
        try {
          const body = await (submitError as any).context.json();
          const raw = body?.detail ?? body?.error;
          if (raw) detail = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
        } catch {}
        throw new Error(detail);
      }

      if (submitData?.error === 'CONTENT_REJECTED') {
        Alert.alert('Image rejected', 'This image cannot be mailed. Please choose a different photo.');
        setSending(false);
        return;
      }

      // 6. Success — close the postcard modal and show confirmation on home tab
      submittedRef.current = true;
      setJustSent(true);   // set BEFORE reset so all guards skip
      reset();
      router.dismissAll();  // pop to root of postcard modal stack
      router.dismiss();     // dismiss the modal itself, back to (tabs)
      return; // component unmounts; don't call setSending in finally
    } catch (err: any) {
      Alert.alert('Something went wrong', err.message ?? 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={sending}>
          <Text style={styles.navText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Preview</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Front */}
        <Text style={styles.sideLabel}>FRONT</Text>
        <View
          ref={cardFrontRef}
          collapsable={false}
          style={[
            styles.cardFront,
            { borderWidth: activeFrame.borderWidth, borderColor: activeFrame.borderColor, padding: activeFrame.padding },
          ]}
        >
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
        <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={handleSend} disabled={sending}>
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Send for {priceStr} 📬</Text>
          }
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <Text style={styles.webNote}>⚠️ Payments require the iOS or Android app.</Text>
        )}

        <Text style={styles.sendNote}>Your postcard will be printed and mailed within 1–2 business days.</Text>
      </ScrollView>
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
    scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: 60 },
    sideLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 2, textTransform: 'uppercase' },
    cardFront: { width: CARD_W, overflow: 'hidden', borderRadius: 4 },
    cardBack: {
      width: CARD_W, minHeight: CARD_H,
      backgroundColor: '#FFFEF0', borderRadius: 4,
      borderWidth: 1, borderColor: '#E0DCC8',
      flexDirection: 'row', padding: SPACING.md,
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
    sendBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, minHeight: 56 },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
    webNote: { textAlign: 'center', fontSize: FONT_SIZE.sm, color: '#B45309', backgroundColor: '#FEF3C7', padding: SPACING.md, borderRadius: 10 },
    sendNote: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, textAlign: 'center' },
  });
}

