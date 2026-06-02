// components/Styles/cardStyles.js
import { useLayout } from '@/components/Main/TabScreenLayout'; // Hook của bạn
import { StyleSheet } from 'react-native';
import { THEME } from './theme';

export function useCardStyles() {
    const { isDesktop, isMobile, width } = useLayout();

    const styles = StyleSheet.create({
        card: {
            flex: 1,
            backgroundColor: THEME.colors.white,
            borderRadius: isDesktop ? THEME.radius.lg : 0,
            borderWidth: isDesktop ? 1 : 0,
            borderColor: THEME.colors.border,
            overflow: 'hidden',
            margin: isDesktop ? THEME.spacing.lg : 0,
            marginTop: 0,
            ...THEME.shadows.light,
        },
        mobileCardWrapper: {
            backgroundColor: THEME.colors.white,
            borderRadius: THEME.radius.lg,
            padding: THEME.spacing.md,
            marginBottom: THEME.spacing.sm,
            borderWidth: 1,
            borderColor: THEME.colors.border,
            ...THEME.shadows.light,
        },
        splitLayout: {
            flex: 1,
            flexDirection: isDesktop ? 'row' : 'column',
            backgroundColor: THEME.colors.bg,
        },
        panelRight: {
            width: isDesktop ? 360 : '100%',
            backgroundColor: THEME.colors.white,
            borderLeftWidth: isDesktop ? 1 : 0,
            borderLeftColor: THEME.colors.border,
            flexDirection: 'column',
            borderRadius: isDesktop ? THEME.radius.lg : 0,
            overflow: 'hidden',
            ...THEME.shadows.heavy,
        }
    });

    return { styles, isDesktop, isMobile, width };
}