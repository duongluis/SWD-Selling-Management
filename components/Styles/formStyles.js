// components/Styles/cardStyles.js
import { StyleSheet } from 'react-native';
import { THEME } from './theme';

export const formStyles = StyleSheet.create({
    group: {
        marginBottom: THEME.spacing.md,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: THEME.spacing.xs,
        marginBottom: THEME.spacing.sm,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: THEME.colors.textSecondary,
        letterSpacing: 0.3,
    },
    required: {
        color: THEME.colors.danger,
        fontSize: 12,
    },
    optional: {
        fontSize: 11,
        color: THEME.colors.textMuted,
        fontWeight: '400',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.colors.white,
        borderRadius: THEME.radius.md,
        paddingHorizontal: THEME.spacing.md,
        paddingVertical: THEME.spacing.sm + 2, // ~10px padding
        borderWidth: 1.5,
        borderColor: THEME.colors.border,
        gap: THEME.spacing.sm,
    },
    inputBoxFocus: {
        borderColor: THEME.colors.primary,
        backgroundColor: THEME.colors.primaryLight,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: THEME.colors.textPrimary,
        fontWeight: '500',
    },
    inputReadonly: {
        backgroundColor: '#F1F5F9',
        borderColor: THEME.colors.border,
    },
    inputTextReadonly: {
        color: THEME.colors.textMuted,
    },
    textAreaBox: {
        alignItems: 'flex-start',
        minHeight: 80,
    },
    textAreaInput: {
        textAlignVertical: 'top',
    },
    hint: {
        fontSize: 11,
        color: THEME.colors.textMuted,
        marginTop: THEME.spacing.xs,
    },
    errText: {
        fontSize: 11,
        color: THEME.colors.danger,
        marginTop: THEME.spacing.xs,
        fontWeight: '500',
    }
});