import { Ionicons } from '@expo/vector-icons';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

const isWeb = Platform.OS === 'web';

function StatCard({ icon, label, value, color, bg }) {
    return (
        <View style={[S.card, isWeb && S.cardWeb]}>
            <View style={[S.iconWrap, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
            <View>
                <Text style={S.label}>{label}</Text>
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

    if (isWeb) return (
        <View style={S.rowWeb}>
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </View>
    );

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.rowMobile}
        >
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </ScrollView>
    );
}

const S = StyleSheet.create({
    rowWeb: { flexDirection: 'row', gap: 12, paddingHorizontal: 32, marginBottom: 16 },
    rowMobile: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 140 },
    cardWeb: { flex: 1 },
    iconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 11, color: '#64748B', marginBottom: 2 },
    value: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
});