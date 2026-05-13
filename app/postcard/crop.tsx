import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
// The 4:3 crop window is inset horizontally by SPACING.xl on each side
const CROP_LEFT = SPACING.xl;
const CROP_W = SCREEN_W - CROP_LEFT * 2;
const CROP_H = CROP_W * (3 / 4);

export default function CropScreen() {
  const router = useRouter();
  const { photoUri, setPhoto } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [isCropping, setIsCropping] = useState(false);

  // Track scroll position and zoom scale for crop math
  const scrollState = useRef({ x: 0, y: 0, zoomScale: 1 });

  useEffect(() => {
    if (!photoUri) return;
    Image.getSize(
      photoUri,
      (w, h) => setImgSize({ w, h }),
      (err) => console.warn('[Crop] getSize error', err),
    );
  }, [photoUri]);

  // Cover scale fills the FULL viewport (SCREEN_W × bodyHeight) so the image
  // is always larger than the viewport and scrollable in all directions.
  const coverScale =
    imgSize && bodyHeight > 0
      ? Math.max(SCREEN_W / imgSize.w, bodyHeight / imgSize.h)
      : 1;
  const displayedW = imgSize ? Math.round(imgSize.w * coverScale) : SCREEN_W;
  const displayedH = imgSize && bodyHeight > 0 ? Math.round(imgSize.h * coverScale) : bodyHeight || SCREEN_W;

  // The crop window sits in the vertical center of the body
  const cropTop = bodyHeight > 0 ? (bodyHeight - CROP_H) / 2 : 0;
  const cropBottom = bodyHeight > 0 ? bodyHeight - cropTop - CROP_H : 0;

  // Center the image on the viewport (and therefore the crop window) on first load
  useEffect(() => {
    if (!imgSize || bodyHeight === 0) return;
    // Put the image center at the viewport center
    const ix = Math.max(0, displayedW / 2 - SCREEN_W / 2);
    const iy = Math.max(0, displayedH / 2 - bodyHeight / 2);
    scrollState.current = { x: ix, y: iy, zoomScale: 1 };
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: ix, y: iy, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [imgSize, bodyHeight, displayedW, displayedH]);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, zoomScale } = e.nativeEvent;
    scrollState.current = {
      x: contentOffset.x,
      y: contentOffset.y,
      zoomScale: zoomScale ?? 1,
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imgSize || isCropping || !photoUri || bodyHeight === 0) return;
    setIsCropping(true);
    try {
      const { x, y, zoomScale } = scrollState.current;

      // totalScale maps original image pixels → displayed pixels at the current zoom level
      const totalScale = coverScale * zoomScale;

      // The crop window's top-left corner in content (image) space:
      // scroll offset positions the viewport's top-left over the content,
      // and the crop window is inset CROP_LEFT from left and cropTop from top within the viewport.
      const contentX = x + CROP_LEFT;
      const contentY = y + cropTop;

      const originX = Math.max(0, Math.round(contentX / totalScale));
      const originY = Math.max(0, Math.round(contentY / totalScale));
      const cropW = Math.min(Math.round(CROP_W / totalScale), imgSize.w - originX);
      const cropH = Math.min(Math.round(CROP_H / totalScale), imgSize.h - originY);

      const cropped = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );

      setPhoto(cropped.uri);
      // Replace crop in the stack so back from editor goes to the chooser
      router.replace('/postcard/editor');
    } catch (err) {
      console.warn('[Crop] crop failed, using original photo:', err);
      router.replace('/postcard/editor');
    } finally {
      setIsCropping(false);
    }
  }, [imgSize, isCropping, photoUri, coverScale, bodyHeight, cropTop, setPhoto, router]);

  if (!photoUri) {
    router.replace('/postcard');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Crop Photo</Text>
        <TouchableOpacity
          onPress={handleConfirm}
          style={styles.headerBtn}
          disabled={isCropping || !imgSize}
        >
          {isCropping ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.useText, { color: colors.primary }]}>Use</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
        {/* Full-body scrollable image — the user pans/pinches across the whole area */}
        <ScrollView
          ref={scrollRef}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ width: displayedW, height: displayedH }}
          maximumZoomScale={5}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollEndDrag={handleScroll}
          onMomentumScrollEnd={handleScroll}
          bouncesZoom={false}
          pinchGestureEnabled
        >
          <Image
            source={{ uri: photoUri }}
            style={{ width: displayedW, height: displayedH }}
            resizeMode="cover"
          />
        </ScrollView>

        {/* Dimming strips + corner markers — sit on top, non-interactive */}
        {bodyHeight > 0 && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Top */}
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: cropTop }]} />
            {/* Bottom */}
            <View style={[styles.dim, { bottom: 0, left: 0, right: 0, height: cropBottom }]} />
            {/* Left */}
            <View style={[styles.dim, { top: cropTop, left: 0, width: CROP_LEFT, height: CROP_H }]} />
            {/* Right */}
            <View style={[styles.dim, { top: cropTop, right: 0, width: CROP_LEFT, height: CROP_H }]} />

            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL, { top: cropTop, left: CROP_LEFT }]} />
            <View style={[styles.corner, styles.cornerTR, { top: cropTop, right: CROP_LEFT }]} />
            <View style={[styles.corner, styles.cornerBL, { bottom: cropBottom, left: CROP_LEFT }]} />
            <View style={[styles.corner, styles.cornerBR, { bottom: cropBottom, right: CROP_LEFT }]} />
          </View>
        )}

        {!imgSize && (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            size="large"
            color="#fff"
            pointerEvents="none"
          />
        )}
      </View>

      <View style={styles.hintArea}>
        <Text style={styles.hintText}>Pinch to zoom · Drag to reposition</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  const CORNER_SIZE = 22;
  const CORNER_THICKNESS = 3;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    headerBtn: { minWidth: 60 },
    cancelText: { fontSize: FONT_SIZE.md, color: '#ccc' },
    useText: { fontSize: FONT_SIZE.md, fontWeight: '700', textAlign: 'right' },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: '#fff' },
    body: { flex: 1 },
    dim: {
      position: 'absolute',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    corner: {
      position: 'absolute',
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderColor: '#fff',
    },
    cornerTL: { borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    cornerTR: { borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    cornerBL: { borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    cornerBR: { borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    hintArea: { paddingVertical: SPACING.md, alignItems: 'center' },
    hintText: { color: '#888', fontSize: FONT_SIZE.xs },
  });
}
