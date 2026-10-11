import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, SPACING, type AppColors } from '@/constants/theme';
import { getRequiredUpdate, type RequiredUpdate } from '@/lib/app-version';

interface RequiredUpdateGateProps {
  children: ReactNode;
}

export function RequiredUpdateGate({ children }: RequiredUpdateGateProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [initialized, setInitialized] = useState(Platform.OS === 'web');
  const [checking, setChecking] = useState(false);
  const [requiredUpdate, setRequiredUpdate] = useState<RequiredUpdate | null>(null);

  const checkForUpdate = useCallback(async (showLoading: boolean) => {
    if (Platform.OS === 'web') return;
    if (showLoading) setChecking(true);

    try {
      setRequiredUpdate(await getRequiredUpdate());
    } catch (error) {
      console.error('Failed to check for a required app update', error);
    } finally {
      setInitialized(true);
      if (showLoading) setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkForUpdate(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkForUpdate(false);
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  async function openStore() {
    if (!requiredUpdate) return;
    try {
      await Linking.openURL(requiredUpdate.storeUrl);
    } catch {
      Alert.alert(
        'Could not open the store',
        'Please open the App Store or Google Play and update Snap Send.',
      );
    }
  }

  if (!initialized || checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (requiredUpdate) {
    return (
      <View style={styles.container}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>↑</Text>
        </View>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.message}>{requiredUpdate.message}</Text>
        <Text style={styles.version}>
          Installed: {requiredUpdate.currentVersion} ({requiredUpdate.currentBuildNumber}) · Required:{' '}
          {requiredUpdate.minimumVersion} ({requiredUpdate.minimumBuildNumber})
        </Text>
        <TouchableOpacity style={styles.button} onPress={openStore}>
          <Text style={styles.buttonText}>
            Update in {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryButton} onPress={() => checkForUpdate(true)}>
          <Text style={styles.retryText}>I’ve updated — check again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      padding: SPACING.xl,
    },
    icon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      marginBottom: SPACING.lg,
    },
    iconText: {
      color: colors.primary,
      fontSize: 40,
      fontWeight: '700',
      lineHeight: 46,
    },
    title: {
      color: colors.textPrimary,
      fontSize: FONT_SIZE.xxl,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    message: {
      color: colors.textSecondary,
      fontSize: FONT_SIZE.md,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: SPACING.md,
    },
    version: {
      color: colors.textSecondary,
      fontSize: FONT_SIZE.xs,
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
    button: {
      alignSelf: 'stretch',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: SPACING.md,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
    },
    retryButton: {
      padding: SPACING.md,
      marginTop: SPACING.xs,
    },
    retryText: {
      color: colors.primary,
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
    },
  });
}
