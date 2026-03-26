import React, { useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostcardStore } from '@/store/postcard.store';
import { FILTERS, FRAMES } from '@/constants/editor';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

const FILTER_OVERLAYS: Record<string, { color: string; opacity: number } | null> = {
  none: null,
  warm: { color: 'rgba(255,140,0,1)', opacity: 0.18 },
  cool: { color: 'rgba(100,149,237,1)', opacity: 0.2 },
  bw:   { color: 'rgba(0,0,0,1)', opacity: 0.0 },
  fade: { color: 'rgba(255,255,255,1)', opacity: 0.25 },
  vivid:{ color: 'rgba(180,0,180,1)', opacity: 0.08 },
};

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_W = SCREEN_W - SPACING.xl * 2;
const PHOTO_H = PHOTO_W * (3 / 4);

export default function EditorScreen() {
  const router = useRouter();
  const { photoUri, filterId, frameId, setFilter, setFrame } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!photoUri) {
    router.replace('/postcard');
    return null;
  }

  const activeFrame = FRAMES.find((f) => f.id === frameId)!;
  const overlay = FILTER_OVERLAYS[filterId];
  const isGrayscale = filterId === 'bw';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Photo</Text>
        <TouchableOpacity onPress={() => router.push('/postcard/message')}>
          <Text style={[styles.navText, { color: colors.primary, fontWeight: '700' }]}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Photo Preview */}
      <View style={styles.photoArea}>
        <View style={[
          styles.photoFrame,
          {
            borderWidth: activeFrame.borderWidth,
            borderColor: activeFrame.borderColor,
            padding: activeFrame.padding,
          }
        ]}>
          <View style={{ position: 'relative', width: PHOTO_W - activeFrame.borderWidth * 2 - activeFrame.padding * 2, height: PHOTO_H - activeFrame.borderWidth * 2 - activeFrame.padding * 2 }}>
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {isGrayscale && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(128,128,128,0.55)' }]} />
            )}
            {overlay && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay.color, opacity: overlay.opacity }]} />
            )}
          </View>
        </View>
      </View>

      {/* Filter Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Filter</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          {FILTERS.map((f) => {
            const ov = FILTER_OVERLAYS[f.id];
            const selected = filterId === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.thumbnail, selected && styles.thumbnailSelected]}
                onPress={() => setFilter(f.id)}
              >
                <View style={styles.thumbImg}>
                  <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {ov && <View style={[StyleSheet.absoluteFill, { backgroundColor: ov.color, opacity: ov.opacity }]} />}
                  {f.id === 'bw' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(128,128,128,0.55)' }]} />}
                </View>
                <Text style={[styles.thumbLabel, selected && { color: colors.primary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Frame Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Frame</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          {FRAMES.map((fr) => {
            const selected = frameId === fr.id;
            return (
              <TouchableOpacity
                key={fr.id}
                style={[styles.thumbnail, selected && styles.thumbnailSelected]}
                onPress={() => setFrame(fr.id)}
              >
                <View style={[styles.thumbImg, { borderWidth: fr.borderWidth > 0 ? 4 : 0, borderColor: fr.borderColor, backgroundColor: fr.borderColor || '#eee' }]}>
                  <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFill, { margin: fr.borderWidth > 0 ? 4 : 0 }]} resizeMode="cover" />
                </View>
                <Text style={[styles.thumbLabel, selected && { color: colors.primary }]}>{fr.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});  // replaced by makeStyles below

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },  // dark canvas — intentional for photo editing
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    },
    navText: { fontSize: FONT_SIZE.md, color: '#ccc' },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: '#fff' },
    photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
    photoFrame: { backgroundColor: '#000', overflow: 'hidden' },
    section: { paddingBottom: SPACING.md },
    sectionLabel: { color: '#aaa', fontSize: FONT_SIZE.xs, fontWeight: '600', paddingHorizontal: SPACING.xl, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 1 },
    scrollRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
    thumbnail: { alignItems: 'center', gap: 4, opacity: 0.7 },
    thumbnailSelected: { opacity: 1 },
    thumbImg: { width: 56, height: 42, borderRadius: 6, overflow: 'hidden', backgroundColor: '#333' },
    thumbLabel: { fontSize: 10, color: '#aaa', fontWeight: '500' },
  });
}
