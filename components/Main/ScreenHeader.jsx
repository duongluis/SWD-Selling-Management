import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLayout } from './TabScreenLayout';

// Vùng status bar đã được TabScreenLayout chừa (insets.top) nên header không cộng thêm

export default function ScreenHeader({
    title,
    subtitle,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Tìm kiếm...',
    showSearch = true,
    actionLabel,
    actionIcon = 'add',
    onAction,
    actionColor = '#2563EB',
    rightSlot,
    leftSlot,      // ← nút back hoặc bất kỳ element nào bên trái title
    canAccess,
}) {
    const { isDesktop } = useLayout();
    return (
        <View style={[S.wrap, isDesktop && S.wrapDesktop]}>
            <View style={S.titleRow}>
                {/* Left slot (back button...) */}
                {leftSlot && <View style={S.leftSlot}>{leftSlot}</View>}
                <View style={{ flex: 1 }}>
                    <Text style={[S.title, isDesktop && S.titleDesktop]}>{title}</Text>
                    {subtitle ? <Text style={S.subtitle}>{subtitle}</Text> : null}
                </View>
                <View style={S.rightRow}>
                    {rightSlot}
                    {onAction && canAccess && (
                        <TouchableOpacity
                            style={[S.actionBtn, { backgroundColor: actionColor }]}
                            onPress={onAction}
                            activeOpacity={0.85}
                        >
                            <Ionicons name={actionIcon} size={16} color="#fff" />
                            {actionLabel ? <Text style={S.actionLabel}>{actionLabel}</Text> : null}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {showSearch && (
                <View style={S.searchBar}>
                    <Ionicons name="search-outline" size={16} color="#94A3B8" />
                    <TextInput
                        style={S.searchInput}
                        value={searchValue}
                        onChangeText={onSearchChange}
                        placeholder={searchPlaceholder}
                        placeholderTextColor="#94A3B8"
                        returnKeyType="search"
                    />
                    {searchValue?.length > 0 && (
                        <TouchableOpacity onPress={() => onSearchChange('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const S = StyleSheet.create({
    wrap: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        zIndex: 1,
    },
    wrapDesktop: { paddingHorizontal: 32, paddingTop: 20 },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    titleDesktop: { fontSize: 24 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
    rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 3 },
    leftSlot: { marginRight: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
});