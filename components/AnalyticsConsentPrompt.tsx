import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAnalyticsStore } from '@/store/analytics.store';
import { requiresAnalyticsConsent } from '@/lib/consent-region';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

// Shown once to users in regions that require opt-in consent (EU/EEA/UK/CH).
// Accept and Decline are deliberately equal in prominence.
export function AnalyticsConsentPrompt() {
  const router = useRouter();
  const { colors } = useTheme();
  const hydrated = useAnalyticsStore((s) => s.hydrated);
  const choice = useAnalyticsStore((s) => s.choice);
  const setChoice = useAnalyticsStore((s) => s.setChoice);

  const visible = hydrated && choice === null && requiresAnalyticsConsent();

  const button = {
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: colors.primary,
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.xl }}>
        <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: SPACING.xl, gap: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.textPrimary }}>
            Help us improve Snap Send
          </Text>
          <Text style={{ fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 }}>
            May we collect anonymous usage analytics using Google Analytics for Firebase, such as
            which screens you view and whether you complete a postcard? This is optional. You can
            change your choice any time in Settings → Privacy.
          </Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={{ fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '600' }}>
              Read our Privacy Policy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={button} onPress={() => setChoice(true)}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: FONT_SIZE.md }}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={button} onPress={() => setChoice(false)}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: FONT_SIZE.md }}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
