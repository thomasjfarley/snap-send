import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Alert, Platform, ActivityIndicator, Image,
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
import { POSTCARD_PRICE_CENTS, STRIPE_PUBLISHABLE_KEY } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { GrayscaleImage } from '@/components/GrayscaleImage';

const SUPPORT_EMAIL = 'support@snapsend.live';

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
// Postcard is 6" × 4.25" — use the real aspect ratio so the preview is proportionally correct.
const CARD_H = Math.round(CARD_W * (4.25 / 6));
// Lob renders its HTML at 6" × 96 CSS px/inch = 576px wide.
// LOB_SCALE lets us shrink every measurement proportionally to our preview card.
const LOB_RENDER_WIDTH = 576;
const LOB_SCALE = CARD_W / LOB_RENDER_WIDTH;
// Lob HTML: <img width="80"> — scale to preview card size.
const QR_SIZE = Math.round(80 * LOB_SCALE);
// Lob left-cell padding: 24px top/left/bottom, 10px right — scale proportionally.
const MSG_PAD_LEFT   = Math.round(24 * LOB_SCALE);
const MSG_PAD_RIGHT  = Math.round(10 * LOB_SCALE);
const MSG_PAD_VERT   = Math.round(24 * LOB_SCALE);

// Simulates the IMb barcode Lob prints on every postcard.
const BARCODE_PATTERN = [1,0,1,1,0,1,0,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1];
function BarcodeRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 12, marginVertical: 2 }}>
      {BARCODE_PATTERN.map((tall, i) => (
        <View key={i} style={{ flex: 1, height: tall ? 12 : 7, backgroundColor: '#222', marginHorizontal: 0.3 }} />
      ))}
    </View>
  );
}

// Draws a location pin shape (circle head + tapered tail) to match server-side rendering.
function PinIcon({ height, color = '#fff' }: { height: number; color?: string }) {
  const r = Math.round(height * 0.32);
  const circleD = r * 2;
  const tailH = height - r;
  return (
    <View style={{ width: circleD, height, alignItems: 'center' }}>
      <View style={{ width: circleD, height: circleD, borderRadius: r, backgroundColor: color, position: 'absolute', top: 0 }} />
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: r, borderRightWidth: r, borderTopWidth: tailH,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color,
        position: 'absolute', top: r,
      }} />
    </View>
  );
}

export default function PreviewScreen() {
  const router = useRouter();
  const { photoUri, filterId, frameId, message, location, recipient, reset, setJustSent } = usePostcardStore();
  const { profile } = useProfileStore();
  const { addresses } = useAddressStore();
  const personalAddress = addresses.find((a) => a.is_personal);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const cardFrontRef = useRef<View>(null);
  const submittedRef = useRef(false);
  const sendInProgressRef = useRef(false);
  const paymentIntentIdRef = useRef<string | null>(null);
  const sheetInitializedRef = useRef(false);
  const lobBase64Ref = useRef<string | null>(null);
  // Tracks whether Stripe payment was already confirmed so we can skip
  // re-presenting the sheet on retry after an edge function failure.
  const paymentConfirmedRef = useRef(false);
  // Cached submission payload so retries use identical data.
  const submissionPayloadRef = useRef<object | null>(null);
  // Accumulates error details across retry attempts for the support email.
  const errorLogRef = useRef<string[]>([]);
  const [sending, setSending] = useState(false);
  // 'checking' = safety check + payment sheet init in progress
  // 'ready'    = payment sheet initialized, tap Send to present immediately
  // 'rejected' = Vision API blocked the image
  // 'error'    = pre-init failed (payment sheet not ready)
  const [preloadStatus, setPreloadStatus] = useState<'checking' | 'ready' | 'rejected' | 'error'>('checking');
  const [totalAmountCents, setTotalAmountCents] = useState(POSTCARD_PRICE_CENTS);
  const [taxAmountCents, setTaxAmountCents] = useState<number | null>(null);

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

        // Step 1: Process to Lob print dimensions once — reused for both the pre-payment
        // safety check and the final submit so Vision always scores the exact same image.
        const LOB_W = 1875;
        const LOB_H = 1275;
        let lobStep = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: LOB_W } }],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (lobStep.height < LOB_H) {
          lobStep = await ImageManipulator.manipulateAsync(
            photoUri,
            [{ resize: { height: LOB_H } }],
            { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
          );
        }
        const lobCropX = Math.max(0, Math.round((lobStep.width - LOB_W) / 2));
        const lobCropY = Math.max(0, Math.round((lobStep.height - LOB_H) / 2));
        const lobResized = await ImageManipulator.manipulateAsync(
          lobStep.uri,
          [{ crop: { originX: lobCropX, originY: lobCropY, width: LOB_W, height: LOB_H } }],
          { compress: 0.97, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        lobBase64Ref.current = lobResized.base64!;

        // Step 2: Safety check using the exact Lob image — matches submit-postcard
        const { error: safetyError } = await supabase.functions.invoke('check-image-safety', {
          headers: { Authorization: `Bearer ${token}` },
          body: { imageBase64: lobBase64Ref.current },
        });
        if (cancelled) return;
        const safetyHttpStatus = (safetyError as any)?.context?.status ?? null;
        if (safetyHttpStatus === 422) {
          setPreloadStatus('rejected');
          Alert.alert(
            'Why can\'t this image be mailed?',
            'Our mail carrier requires all postcards to meet postal content guidelines. This image was flagged and cannot be physically mailed. Please go back and choose a different photo.',
          );
          return;
        }
        // 503 = Vision API unavailable, allow through; other errors are non-blocking

        // Step 2: Create PaymentIntent and initialize the sheet
        const { data: piData, error: piError } = await supabase.functions.invoke('create-payment-intent', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            testMode: __DEV__,
            ...(personalAddress ? {
              customerAddress: {
                line1: personalAddress.line1,
                line2: personalAddress.line2 ?? undefined,
                city: personalAddress.city,
                state: personalAddress.state,
                postalCode: personalAddress.zip,
                country: personalAddress.country,
              },
            } : {}),
          },
        });
        if (cancelled) return;
        if (piError || !piData?.clientSecret) {
          const errDetail = await (piError as any)?.context?.json?.().catch(() => null);
          console.error('[preview] pre-init: create-payment-intent failed', piError, 'body:', JSON.stringify(errDetail));
          supabase.functions.invoke('report-error', {
            body: {
              source: 'postcard-preview',
              title: 'create-payment-intent preload failed',
              severity: 'error',
              details: `status=${(piError as any)?.context?.status ?? 'unknown'}; body=${JSON.stringify(errDetail).slice(0, 1000)}`,
            },
          }).catch(() => {});
          setPreloadStatus('error');
          return;
        }

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Snap Send',
          paymentIntentClientSecret: piData.clientSecret,
          returnURL: 'snapsend://stripe-redirect',
          defaultBillingDetails: { name: profile?.full_name ?? '' },
          googlePay: {
            merchantCountryCode: 'US',
            testEnv: STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'),
          },
          ...(Platform.OS === 'ios' && {
            applePay: {
              merchantCountryCode: 'US',
              merchantIdentifier: 'merchant.com.snapsend.live',
            },
          }),
        });
        if (cancelled) return;
        if (initError) {
          console.error('[preview] pre-init: initPaymentSheet failed', initError);
          supabase.functions.invoke('report-error', {
            body: {
              source: 'postcard-preview',
              title: 'initPaymentSheet preload failed',
              severity: 'error',
              details: `paymentIntentId=${piData.paymentIntentId ?? 'unknown'}; error=${JSON.stringify(initError).slice(0, 1000)}`,
            },
          }).catch(() => {});
          setPreloadStatus('error');
          return;
        }

        paymentIntentIdRef.current = piData.paymentIntentId;
        sheetInitializedRef.current = true;
        if (piData.amount) setTotalAmountCents(piData.amount);
        if (typeof piData.taxAmountCents === 'number') setTaxAmountCents(piData.taxAmountCents);
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

  const messageFontSize = useMemo(() => {
    const trimmed = (message ?? '').trim();
    const len = trimmed.length;
    const lines = trimmed.split('\n').length;
    const LOB_CHARS_PER_LINE = 40;
    const visualLines = trimmed
      .split('\n')
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / LOB_CHARS_PER_LINE)), 0);
    const byChars = len < 80 ? 15 : len < 200 ? 13 : len < 350 ? 11 : 10;
    const byLines = lines <= 5 ? 15 : lines <= 9 ? 13 : lines <= 13 ? 11 : 10;
    const byVisual = visualLines <= 7 ? 15 : visualLines <= 12 ? 13 : visualLines <= 17 ? 11 : 10;
    // Select the same tier as Lob, then scale down proportionally to the preview card size.
    // Lob renders at LOB_RENDER_WIDTH; our preview is CARD_W — shrink everything by that ratio.
    const lobFontSize = Math.min(byChars, byLines, byVisual);
    return Math.max(6, Math.round(lobFontSize * LOB_SCALE));
  }, [message]);

  const previewMaxLines = messageFontSize > 0
    ? Math.floor((CARD_H - MSG_PAD_VERT * 2) / (messageFontSize * 1.5))
    : undefined;

  if (!photoUri || !recipient) {
    return null;
  }

  const activeFrame = FRAMES.find((f) => f.id === frameId)!;
  const overlay = FILTER_OVERLAYS[filterId];
  const isGrayscale = filterId === 'bw';
  const basePriceStr = `$${(POSTCARD_PRICE_CENTS / 100).toFixed(2)}`;
  const priceStr = taxAmountCents
    ? `${basePriceStr} + $${(taxAmountCents / 100).toFixed(2)} tax`
    : basePriceStr;

  function toggleRejectedInfo() {
    Alert.alert(
      'Why can\'t this image be mailed?',
      'Our mail carrier requires all postcards to meet postal content guidelines. This image was flagged and cannot be physically mailed. Please go back and choose a different photo.',
    );
  }

  async function handleCancelAndRefund() {
    if (sendInProgressRef.current) return;
    sendInProgressRef.current = true;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { error } = await supabase.functions.invoke('request-refund', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          paymentIntentId: paymentIntentIdRef.current,
          testMode: __DEV__,
          errorLog: errorLogRef.current,
        },
      });
      if (error) {
        console.error('[handleCancelAndRefund] error:', error);
        Alert.alert(
          'Refund Failed',
          `We couldn't process your refund automatically. Support has been notified — please also email ${SUPPORT_EMAIL} with your payment ID: ${paymentIntentIdRef.current ?? '(unknown)'}`,
        );
        return;
      }
      // Mark submitted first so the photoUri useEffect doesn't redirect to /postcard
      submittedRef.current = true;
      paymentConfirmedRef.current = false;
      submissionPayloadRef.current = null;
      errorLogRef.current = [];
      reset();
      router.dismissTo('/(tabs)');
      // No alert needed — navigating home is enough confirmation.
    } catch (err: any) {
      console.error('[handleCancelAndRefund] threw:', err);
      Alert.alert('Refund Failed', `Please email ${SUPPORT_EMAIL} for assistance.`);
    } finally {
      sendInProgressRef.current = false;
      setSending(false);
    }
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

    // ── Step 1: Payment ───────────────────────────────────────────────────────
    // Skip if payment was already confirmed on a previous attempt — the Stripe
    // sheet is single-use and calling presentPaymentSheet() again would throw
    // "No payment sheet has been initialized yet."
    if (!paymentConfirmedRef.current) {
      if (!sheetInitializedRef.current) {
        Alert.alert('Not ready', 'Please wait a moment and try again.');
        sendInProgressRef.current = false;
        return;
      }
      setSending(true);
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') {
          Alert.alert('Payment failed', payError.message);
        }
        setSending(false);
        sendInProgressRef.current = false;
        return;
      }
      // Payment confirmed — mark so retries skip this step
      paymentConfirmedRef.current = true;
      sheetInitializedRef.current = false; // sheet is consumed; can't re-use
    }

    setSending(true);

    // ── Step 2: Submit ────────────────────────────────────────────────────────
    // Cache payload on first attempt so retries are bit-for-bit identical,
    // satisfying the edge function's idempotency check.
    if (!submissionPayloadRef.current) {
      submissionPayloadRef.current = {
        imageBase64: lobBase64Ref.current!,
        message,
        location: location ?? null,
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
        testMode: __DEV__,
      };
    }

    const offerRetry = (detail: string) => {
      errorLogRef.current.push(detail);
      console.log('[handleSend] submission failed post-payment (handled):', detail);
      sendInProgressRef.current = false;
      setSending(false);

      // Report every failure to support (fire-and-forget — non-blocking).
      // report-error deduplicates via GitHub Issues so repeated failures add
      // a comment on the existing issue rather than creating a new one.
      supabase.auth.getSession().then(({ data: s }) => {
        supabase.functions.invoke('report-error', {
          headers: { Authorization: `Bearer ${s.session?.access_token}` },
          body: {
            source: 'submit-postcard (client)',
            title: 'Postcard submission failed after payment',
            severity: 'error',
            details: errorLogRef.current.join('\n'),
            userEmail: '',
          },
        }).catch(() => {}); // never block the user on this
      }).catch(() => {});

      Alert.alert(
        'Send Failed',
        'Your payment went through but the postcard couldn\'t be submitted. Tap Retry to try again — you won\'t be charged twice.',
        [
          { text: 'Retry', onPress: () => handleSend() },
          {
            text: 'Cancel & Refund',
            style: 'destructive',
            onPress: () => handleCancelAndRefund(),
          },
        ],
      );
    };

    try {
      const { data: submitData, error: submitError } = await supabase.functions.invoke('submit-postcard', {
        body: submissionPayloadRef.current,
      });

      if (submitError) {
        const status = (submitError as any)?.context?.status ?? 'unknown';
        let body: unknown = null;
        try { body = await (submitError as any)?.context?.json(); } catch {}
        console.error('[submit-postcard] error', { status, message: submitError.message, body });

        if (status === 422 && (body as any)?.code === 'CONTENT_REJECTED') {
          const errorMsg = typeof (body as any)?.error === 'string' ? (body as any).error : 'This image cannot be mailed. Please choose a different photo.';
          Alert.alert('Image rejected', errorMsg);
          setSending(false);
          sendInProgressRef.current = false;
          return;
        }

        const detail = body
          ? (typeof (body as any)?.error === 'string' ? (body as any).error : JSON.stringify(body, null, 2))
          : submitError.message;
        offerRetry(`submit-postcard failed (${status}): ${detail}`);
        return;
      }

      submittedRef.current = true;
      paymentConfirmedRef.current = false;
      submissionPayloadRef.current = null;
      errorLogRef.current = [];
      reset();
      router.dismissTo('/(tabs)');
      if (Platform.OS === 'ios') {
        setTimeout(() => setJustSent(true), 500);
      } else {
        setJustSent(true);
      }
      return; // component unmounts; don't call setSending in finally
    } catch (err: any) {
      offerRetry(err.message ?? 'Unknown error');
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
          style={[
            styles.cardFront,
            { borderWidth: activeFrame.borderWidth, borderColor: activeFrame.borderColor, padding: activeFrame.padding },
          ]}
        >
          <View style={{ position: 'relative', width: CARD_W - activeFrame.borderWidth * 2 - activeFrame.padding * 2, height: CARD_H - activeFrame.borderWidth * 2 - activeFrame.padding * 2 }}>
              <GrayscaleImage uri={photoUri} grayscale={isGrayscale} />
            {overlay && <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay.color, opacity: overlay.opacity }]} />}
            {!!location && (
              <View style={styles.locationBadge}>
                <PinIcon height={11} />
                <Text style={styles.locationBadgeText} numberOfLines={1}>{location}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Back */}
        <Text style={styles.sideLabel}>BACK</Text>
        <View style={styles.cardBack}>
          <View style={styles.backMessage}>
            <Text
              numberOfLines={previewMaxLines}
              style={[styles.backMessageText, { fontSize: messageFontSize, lineHeight: messageFontSize * 1.5 }]}
            >{message}</Text>
          </View>
          <View style={styles.backRight}>
            {/* QR section — mirrors the Lob HTML top table row */}
            <View style={styles.qrSection}>
              <Text style={styles.snapSendText}>SNAP SEND</Text>
              <Image
                source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=222222&bgcolor=ffffff&data=https://snapsend.live' }}
                style={styles.qrImage}
              />
              <Text style={styles.sendJoyText}>Send Joy</Text>
            </View>
            {/* FROM address + POSTAGE INDICIA — Lob overlays postage on printed card */}
            <View style={styles.fromPostageRow}>
              {personalAddress ? (
                <View style={[styles.addressBlock, { flex: 1 }]}>
                  <Text style={styles.fromAddrText}>{personalAddress.full_name}</Text>
                  <Text style={styles.fromAddrText}>{personalAddress.line1}</Text>
                  {personalAddress.line2 ? <Text style={styles.fromAddrText}>{personalAddress.line2}</Text> : null}
                  <Text style={styles.fromAddrText}>{personalAddress.city}, {personalAddress.state} {personalAddress.zip}</Text>
                </View>
              ) : <View style={{ flex: 1 }} />}
              <View style={styles.postageBox}>
                <Text style={styles.postageText}>POSTAGE{'\n'}INDICIA</Text>
              </View>
            </View>
            {/* IMb barcode — added by Lob during printing */}
            <BarcodeRow />
            {/* TO address */}
            <View style={styles.toAddressRow}>
              <View style={styles.addressBlock}>
                <Text style={styles.addrText}>{recipient.full_name}</Text>
                <Text style={styles.addrText}>{recipient.line1}</Text>
                {recipient.line2 ? <Text style={styles.addrText}>{recipient.line2}</Text> : null}
                <Text style={styles.addrText}>{recipient.city}, {recipient.state} {recipient.zip}</Text>
              </View>
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
      width: CARD_W, height: CARD_H,
      backgroundColor: '#fff', borderRadius: 4,
      borderWidth: 1, borderColor: '#E0E0E0',
      flexDirection: 'row', overflow: 'hidden',
    },
    // Lob left cell: width 44%, padding 24px/10px/24px/24px — scaled proportionally.
    backMessage: {
      width: Math.round(CARD_W * 0.44), flexShrink: 0,
      paddingLeft: MSG_PAD_LEFT, paddingRight: MSG_PAD_RIGHT,
      paddingTop: MSG_PAD_VERT, paddingBottom: MSG_PAD_VERT,
    },
    backMessageText: { fontSize: FONT_SIZE.sm, color: '#333' },
    backLocationText: { fontSize: 7, color: '#888', marginTop: 6 },
    locationBadge: {
      // Mirror the server: inset = img.width * 0.040 for both axes.
      // Using CARD_W (the preview card width) gives the same proportional
      // placement as the Lob print so the preview matches what gets mailed.
      position: 'absolute', bottom: Math.round(CARD_W * 0.040), left: Math.round(CARD_W * 0.040),
      backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 100,
      paddingHorizontal: 10, paddingVertical: 6,
      maxWidth: '80%', flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    locationBadgeText: { fontSize: 9, color: '#fff' },
    backRight: { flex: 1 },
    // Lob QR row: padding 28px top, 14px lr, 20px bottom — scaled.
    qrSection: {
      alignItems: 'center',
      paddingTop: Math.round(28 * LOB_SCALE),
      paddingBottom: Math.round(20 * LOB_SCALE),
      paddingHorizontal: Math.round(14 * LOB_SCALE),
    },
    qrImage: { width: QR_SIZE, height: QR_SIZE },
    snapSendText: { fontSize: Math.max(5, Math.round(8 * LOB_SCALE)), fontWeight: '700', color: '#444', letterSpacing: Math.round(2 * LOB_SCALE), textTransform: 'uppercase', marginBottom: Math.round(8 * LOB_SCALE) },
    sendJoyText: { fontSize: Math.max(5, Math.round(8 * LOB_SCALE)), color: '#888', letterSpacing: Math.round(LOB_SCALE), marginTop: Math.round(8 * LOB_SCALE) },
    // Lob FROM row: padding 10px top, 14px lr, 4px bottom — scaled.
    fromPostageRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Math.round(4 * LOB_SCALE),
      paddingTop: Math.round(10 * LOB_SCALE), paddingBottom: Math.round(4 * LOB_SCALE),
      paddingHorizontal: Math.round(14 * LOB_SCALE),
    },
    postageBox: { width: Math.round(46 * LOB_SCALE), borderWidth: 1, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center', paddingVertical: Math.round(4 * LOB_SCALE), paddingHorizontal: 2, borderRadius: 1 },
    postageText: { fontSize: Math.max(5, Math.round(7 * LOB_SCALE)), color: '#777', textAlign: 'center', fontWeight: '600', lineHeight: Math.max(7, Math.round(10 * LOB_SCALE)) },
    addressBlock: { gap: 1 },
    // FROM address: Lob HTML uses 7px — scale down.
    fromAddrText: { fontSize: Math.max(5, Math.round(7 * LOB_SCALE)), color: '#555', lineHeight: Math.max(7, Math.round(11 * LOB_SCALE)), textTransform: 'uppercase' },
    // TO (delivery) address: Lob uses USPS standard ~20px — scale to preview.
    // Lob TO row: padding 4px top, 14px lr, 10px bottom — scaled.
    toAddressRow: {
      paddingTop: Math.round(4 * LOB_SCALE), paddingBottom: Math.round(10 * LOB_SCALE),
      paddingHorizontal: Math.round(14 * LOB_SCALE),
    },
    addrText: { fontSize: Math.max(8, Math.round(20 * LOB_SCALE)), color: '#555', lineHeight: Math.max(11, Math.round(28 * LOB_SCALE)), textTransform: 'uppercase' },
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
