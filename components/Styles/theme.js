// components/styles/theme.js

export const DESKTOP_BREAKPOINT = 768;

export const THEME = {
    colors: {
        primary: '#2563EB',
        primaryLight: '#EFF6FF',
        primaryBorder: '#BFDBFE',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        border: '#E2E8F0',
        bg: '#F8FAFC',
        white: '#FFFFFF',
        black: '#000000',
        danger: '#EF4444',
        dangerLight: '#FEF2F2',
        dangerBorder: '#FCA5A5',
        success: '#10B981',
        successLight: '#ECFDF5',
        successBorder: '#A7F3D0',
        warning: '#F59E0B',
        warningLight: '#FFFBEB',
        warningBorder: '#FDE68A',
        purple: '#7C3AED',
        purpleLight: '#F5F3FF',
        purpleBorder: '#DDD6FE',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        xxl: 32,
    },
    radius: {
        sm: 6,
        md: 10,
        lg: 14,
        pill: 9999,
    },
    shadows: {
        light: {
            shadowColor: '#0F172A',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
        },
        heavy: {
            shadowColor: '#000000',
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 10,
        }
    }
};