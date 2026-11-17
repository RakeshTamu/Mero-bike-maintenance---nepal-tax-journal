import { AppTheme } from '../types';

export interface ThemeTokens {
  bg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentSubtle: string;
  accentGlow: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  isDark: boolean;
}

export interface ThemeConfig {
  id: AppTheme;
  nameEn: string;
  nameNe: string;
  badge: string;
  tokens: ThemeTokens;
  // Semantic token-backed Tailwind classes (safe across all 6 themes)
  bgClass: string;
  surfaceClass: string;
  surfaceMutedClass: string;
  borderClass: string;
  accentTextClass: string;
  accentBgClass: string;
  accentGlow: string;
  primaryColorHex: string;
  previewColor: string;
}

export const THEMES: { [key in AppTheme]: ThemeConfig } = {
  oled: {
    id: 'oled',
    nameEn: 'Dark Clay (OLED)',
    nameNe: 'डार्क क्ले (डिफल्ट)',
    badge: 'Clay Dark',
    tokens: {
      bg: '#101214',
      surface1: '#1C2024',
      surface2: '#252B30',
      surface3: '#2D343B',
      accent: '#22B8CF',
      accentHover: '#1CA3B8',
      accentFg: '#071316',
      accentSubtle: 'rgba(34, 184, 207, 0.14)',
      accentGlow: 'rgba(34, 184, 207, 0.20)',
      textPrimary: '#F2F4F5',
      textSecondary: '#929BA3',
      border: '#30383E',
      success: '#10B981',
      successSubtle: 'rgba(16, 185, 129, 0.14)',
      warning: '#F59E0B',
      warningSubtle: 'rgba(245, 158, 11, 0.14)',
      error: '#EF4444',
      errorSubtle: 'rgba(239, 68, 68, 0.14)',
      isDark: true
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#22B8CF',
    previewColor: '#22B8CF'
  },
  racing_amber: {
    id: 'racing_amber',
    nameEn: 'Racing Amber & Orange',
    nameNe: 'रेसिङ ओरेन्ज (केटीएम)',
    badge: 'Amber',
    tokens: {
      bg: '#080705',
      surface1: '#14110B',
      surface2: '#1B160E',
      surface3: '#241D13',
      accent: '#F59E0B',
      accentHover: '#D97706',
      accentFg: '#000000',
      accentSubtle: 'rgba(245, 158, 11, 0.14)',
      accentGlow: 'rgba(245, 158, 11, 0.24)',
      textPrimary: '#FFFBEB',
      textSecondary: '#C4B59A',
      border: '#332818',
      success: '#00C995',
      successSubtle: 'rgba(0, 201, 149, 0.14)',
      warning: '#FFC94A',
      warningSubtle: 'rgba(255, 201, 74, 0.14)',
      error: '#FF626D',
      errorSubtle: 'rgba(255, 98, 109, 0.14)',
      isDark: true
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#F59E0B',
    previewColor: '#F97316'
  },
  cyber_violet: {
    id: 'cyber_violet',
    nameEn: 'Cyber Neon Violet',
    nameNe: 'साइबर भायोलेट',
    badge: 'Violet',
    tokens: {
      bg: '#06040C',
      surface1: '#100C1E',
      surface2: '#161128',
      surface3: '#1F1836',
      accent: '#B975FF',
      accentHover: '#A855F7',
      accentFg: '#06040C',
      accentSubtle: 'rgba(185, 117, 255, 0.14)',
      accentGlow: 'rgba(185, 117, 255, 0.24)',
      textPrimary: '#F7F3FF',
      textSecondary: '#B5A7CE',
      border: '#2E214D',
      success: '#00C995',
      successSubtle: 'rgba(0, 201, 149, 0.14)',
      warning: '#FFC94A',
      warningSubtle: 'rgba(255, 201, 74, 0.14)',
      error: '#FF626D',
      errorSubtle: 'rgba(255, 98, 109, 0.14)',
      isDark: true
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#B975FF',
    previewColor: '#C084FC'
  },
  emerald: {
    id: 'emerald',
    nameEn: 'Himalayan Jade',
    nameNe: 'हिमाली जेड हरियो',
    badge: 'Jade',
    tokens: {
      bg: '#020906',
      surface1: '#081710',
      surface2: '#0D2118',
      surface3: '#132D21',
      accent: '#10D48E',
      accentHover: '#0AB97B',
      accentFg: '#020906',
      accentSubtle: 'rgba(16, 212, 142, 0.14)',
      accentGlow: 'rgba(16, 212, 142, 0.24)',
      textPrimary: '#ECFDF5',
      textSecondary: '#94B8A8',
      border: '#193C2B',
      success: '#00C995',
      successSubtle: 'rgba(0, 201, 149, 0.14)',
      warning: '#FFC94A',
      warningSubtle: 'rgba(255, 201, 74, 0.14)',
      error: '#FF626D',
      errorSubtle: 'rgba(255, 98, 109, 0.14)',
      isDark: true
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#10D48E',
    previewColor: '#10B981'
  },
  slate_dark: {
    id: 'slate_dark',
    nameEn: 'Midnight Slate',
    nameNe: 'मिडनाइट स्लेट',
    badge: 'Slate',
    tokens: {
      bg: '#0B111A',
      surface1: '#121B28',
      surface2: '#182434',
      surface3: '#202E42',
      accent: '#38BDF8',
      accentHover: '#0EA5E9',
      accentFg: '#081018',
      accentSubtle: 'rgba(56, 189, 248, 0.14)',
      accentGlow: 'rgba(56, 189, 248, 0.24)',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      border: '#28384D',
      success: '#10B981',
      successSubtle: 'rgba(16, 185, 129, 0.14)',
      warning: '#FBBF24',
      warningSubtle: 'rgba(251, 191, 36, 0.14)',
      error: '#F87171',
      errorSubtle: 'rgba(248, 113, 113, 0.14)',
      isDark: true
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#38BDF8',
    previewColor: '#38BDF8'
  },
  light: {
    id: 'light',
    nameEn: 'Daylight Sunshine',
    nameNe: 'डे-लाइट (घाममा हेर्न)',
    badge: 'Daylight',
    tokens: {
      bg: '#F3F6FA',
      surface1: '#FFFFFF',
      surface2: '#EEF2F7',
      surface3: '#E2E8F0',
      accent: '#0284C7',
      accentHover: '#0369A1',
      accentFg: '#FFFFFF',
      accentSubtle: 'rgba(2, 132, 199, 0.10)',
      accentGlow: 'rgba(2, 132, 199, 0.20)',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      border: '#CBD5E1',
      success: '#059669',
      successSubtle: 'rgba(5, 150, 105, 0.12)',
      warning: '#D97706',
      warningSubtle: 'rgba(217, 119, 6, 0.12)',
      error: '#DC2626',
      errorSubtle: 'rgba(220, 38, 38, 0.12)',
      isDark: false
    },
    bgClass: 'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
    surfaceClass: 'bg-[var(--color-surface-1)] border-[var(--color-border)]',
    surfaceMutedClass: 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
    borderClass: 'border-[var(--color-border)]',
    accentTextClass: 'text-[var(--color-accent)]',
    accentBgClass: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] font-semibold',
    accentGlow: 'shadow-none',
    primaryColorHex: '#0284C7',
    previewColor: '#0284C7'
  }
};

export function applyThemeTokens(themeId: AppTheme = 'oled'): ThemeConfig {
  const theme = THEMES[themeId] || THEMES.oled;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const t = theme.tokens;
    root.style.setProperty('--color-bg', t.bg);
    root.style.setProperty('--color-surface-1', t.surface1);
    root.style.setProperty('--color-surface-2', t.surface2);
    root.style.setProperty('--color-surface-3', t.surface3);
    root.style.setProperty('--color-accent', t.accent);
    root.style.setProperty('--color-accent-hover', t.accentHover);
    root.style.setProperty('--color-accent-fg', t.accentFg);
    root.style.setProperty('--color-accent-subtle', t.accentSubtle);
    root.style.setProperty('--color-accent-glow', t.accentGlow);
    root.style.setProperty('--color-text-primary', t.textPrimary);
    root.style.setProperty('--color-text-secondary', t.textSecondary);
    root.style.setProperty('--color-border', t.border);
    root.style.setProperty('--color-success', t.success);
    root.style.setProperty('--color-success-subtle', t.successSubtle);
    root.style.setProperty('--color-warning', t.warning);
    root.style.setProperty('--color-warning-subtle', t.warningSubtle);
    root.style.setProperty('--color-error', t.error);
    root.style.setProperty('--color-error-subtle', t.errorSubtle);

    root.classList.toggle('dark', t.isDark);
    root.setAttribute('data-theme', theme.id);

    if (t.isDark) {
      root.style.setProperty(
        '--clay-raised',
        'inset 0 1px 0 rgba(255, 255, 255, 0.065), inset 0 -1px 0 rgba(0, 0, 0, 0.28), 0 10px 24px -8px rgba(0, 0, 0, 0.62), 0 3px 8px -2px rgba(0, 0, 0, 0.42)'
      );
      root.style.setProperty(
        '--clay-raised-sm',
        'inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.24), 0 5px 12px -4px rgba(0, 0, 0, 0.52), 0 1px 3px rgba(0, 0, 0, 0.35)'
      );
      root.style.setProperty(
        '--clay-inset',
        'inset 0 2px 5px rgba(0, 0, 0, 0.52), inset 0 1px 2px rgba(0, 0, 0, 0.36), 0 1px 0 rgba(255, 255, 255, 0.04)'
      );
      root.style.setProperty(
        '--clay-btn-primary',
        'inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -2px 0 rgba(0, 0, 0, 0.18), 0 6px 14px -4px rgba(0, 0, 0, 0.52), 0 2px 4px rgba(0, 0, 0, 0.30)'
      );
      root.style.setProperty(
        '--clay-btn-primary-pressed',
        'inset 0 2px 5px rgba(0, 0, 0, 0.34), 0 1px 2px rgba(0, 0, 0, 0.35)'
      );
      root.style.setProperty('--clay-topbar', '0 4px 16px -6px rgba(0, 0, 0, 0.55)');
      root.style.setProperty(
        '--clay-nav',
        '0 -6px 20px -6px rgba(0, 0, 0, 0.60), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      );
    } else {
      root.style.setProperty(
        '--clay-raised',
        'inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 8px 20px -6px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.05)'
      );
      root.style.setProperty(
        '--clay-raised-sm',
        'inset 0 1px 0 rgba(255, 255, 255, 0.88), 0 4px 10px -3px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)'
      );
      root.style.setProperty(
        '--clay-inset',
        'inset 0 2px 4px rgba(15, 23, 42, 0.08), inset 0 1px 2px rgba(15, 23, 42, 0.05)'
      );
      root.style.setProperty(
        '--clay-btn-primary',
        'inset 0 1px 0 rgba(255, 255, 255, 0.30), inset 0 -2px 0 rgba(0, 0, 0, 0.16), 0 5px 12px -3px rgba(2, 132, 199, 0.28)'
      );
      root.style.setProperty(
        '--clay-btn-primary-pressed',
        'inset 0 2px 4px rgba(0, 0, 0, 0.25)'
      );
      root.style.setProperty('--clay-topbar', '0 4px 14px -6px rgba(15, 23, 42, 0.08)');
      root.style.setProperty('--clay-nav', '0 -4px 16px -6px rgba(15, 23, 42, 0.08)');
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', t.bg);
    }

    try {
      localStorage.setItem('sawaari_theme', theme.id);
    } catch {
      // ignore storage errors
    }
  }
  return theme;
}
