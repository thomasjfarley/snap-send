import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { usePostcardStore } from '@/store/postcard.store';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PostcardPhotoScreen() {
  const router = useRouter();
  const { setPhoto, reset } = usePostcardStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  React.useEffect(() => { reset(); }, []);

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      router.push('/postcard/editor');
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      router.push('/postcard/editor');
    }
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

        <TouchableOpacity style={styles.optionBtn} onPress={takePhoto}>
          <Text style={styles.optionEmoji}>📷</Text>
          <Text style={styles.optionLabel}>Take Photo</Text>
          <Text style={styles.optionSub}>Use your camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBtn} onPress={pickFromLibrary}>
          <Text style={styles.optionEmoji}>🖼️</Text>
          <Text style={styles.optionLabel}>Choose from Library</Text>
          <Text style={styles.optionSub}>Pick an existing photo</Text>
        </TouchableOpacity>
      </View>
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
    optionEmoji: { fontSize: 48 },
    optionLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary },
    optionSub: { fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  });
}
