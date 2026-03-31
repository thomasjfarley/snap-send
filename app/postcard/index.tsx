import React, { useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PostcardPhotoScreen() {
  const router = useRouter();
  const { photoUri, setPhoto, reset, setOpenedFromChooser } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isProcessing, setIsProcessing] = useState(false);
  const isHandingOffToEditor = isProcessing;

  const prevPhotoRef = useRef<string | null>(null);

  React.useEffect(() => {
    if (!isProcessing || !photoUri) {
      if (!photoUri) prevPhotoRef.current = null;
      return;
    }
    // Only navigate when photoUri changed from null -> value to avoid reacting to resets
    if (prevPhotoRef.current === photoUri) return;
    prevPhotoRef.current = photoUri;

    console.log('[Chooser] handoff — ensuring chooser then pushing editor for', photoUri);
    (async () => {
      try {
        // Ensure chooser exists in the stack: replace current route with chooser so next push places editor above it
        try {
          await router.replace('/postcard');
        } catch (err) {
          console.warn('[Chooser] replace to chooser failed (may already be on chooser)', err);
        }
        await router.push('/postcard/editor');
      } catch (err) {
        console.warn('[Chooser] push to editor failed', err);
      }
      // Clear processing state after navigation so chooser becomes interactive again when user returns.
      setIsProcessing(false);
    })();
  }, [isProcessing, photoUri, router, setIsProcessing]);

  async function pickFromLibrary() {
    if (isProcessing) return;
    reset();
    setOpenedFromChooser(true);
    setIsProcessing(true);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setIsProcessing(false);
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      return;
    }
    setIsProcessing(false);
  }

  async function takePhoto() {
    if (isProcessing) return;
    reset();
    setOpenedFromChooser(true);
    setIsProcessing(true);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setIsProcessing(false);
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      // Save original (unedited) photo to the device camera roll.
      // Permission denial is non-fatal — the app continues normally.
      try {
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        if (mediaStatus === 'granted') {
          await MediaLibrary.saveToLibraryAsync(result.assets[0].uri);
        }
      } catch (err) {
        // non-fatal
      }
      setPhoto(result.assets[0].uri);
      return;
    }
    setIsProcessing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Postcard</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>Choose a photo for your postcard</Text>

        <TouchableOpacity style={styles.optionBtn} onPress={takePhoto} disabled={isHandingOffToEditor}>
          <Text style={styles.optionEmoji}>📷</Text>
          <Text style={styles.optionLabel}>Take Photo</Text>
          <Text style={styles.optionSub}>Use your camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBtn} onPress={pickFromLibrary} disabled={isHandingOffToEditor}>
          <Text style={styles.optionEmoji}>🖼️</Text>
          <Text style={styles.optionLabel}>Choose from Library</Text>
          <Text style={styles.optionSub}>Pick an existing photo</Text>
        </TouchableOpacity>
      </View>

      {isHandingOffToEditor && (
        <View style={styles.blockingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
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
    closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 18, color: colors.textSecondary },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    body: { flex: 1, padding: SPACING.xl, gap: SPACING.md, justifyContent: 'center' },
    subtitle: { fontSize: FONT_SIZE.md, color: colors.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
    optionBtn: {
      backgroundColor: colors.surface, borderRadius: 20, padding: SPACING.xl,
      alignItems: 'center', gap: SPACING.xs, borderWidth: 1, borderColor: colors.border,
    },
    blockingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    optionEmoji: { fontSize: 48 },
    optionLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    optionSub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  });
}
