export type AppColors = typeof LIGHT_COLORS;

export const LIGHT_COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
};

export const DARK_COLORS: AppColors = {
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  background: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
};

/** Static fallback — prefer useTheme() inside components */
export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const POSTCARD_ASPECT_RATIO = 6 / 4; // landscape 6x4 inches
