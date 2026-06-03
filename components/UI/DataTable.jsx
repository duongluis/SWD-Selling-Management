// components/UI/DataTable.jsx

import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';



/**
 * @param columns - [{ key, label, flex, align }]
 * @param children - các TableRow
 */
export function DataTable({ columns, children, style }) {
    return (
        <View style={[T.root, style]}>
            {/* Header */}
            <View style={T.head}>
                {columns.map((col, i) => (
                    <Text
                        key={col.key || i}
                        style={[
                            T.headCell,
                            { flex: col.flex || 1 },
                            col.align === 'right' && { textAlign: 'right' },
                            col.align === 'center' && { textAlign: 'center' },
                            col.style,
                        ]}
                    >
                        {col.label}
                    </Text>
                ))}
                {/* Cột chevron placeholder */}
                <View style={{ width: 20 }} />
            </View>
            {/* Rows */}
            <View>{children}</View>
        </View>
    );
}

/**
 * Row wrapper — highlight khi active
 */
export function TableRow({ isActive, children, onPress, style }) {
    const { TouchableOpacity } = require('react-native');
    return (
        <TouchableOpacity
            style={[T.row, isActive && T.rowActive, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {isActive && <View style={T.leftBar} />}
            {children}
        </TouchableOpacity>
    );
}

/**
 * Cell đơn giản — flex text
 */
export function Cell({ children, flex = 1, align, style, textStyle, numberOfLines }) {
    return (
        <View style={[{ flex, paddingHorizontal: 4 }, style]}>
            {typeof children === 'string' ? (
                <Text
                    style={[T.cellText, align === 'right' && { textAlign: 'right' }, textStyle]}
                    numberOfLines={numberOfLines}
                >
                    {children}
                </Text>
            ) : children}
        </View>
    );
}

const T = StyleSheet.create({
    root: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        marginHorizontal: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 32 : 16,
        marginBottom: 12,
        // Shadow
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headCell: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.06,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
        position: 'relative',
        backgroundColor: '#FFFFFF',
        gap: 8,
    },
    rowActive: { backgroundColor: '#F0F7FF' },
    leftBar: {
        position: 'absolute',
        left: 0, top: 4, bottom: 4,
        width: 3,
        backgroundColor: '#2563EB',
        borderRadius: 2,
    },
    cellText: { fontSize: 12, color: '#374151' },
});