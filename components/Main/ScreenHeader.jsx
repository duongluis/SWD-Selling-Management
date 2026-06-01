import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();

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
}) {
    return (
        <View style={S.wrap}>
            <View style={S.titleRow}>
                {/* Left slot (back button...) */}
                {leftSlot && <View style={S.leftSlot}>{leftSlot}</View>}
                <View style={{ flex: 1 }}>
                    <Text style={S.title}>{title}</Text>
                    {subtitle ? <Text style={S.subtitle}>{subtitle}</Text> : null}
                </View>
                <View style={S.rightRow}>
                    {rightSlot}
                    {onAction && (
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
    wrap: { paddingHorizontal: isDesktop ? 32 : 16, paddingTop: isDesktop ? 20 : 16, paddingBottom: 12, backgroundColor: '#FFFFFF', zIndex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: isDesktop ? 24 : 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 3 },
    leftSlot: { marginRight: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    actionLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
});