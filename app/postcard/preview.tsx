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
  const sendInProgressRef = useRef(false);
  const paymentIntentIdRef = useRef<string | null>(null);
  const sheetInitializedRef = useRef(false);
  const [sending, setSending] = useState(false);
  // 'checking' = safety check + payment sheet init in progress
  // 'ready'    = payment sheet initialized, tap Send to present immediately
  // 'rejected' = Vision API blocked the image
  // 'error'    = pre-init failed (payment sheet not ready)
  const [preloadStatus, setPreloadStatus] = useState<'checking' | 'ready' | 'rejected' | 'error'>('checking');

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (submittedRef.current) return;
    if (!photoUri || !recipient) router.replace('/postcard');
  }, [photoUri, recipient]);

  // On screen load: run safety check then pre-initialize the Stripe payment sheet.
  // By the time the user reads the preview and taps Send, the sheet is already
  // ready and presentPaymentSheet() is called with essentially zero async delay —
  // satisfying iOS's requirement that native payment UI be presented close to the
  // user's touch gesture.
  useEffect(() => {
    if (!photoUri || Platform.OS === 'web') {
      setPreloadStatus('ready'); // web payment path is handled separately in handleSend
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          // No session — let handleSend handle the auth error path
          setPreloadStatus('ready');
          return;
        }

        // Step 1: Safety check
        const preCheck = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        const { error: safetyError } = await supabase.functions.invoke('check-image-safety', {
          headers: { Authorization: `Bearer ${token}` },
          body: { imageBase64: preCheck.base64 },
        });
        if (cancelled) return;
        const safetyHttpStatus = (safetyError as any)?.context?.status ?? null;
        if (safetyHttpStatus === 422) {
          setPreloadStatus('rejected');
          return;
        }
        // 503 = Vision API unavailable, allow through; other errors are non-blocking

        // Step 2: Create PaymentIntent and initialize the sheet
        const { data: piData, error: piError } = await supabase.functions.invoke('create-payment-intent', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (piError || !piData?.clientSecret) {
          console.error('[preview] pre-init: create-payment-intent failed', piError);
          setPreloadStatus('error');
          return;
        }

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Snap Send',
          paymentIntentClientSecret: piData.clientSecret,
          returnURL: 'snapsend://stripe-redirect',
          defaultBillingDetails: { name: profile?.full_name ?? '' },
        });
        if (cancelled) return;
        if (initError) {
          console.error('[preview] pre-init: initPaymentSheet failed', initError);
          setPreloadStatus('error');
          return;
        }

        paymentIntentIdRef.current = piData.paymentIntentId;
        sheetInitializedRef.current = true;
        setPreloadStatus('ready');
      } catch (err) {
        if (!cancelled) {
          console.error('[preview] pre-init error', err);
          setPreloadStatus('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [photoUri]);

  if (!photoUri || !recipient) {
    return null;
  }

  const activeFrame = FRAMES.find((f) => f.id === frameId)!;
  const overlay = FILTER_OVERLAYS[filterId];
  const isGrayscale = filterId === 'bw';
  const priceStr = `$${(POSTCARD_PRICE_CENTS / 100).toFixed(2)}`;

  function toggleRejectedInfo() {
    Alert.alert(
      'Why can\'t this image be mailed?',
      'Our mail carrier requires all postcards to meet postal content guidelines. This image was flagged and cannot be physically mailed. Please go back and choose a different photo.',
    );
  }

  async function handleSend() {
    if (!recipient) return;
    if (sendInProgressRef.current) return;
    sendInProgressRef.current = true;
    if (Platform.OS === 'web') {
      Alert.alert('Mobile only', 'Payments are available in the iOS and Android app.');
      sendInProgressRef.current = false;
      return;
    }
    if (!personalAddress) {
      Alert.alert('Missing return address', 'Please add your personal address in Settings first.');
      sendInProgressRef.current = false;
      return;
    }
    if (preloadStatus === 'rejected') {
      Alert.alert('Image rejected', 'This image cannot be mailed. Please choose a different photo.');
      sendInProgressRef.current = false;
      return;
    }
    if (!sheetInitializedRef.current) {
      Alert.alert('Not ready', 'Please wait a moment and try again.');
      sendInProgressRef.current = false;
      return;
    }

    setSending(true);
    try {
      // Present the payment sheet immediately — it was initialized on screen load
      // so there is no async work between this tap and the native UI presentation.
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') {
          console.error('[presentPaymentSheet] error', payError);
          Alert.alert('Payment failed', payError.message);
        }
        setSending(false);
        sendInProgressRef.current = false;
        return;
      }
      console.log('[presentPaymentSheet] payment confirmed');

      // Payment confirmed — now we can do async work freely.
      // Refresh the token for the submit call.
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const freshToken = refreshData?.session?.access_token;
      if (refreshError || !freshToken) {
        console.error('[handleSend] session refresh failed', refreshError);
        Alert.alert('Submission error', 'Payment was taken but we couldn\'t submit your postcard. Please contact support with your order details.');
        setSending(false);
        return;
      }
      console.log('[handleSend] session refreshed ok');

      // Capture and resize image
      const tmpUri = await captureRef(cardFrontRef, { format: 'jpg', quality: 0.9 });
      const resized = await ImageManipulator.manipulateAsync(
        tmpUri,
        [{ resize: { width: 1875, height: 1275 } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = resized.base64!;
      console.log('[handleSend] image captured, base64 length:', base64.length);

      // Submit postcard via Edge Function
      console.log('[handleSend] calling submit-postcard...');
      const { data: submitData, error: submitError } = await supabase.functions.invoke('submit-postcard', {
        headers: { Authorization: `Bearer ${freshToken}` },
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
          paymentIntentId: paymentIntentIdRef.current,
        },
      });

      if (submitError) {
        const status = (submitError as any)?.context?.status ?? 'unknown';
        let body: unknown = null;
        try { body = await (submitError as any)?.context?.json(); } catch {}
        console.error('[submit-postcard] error', { status, message: submitError.message, body });

        // Defense-in-depth: the submit function also runs SafeSearch; surface the
        // rejection message directly rather than wrapping it in a generic error.
        if (status === 422 && (body as any)?.code === 'CONTENT_REJECTED') {
          Alert.alert('Image rejected', 'This image cannot be mailed. Please choose a different photo.');
          setSending(false);
          return;
        }

        const detail = body
          ? (typeof (body as any)?.error === 'string' ? (body as any).error : JSON.stringify(body, null, 2))
          : submitError.message;
        throw new Error(`submit-postcard failed (${status}): ${detail}`);
      }

      console.log('[submit-postcard] ok', submitData);
      submittedRef.current = true;
      setJustSent(true);   // set BEFORE reset so all guards skip
      reset();
      router.dismissAll();  // closes entire postcard modal stack, returns to (tabs)/index
      return; // component unmounts; don't call setSending in finally
    } catch (err: any) {
      console.error('[handleSend] caught error:', err);
      Alert.alert('Something went wrong', err.message ?? 'Please try again.');
    } finally {
      sendInProgressRef.current = false;
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
        <View style={styles.sendBtnRow}>
          <TouchableOpacity
            style={[styles.sendBtn, (sending || preloadStatus === 'checking' || preloadStatus === 'rejected' || preloadStatus === 'error') && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending || preloadStatus === 'checking' || preloadStatus === 'rejected' || preloadStatus === 'error'}
          >
            {sending || preloadStatus === 'checking'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sendBtnText}>
                  {preloadStatus === 'rejected' ? '🚫 Image cannot be mailed' :
                   preloadStatus === 'error'    ? '⚠️ Unable to load payment' :
                   `Send for ${priceStr} 📬`}
                </Text>
            }
          </TouchableOpacity>
          {preloadStatus === 'rejected' && (
            <TouchableOpacity style={styles.infoIconBtn} onPress={toggleRejectedInfo} hitSlop={8}>
              <View style={styles.infoIconCircle}>
                <Text style={styles.infoIconText}>?</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

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
    sendBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
    sendBtnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl },
    infoIconBtn: {},
    infoIconCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
    infoIconText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.textSecondary, lineHeight: 20 },
    rejectedTooltip: { backgroundColor: colors.surface ?? colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: SPACING.md, marginTop: SPACING.sm },
    rejectedTooltipText: { fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 20 },
    webNote: { textAlign: 'center', fontSize: FONT_SIZE.sm, color: '#B45309', backgroundColor: '#FEF3C7', padding: SPACING.md, borderRadius: 10 },
    sendNote: { fontSize: FONT_SIZE.xs, color: colors.textSecondary, textAlign: 'center' },
  });
}

