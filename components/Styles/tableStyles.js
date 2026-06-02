// components/Styles/tableStyles.js
import { useLayout } from '@/components/Main/TabScreenLayout';
import { StyleSheet } from 'react-native';
import { THEME } from './theme';

export function useTableStyles() {
    const { isDesktop, isMobile } = useLayout();

    const styles = StyleSheet.create({
        head: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
            paddingHorizontal: isDesktop ? THEME.spacing.xl : THEME.spacing.lg,
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: THEME.colors.border,
        },
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
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: THEME.colors.white,
            paddingHorizontal: isDesktop ? THEME.spacing.xl : THEME.spacing.lg,
            paddingVertical: 13,
            borderBottomWidth: 0.5,
            borderBottomColor: '#F1F5F9',
            position: 'relative',
            gap: THEME.spacing.sm,
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
        listContainer: {
            paddingBottom: isDesktop ? 60 : 100,
        }
    });

    return { styles, isDesktop, isMobile };
}