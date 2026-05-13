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

export default function CropScreen() {
  const router = useRouter();
  const { photoUri, setPhoto } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [isCropping, setIsCropping] = useState(false);

  const scrollState = useRef({ x: 0, y: 0, zoomScale: 1 });

  useEffect(() => {
    if (!photoUri) return;
    Image.getSize(
      photoUri,
      (w, h) => setImgSize({ w, h }),
      (err) => console.warn('[Crop] getSize error', err),
    );
  }, [photoUri]);

  // Contain scale: shrink the image to fit entirely within the body (both axes visible).
  const displayScale =
    imgSize && bodyHeight > 0
      ? Math.min(SCREEN_W / imgSize.w, bodyHeight / imgSize.h)
      : 1;
  const displayedW = imgSize ? Math.round(imgSize.w * displayScale) : SCREEN_W;
  const displayedH = imgSize && bodyHeight > 0 ? Math.round(imgSize.h * displayScale) : bodyHeight || SCREEN_W;

  // Dynamic 4:3 crop box: the largest 4:3 rectangle that fits within the displayed image.
  const cropBoxW = Math.min(displayedW, Math.round(displayedH * 4 / 3));
  const cropBoxH = Math.round(cropBoxW * 3 / 4);
  // Crop box is centered in the viewport (fixed overlay position).
  const cropBoxLeft = Math.round((SCREEN_W - cropBoxW) / 2);
  const cropBoxTop = bodyHeight > 0 ? Math.round((bodyHeight - cropBoxH) / 2) : 0;
  const cropBoxBottom = bodyHeight > 0 ? bodyHeight - cropBoxTop - cropBoxH : 0;

  // The image's top-left is anchored at the crop box top-left in content space.
  // This means at scroll (0,0) the image top-left lines up with the crop box top-left.
  const imgOffsetX = cropBoxLeft;
  const imgOffsetY = cropBoxTop;

  // Content is larger than the viewport by exactly the amount the image overflows the crop
  // box. This gives the user a scroll range that lets them pan from image-start to image-end
  // within the crop box. At zoom=1, content = viewport when the image exactly fits (4:3 photo).
  const contentW = SCREEN_W + Math.max(0, displayedW - cropBoxW);
  const contentH = bodyHeight > 0 ? bodyHeight + Math.max(0, displayedH - cropBoxH) : 0;

  // Initial scroll centers the image inside the crop box.
  useEffect(() => {
    if (!imgSize || bodyHeight === 0) return;
    const ix = Math.max(0, Math.round((displayedW - cropBoxW) / 2));
    const iy = Math.max(0, Math.round((displayedH - cropBoxH) / 2));
    scrollState.current = { x: ix, y: iy, zoomScale: 1 };
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: ix, y: iy, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [imgSize, bodyHeight, displayedW, displayedH, cropBoxW, cropBoxH]);

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
      const { x, y, zoomScale: z } = scrollState.current;

      // contentOffset is in zoomed-content coordinates; dividing by z converts to original
      // content coordinates. Subtracting the image's offset within the content view gives
      // the pixel position within the image. Dividing by displayScale gives original pixels.
      const originX = Math.max(0, Math.round(((x + cropBoxLeft) / z - imgOffsetX) / displayScale));
      const originY = Math.max(0, Math.round(((y + cropBoxTop) / z - imgOffsetY) / displayScale));
      const cropW = Math.min(Math.round(cropBoxW / (displayScale * z)), imgSize.w - originX);
      const cropH = Math.min(Math.round(cropBoxH / (displayScale * z)), imgSize.h - originY);

      const cropped = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );

      setPhoto(cropped.uri);
      router.replace('/postcard/editor');
    } catch (err) {
      console.warn('[Crop] crop failed, using original photo:', err);
      router.replace('/postcard/editor');
    } finally {
      setIsCropping(false);
    }
  }, [imgSize, isCropping, photoUri, displayScale, bodyHeight,
      imgOffsetX, imgOffsetY, cropBoxLeft, cropBoxTop, cropBoxW, cropBoxH,
      setPhoto, router]);

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
        {/* Full-body scrollable image. Content is wider/taller than the viewport by the
            amount the image overflows the crop box, so the user can pan to any part of
            the image. At zoom=1 a 4:3 photo exactly fills the crop and nothing scrolls. */}
        {bodyHeight > 0 && (
          <ScrollView
            ref={scrollRef}
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{ width: contentW, height: contentH }}
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
            <View style={{ width: contentW, height: contentH }}>
              <Image
                source={{ uri: photoUri }}
                style={{
                  position: 'absolute',
                  left: imgOffsetX,
                  top: imgOffsetY,
                  width: displayedW,
                  height: displayedH,
                }}
                resizeMode="cover"
              />
            </View>
          </ScrollView>
        )}

        {/* Dimming strips + corner brackets — non-interactive overlay */}
        {bodyHeight > 0 && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Top */}
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: cropBoxTop }]} />
            {/* Bottom */}
            <View style={[styles.dim, { bottom: 0, left: 0, right: 0, height: cropBoxBottom }]} />
            {/* Left */}
            <View style={[styles.dim, { top: cropBoxTop, left: 0, width: cropBoxLeft, height: cropBoxH }]} />
            {/* Right */}
            <View style={[styles.dim, { top: cropBoxTop, right: 0, width: cropBoxLeft, height: cropBoxH }]} />

            <View style={[styles.corner, styles.cornerTL, { top: cropBoxTop, left: cropBoxLeft }]} />
            <View style={[styles.corner, styles.cornerTR, { top: cropBoxTop, right: cropBoxLeft }]} />
            <View style={[styles.corner, styles.cornerBL, { bottom: cropBoxBottom, left: cropBoxLeft }]} />
            <View style={[styles.corner, styles.cornerBR, { bottom: cropBoxBottom, right: cropBoxLeft }]} />
          </View>
        )}

        {(!imgSize || bodyHeight === 0) && (
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
