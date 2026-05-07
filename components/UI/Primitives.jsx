import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ── Section title ─────────────────────────────────────────────
export function SectionTitle({ children, style }) {
    return <Text style={[P.sectionTitle, style]}>{children}</Text>;
}

// ── Info row: Label + Value ────────────────────────────────────
export function InfoRow({ icon, label, value, valueStyle, onPress }) {
    const content = (
        <View style={P.infoRow}>
            {icon && (
                <View style={P.infoIconWrap}>
                    <Ionicons name={icon} size={14} color="#64748B" />
                </View>
            )}
            <Text style={P.infoLabel}>{label}</Text>
            <Text style={[P.infoValue, valueStyle]} numberOfLines={2}>{value || '—'}</Text>
        </View>
    );
    if (onPress) return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
    );
    return content;
}

// ── Info card: nhóm nhiều InfoRow ────────────────────────────
export function InfoCard({ children, style }) {
    return <View style={[P.infoCard, style]}>{children}</View>;
}

// ── Status badge ──────────────────────────────────────────────
export function StatusBadge({ status, config }) {
    // config: { [statusKey]: { color, bg, label } }
    const cfg = config?.[status] || { color: '#64748B', bg: '#F1F5F9', label: status };
    return (
        <View style={[P.badge, { backgroundColor: cfg.bg }]}>
            <View style={[P.badgeDot, { backgroundColor: cfg.color }]} />
            <Text style={[P.badgeText, { color: cfg.color }]}>{cfg.label || status}</Text>
        </View>
    );
}

// ── Action button ─────────────────────────────────────────────
export function ActionBtn({ icon, label, onPress, color = '#2563EB', bg = '#EFF6FF', disabled = false, style }) {
    return (
        <TouchableOpacity
            style={[P.actionBtn, { backgroundColor: bg, borderColor: bg }, disabled && P.actionBtnDisabled, style]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <Ionicons name={icon} size={14} color={disabled ? '#CBD5E1' : color} />
            {label && <Text style={[P.actionBtnText, { color: disabled ? '#CBD5E1' : color }]}>{label}</Text>}
        </TouchableOpacity>
    );
}

// ── Primary button (full width) ───────────────────────────────
export function PrimaryBtn({ icon, label, onPress, color = '#2563EB', loading = false, disabled = false }) {
    return (
        <TouchableOpacity
            style={[P.primaryBtn, { backgroundColor: disabled ? '#CBD5E1' : color }]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
        >
            <Ionicons name={loading ? 'hourglass-outline' : (icon || 'checkmark')} size={16} color="#fff" />
            <Text style={P.primaryBtnText}>{loading ? 'Đang xử lý...' : label}</Text>
        </TouchableOpacity>
    );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ style }) {
    return <View style={[P.divider, style]} />;
}

// ── Items table (đơn hàng / dịch vụ) ─────────────────────────
export function ItemsTable({ items = [], priceLabel = 'Đơn giá' }) {
    if (!items.length) return (
        <Text style={P.noItems}>Không có sản phẩm</Text>
    );
    const total = items.reduce((s, p) => s + (p.price * p.qty || 0), 0);
    return (
        <View style={P.table}>
            {/* Header */}
            <View style={[P.tableRow, P.tableHead]}>
                <Text style={[P.th, { flex: 1 }]}>Sản phẩm</Text>
                <Text style={[P.th, P.thR, { width: 36 }]}>SL</Text>
                <Text style={[P.th, P.thR, { width: 90 }]}>{priceLabel}</Text>
                <Text style={[P.th, P.thR, { width: 90 }]}>Thành tiền</Text>
            </View>
            {/* Rows */}
            {items.map((p, i) => (
                <View key={i} style={[P.tableRow, i % 2 === 1 && P.tableRowAlt]}>
                    <Text style={[P.td, { flex: 1 }]} numberOfLines={2}>{p.name || '—'}</Text>
                    <Text style={[P.td, P.tdR, { width: 36 }]}>{p.qty || 1}</Text>
                    <Text style={[P.td, P.tdR, { width: 90 }]}>{(p.price || 0).toLocaleString('vi-VN')}đ</Text>
                    <Text style={[P.td, P.tdR, { width: 90, fontWeight: '700' }]}>{((p.price || 0) * (p.qty || 1)).toLocaleString('vi-VN')}đ</Text>
                </View>
            ))}
            {/* Total */}
            <View style={[P.tableRow, P.tableFoot]}>
                <Text style={[P.td, { flex: 1, fontWeight: '700' }]}>Tổng cộng</Text>
                <Text style={[P.td, P.tdR, { fontWeight: '800', color: '#2563EB', fontSize: 14 }]}>{total.toLocaleString('vi-VN')}đ</Text>
            </View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────
const P = StyleSheet.create({
    sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
    infoCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 8, borderWidth: 0.5, borderColor: '#E2E8F0', marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 100, fontSize: 12, color: '#64748B', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
    actionBtnDisabled: { opacity: 0.5 },
    actionBtnText: { fontSize: 12, fontWeight: '700' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10 },
    primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    divider: { height: 0.5, backgroundColor: '#E2E8F0', marginVertical: 12 },
    noItems: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },
    table: { borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    tableHead: { backgroundColor: '#F8FAFC' },
    tableRowAlt: { backgroundColor: '#FAFBFF' },
    tableFoot: { backgroundColor: '#F0F9FF', borderTopWidth: 0.5, borderTopColor: '#E2E8F0', borderBottomWidth: 0 },
    th: { fontSize: 9, fontWeight: '700', color: '#94A3B8', padding: 8, textTransform: 'uppercase', letterSpacing: 0.05 },
    thR: { textAlign: 'right' },
    td: { fontSize: 12, color: '#0F172A', padding: 8 },
    tdR: { textAlign: 'right' },
});