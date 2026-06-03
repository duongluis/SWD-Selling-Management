// components/Styles/cardStyles.js
import { useLayout } from '@/components/Main/TabScreenLayout';
import { StyleSheet } from 'react-native';
import { THEME } from './theme';

const cardStylesDesktop = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: THEME.colors.white,
        borderRadius: THEME.radius.lg,
        borderWidth: 1,
        borderColor: THEME.colors.border,
        overflow: 'hidden',
        margin: THEME.spacing.lg,
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
        flexDirection: 'row',
        backgroundColor: THEME.colors.bg,
    },
    panelRight: {
        width: 360,
        backgroundColor: THEME.colors.white,
        borderLeftWidth: 1,
        borderLeftColor: THEME.colors.border,
        flexDirection: 'column',
        borderRadius: THEME.radius.lg,
        overflow: 'hidden',
        ...THEME.shadows.heavy,
    },
});

const cardStylesMobile = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: THEME.colors.white,
        borderRadius: 0,
        borderWidth: 0,
        borderColor: THEME.colors.border,
        overflow: 'hidden',
        margin: 0,
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
        flexDirection: 'column',
        backgroundColor: THEME.colors.bg,
    },
    panelRight: {
        width: '100%',
        backgroundColor: THEME.colors.white,
        borderLeftWidth: 0,
        borderLeftColor: THEME.colors.border,
        flexDirection: 'column',
        borderRadius: 0,
        overflow: 'hidden',
        ...THEME.shadows.heavy,
    },
});

export function useCardStyles() {
    const { isDesktop, isMobile, width } = useLayout();
    const styles = isDesktop ? cardStylesDesktop : cardStylesMobile;
    return { styles, isDesktop, isMobile, width };
}