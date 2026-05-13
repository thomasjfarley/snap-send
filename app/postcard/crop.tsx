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
const CROP_W = SCREEN_W - SPACING.xl * 2;
const CROP_H = CROP_W * (3 / 4); // 4:3 aspect ratio

export default function CropScreen() {
  const router = useRouter();
  const { photoUri, setPhoto } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
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

  // Scale to fill the crop frame (cover behaviour)
  const coverScale = imgSize ? Math.max(CROP_W / imgSize.w, CROP_H / imgSize.h) : 1;
  const displayedW = imgSize ? Math.round(imgSize.w * coverScale) : CROP_W;
  const displayedH = imgSize ? Math.round(imgSize.h * coverScale) : CROP_H;

  // Center the scroll when we first know the image size
  useEffect(() => {
    if (!imgSize) return;
    const ix = Math.max(0, (displayedW - CROP_W) / 2);
    const iy = Math.max(0, (displayedH - CROP_H) / 2);
    scrollState.current = { x: ix, y: iy, zoomScale: 1 };
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: ix, y: iy, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [imgSize, displayedW, displayedH]);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, zoomScale } = e.nativeEvent;
    scrollState.current = {
      x: contentOffset.x,
      y: contentOffset.y,
      zoomScale: zoomScale ?? 1,
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imgSize || isCropping || !photoUri) return;
    setIsCropping(true);
    try {
      const { x, y, zoomScale } = scrollState.current;

      // totalScale maps original image pixels → displayed pixels at current zoom
      const totalScale = coverScale * zoomScale;

      const originX = Math.max(0, Math.round(x / totalScale));
      const originY = Math.max(0, Math.round(y / totalScale));
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
  }, [imgSize, isCropping, photoUri, coverScale, setPhoto, router]);

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

      <View style={styles.body}>
        <View style={styles.cropFrame}>
          <ScrollView
            ref={scrollRef}
            style={{ width: CROP_W, height: CROP_H }}
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

          {/* Corner bracket markers — non-interactive */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

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
    container: { flex: 1, backgroundColor: '#111' },
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
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cropFrame: {
      width: CROP_W,
      height: CROP_H,
      overflow: 'hidden',
    },
    corner: {
      position: 'absolute',
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderColor: '#fff',
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    hintArea: { paddingVertical: SPACING.md, alignItems: 'center' },
    hintText: { color: '#888', fontSize: FONT_SIZE.xs },
  });
}
