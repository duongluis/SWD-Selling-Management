import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();

function StatCard({ icon, label, value, color, bg }) {
    return (
        <View style={[S.card, isDesktop && S.cardWeb]}>
            <View style={[S.iconWrap, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
            <View>
                <Text style={S.label} numberOfLines={1}>{label}</Text>
                <Text style={[S.value, { color }]}>{value}</Text>
            </View>
        </View>
    );
}

/**
 * @param stats - array of { icon, label, value, color, bg }
 */
export default function StatBar({ stats = [] }) {
    if (!stats.length) return null;

    if (isDesktop) return (
        <View style={S.rowWeb}>
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </View>
    );

    return (
        // ✅ Bọc thêm View với height cố định để giới hạn
        <View style={{ height: 72, overflow: 'hidden' }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.rowMobile}
            >
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    rowWeb: { flexDirection: 'row', gap: 12, paddingHorizontal: 32, marginBottom: 16 },

    // ✅ Thêm paddingTop + paddingRight để card cuối không bị cắt
    rowMobile: {
        paddingHorizontal: 16,
        paddingTop: 8,        // ← thêm
        paddingBottom: 12,
        paddingRight: 24,     // ← thêm, tránh card cuối bị cắt
        gap: 10
    },

    // ✅ Bỏ minWidth cố định, dùng width tự tính theo nội dung
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minWidth: 130,        // ← giảm từ 140 xuống 130
        height: 56, // ✅ chiều cao cố định
    },
    cardWeb: { flex: 1 },
    iconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 11, color: '#64748B', marginBottom: 2, flexShrink: 1 },
    value: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
});