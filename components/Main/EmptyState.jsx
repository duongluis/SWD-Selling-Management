import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EmptyState({
    loading,
    error,
    empty,
    icon = 'document-outline',
    title = 'Không có dữ liệu',
    subtitle = '',
    actionLabel,
    onAction,
}) {
    if (loading) return (
        <View style={S.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={S.loadText}>Đang tải...</Text>
        </View>
    );

    if (error) return (
        <View style={S.center}>
            <View style={[S.iconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="warning-outline" size={32} color="#EF4444" />
            </View>
            <Text style={S.title}>Có lỗi xảy ra</Text>
            <Text style={S.sub}>{error}</Text>
            {onAction && (
                <TouchableOpacity style={S.btn} onPress={onAction}>
                    <Text style={S.btnText}>{actionLabel || 'Thử lại'}</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (empty) return (
        <View style={S.center}>
            <View style={S.iconWrap}>
                <Ionicons name={icon} size={32} color="#CBD5E1" />
            </View>
            <Text style={S.title}>{title}</Text>
            {subtitle ? <Text style={S.sub}>{subtitle}</Text> : null}
            {onAction && (
                <TouchableOpacity style={S.btn} onPress={onAction}>
                    <Text style={S.btnText}>{actionLabel || 'Thêm mới'}</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return null;
}

const S = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
    iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    title: { fontSize: 16, fontWeight: '700', color: '#374151', textAlign: 'center' },
    sub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
    loadText: { fontSize: 14, color: '#94A3B8', marginTop: 8 },
    btn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 10 },
    btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});