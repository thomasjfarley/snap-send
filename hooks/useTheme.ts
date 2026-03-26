import { useColorScheme } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS, type AppColors } from '@/constants/theme';
import { useThemeStore } from '@/store/theme.store';

export function useTheme(): { colors: AppColors; isDark: boolean } {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark');

  return { colors: isDark ? DARK_COLORS : LIGHT_COLORS, isDark };
}
