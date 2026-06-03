// app/ctvCustomers/[email]/index.jsx
// Admin xem dashboard khách hàng của 1 CTV cụ thể
import BgWatermark from '@/components/Main/BgWatermark';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Dimensions, FlatList,
    Platform,
    RefreshControl, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';

const width = Dimensions.get('window').width
function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

const CONSULT_STATUS = {
    success: { label: 'Thành công', color: '#059669', bg: '#ECFDF5', dot: '#059669' },
    failed: { label: 'Thất bại', color: '#EF4444', bg: '#FEF2F2', dot: '#EF4444' },
    pending: { label: 'Đang tư vấn', color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
    none: { label: 'Chưa tư vấn', color: '#94A3B8', bg: '#F1F5F9', dot: '#CBD5E1' },
};

export default function CTVCustomersScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { isDesktop } = useLayout();
    const targetEmail = params.email || '';
    const targetName = params.name || targetEmail;

    const [customers, setCustomers] = useState([]);
    const [consultMap, setConsultMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        if (!targetEmail) return;
        setLoading(true);
        try {
            // 1. Lấy customers của CTV này
            const custSnap = await getDocs(
                query(collection(db, 'customers'), where('createdBy', '==', targetEmail))
            );
            const custs = custSnap.docs.map(d => ({ ...d.data(), docId: d.id }));
            setCustomers(custs);

            // 2. Lấy trạng thái tư vấn
            const phones = custs.map(c => c.phone).filter(Boolean);
            const map = {};
            phones.forEach(p => { map[p] = 'none'; });

            for (let i = 0; i < phones.length; i += 30) {
                const chunk = phones.slice(i, i + 30);
                const svcSnap = await getDocs(
                    query(collection(db, 'service'), where('type', '==', 'CONSULTING'), where('phone', 'in', chunk))
                );
                svcSnap.docs.forEach(d => {
                    const svc = d.data();
                    const status = svc.status || '';
                    if (status === 'Tư vấn thành công') map[svc.phone] = 'success';
                    else if (status === 'Tư vấn thất bại') map[svc.phone] = 'failed';
                    else if (['Nhận thông tin khách hàng', 'Chờ xử lý'].includes(status)) {
                        if (!['success', 'failed'].includes(map[svc.phone])) map[svc.phone] = 'pending';
                    }
                });
            }
            setConsultMap(map);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [targetEmail]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
    };

    const filtered = customers.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search)
    );

    // Stats
    const total = customers.length;
    const consulted = customers.filter(c => consultMap[c.phone] && consultMap[c.phone] !== 'none').length;
    const success = customers.filter(c => consultMap[c.phone] === 'success').length;
    const failed = customers.filter(c => consultMap[c.phone] === 'failed').length;

    const STATS = [
        { label: 'Tổng khách hàng', value: total, color: '#2563EB', bg: '#EFF6FF', icon: 'people-outline' },
        { label: 'Đã tư vấn', value: consulted, color: '#7C3AED', bg: '#F5F3FF', icon: 'chatbubbles-outline' },
        { label: 'Thành công', value: success, color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
        { label: 'Thất bại', value: failed, color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle-outline' },
    ];

    const renderRow = ({ item, index }) => {
        const statusKey = consultMap[item.phone] || 'none';
        const status = CONSULT_STATUS[statusKey];
        return (
            <TouchableOpacity
                style={S.tableRow}
                onPress={() => router.push({ pathname: '/CustomerView/[customerID]', params: { customerid: item?.docId, customerParam: JSON.stringify(item) } })}
                activeOpacity={0.7}
            >
                <View style={[S.tableCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                    <View style={[S.rowAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                        <Text style={S.rowAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                    <Text style={S.rowName} numberOfLines={1}>{item.name || '—'}</Text>
                </View>
                <View style={[S.tableCell, { flex: 1.5 }]}>
                    <Text style={S.rowPhone}>{item.phone || '—'}</Text>
                </View>
                {isDesktop && (
                    <View style={[S.tableCell, { flex: 1.2 }]}>
                        <Text style={S.rowDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>
                    </View>
                )}
                <View style={[S.tableCell, { flex: 1.5 }]}>
                    <View style={[S.statusChip, { backgroundColor: status.bg }]}>
                        <View style={[S.statusDot, { backgroundColor: status.dot }]} />
                        <Text style={[S.statusChipText, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.headerTitle}>Khách hàng của CTV</Text>
                    <Text style={S.headerSub} numberOfLines={1}>{targetName}</Text>
                </View>
                <TouchableOpacity onPress={handleRefresh} style={S.refreshBtn} disabled={loading}>
                    <Ionicons name="refresh-outline" size={17} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* Stats */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 10, paddingRight: 16 }}>
                        {STATS.map(s => (
                            <View key={s.label} style={[S.statCard, isDesktop && { width: undefined, flex: 1 }]}>
                                <View style={[S.statIconWrap, { backgroundColor: s.bg }]}>
                                    <Ionicons name={s.icon} size={20} color={s.color} />
                                </View>
                                <Text style={S.statLabel}>{s.label}</Text>
                                <Text style={[S.statValue, { color: s.color }]}>{s.value}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Table */}
                <View style={S.tableCard}>
                    {/* Top bar */}
                    <View style={S.tableTopBar}>
                        <Text style={S.tableTitle}>Danh sách khách hàng</Text>
                        <View style={S.searchBox}>
                            <Ionicons name="search-outline" size={14} color="#94A3B8" />
                            <TextInput
                                style={S.searchInput}
                                placeholder="Tìm kiếm..."
                                placeholderTextColor="#94A3B8"
                                value={search}
                                onChangeText={setSearch}
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <Ionicons name="close-circle" size={14} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Column headers */}
                    <View style={S.colHeader}>
                        <Text style={[S.colText, { flex: 2.5 }]}>TÊN KHÁCH HÀNG</Text>
                        <Text style={[S.colText, { flex: 1.5 }]}>SỐ ĐIỆN THOẠI</Text>
                        {isDesktop && <Text style={[S.colText, { flex: 1.2 }]}>NGÀY ĐĂNG KÝ</Text>}
                        <Text style={[S.colText, { flex: 1.5 }]}>TRẠNG THÁI TƯ VẤN</Text>
                        <View style={{ width: 20 }} />
                    </View>

                    {/* Rows */}
                    {loading ? (
                        <View style={S.loadWrap}>
                            <ActivityIndicator color="#2563EB" size="small" />
                            <Text style={S.loadText}>Đang tải...</Text>
                        </View>
                    ) : filtered.length === 0 ? (
                        <View style={S.emptyWrap}>
                            <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                            <Text style={S.emptyText}>{search ? 'Không tìm thấy kết quả' : 'CTV này chưa có khách hàng nào'}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filtered}
                            keyExtractor={(item, i) => item.docId || String(i)}
                            renderItem={renderRow}
                            showsVerticalScrollIndicator={false}
                            scrollEnabled={false}
                            contentContainerStyle={{ paddingBottom: 8 }}
                        />
                    )}

                    {/* Footer */}
                    {filtered.length > 0 && (
                        <View style={S.tableFooter}>
                            <Text style={S.footerCount}>
                                {filtered.length} khách hàng · Tỷ lệ thành công: {total > 0 ? Math.round((success / total) * 100) : 0}%
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ height: insets.bottom + 32 }} />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
    refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: Platform.OS === 'web' && width >= 768 ? 32 : 16, paddingTop: 16 },
    // Stats
    statCard: { width: 150, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    statIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    statLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
    statValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    // Table
    tableCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 16 },
    tableTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tableTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#E2E8F0', minWidth: Platform.OS === 'web' && width >= 768 ? 180 : 140 },
    searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    colText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    tableCell: { paddingRight: 8 },
    rowAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    rowAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    rowName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    rowPhone: { fontSize: 13, color: '#374151' },
    rowDate: { fontSize: 12, color: '#64748B' },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    loadWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
    loadText: { fontSize: 13, color: '#94A3B8' },
    emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 13, color: '#94A3B8' },
    tableFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    footerCount: { fontSize: 12, color: '#64748B' },
});