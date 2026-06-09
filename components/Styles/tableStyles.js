// components/Styles/tableStyles.js
import { useLayout } from '@/components/Main/TabScreenLayout';
import { StyleSheet } from 'react-native';
import { THEME } from './theme';

const tableStylesDesktop = StyleSheet.create({
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: THEME.spacing.xl,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
        gap: THEME.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.colors.white,
        paddingHorizontal: THEME.spacing.xl,
        paddingVertical: 13,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
        position: 'relative',
        gap: THEME.spacing.sm,
    },
    listContainer: {
        paddingBottom: 60,
    },
});

const tableStylesMobile = StyleSheet.create({
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: THEME.spacing.lg,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: THEME.colors.border,
        gap: THEME.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.colors.white,
        paddingHorizontal: THEME.spacing.lg,
        paddingVertical: 13,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
        position: 'relative',
        gap: THEME.spacing.sm,
    },
    listContainer: {
        paddingBottom: 100,
    },
});

// Các style giống nhau hoàn toàn ở cả desktop lẫn mobile
const tableStylesShared = StyleSheet.create({
    th: {
        fontSize: 11,
        fontWeight: '700',
        color: THEME.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.06,
        paddingHorizontal: THEME.spacing.xs,
    },
    thRight: {
        textAlign: 'right',
    },
    thCenter: {
        textAlign: 'center',
    },
    rowActive: {
        backgroundColor: '#F0F7FF',
    },
    rowCancelled: {
        opacity: 0.6,
    },
    leftAccent: {
        position: 'absolute',
        left: 0,
        top: 4,
        bottom: 4,
        width: 3,
        backgroundColor: THEME.colors.primary,
        borderRadius: 2,
    },
    cellText: {
        fontSize: 13,
        color: '#374151',
    },
    cellMuted: {
        fontSize: 11,
        color: THEME.colors.textMuted,
    },
});

export function useTableStyles() {
    const { isDesktop, isMobile } = useLayout();
    const styles = {
        ...(isDesktop ? tableStylesDesktop : tableStylesMobile),
        ...tableStylesShared,
    };
    return { styles, isDesktop, isMobile };
}