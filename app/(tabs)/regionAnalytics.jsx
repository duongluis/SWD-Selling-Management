// app/(tabs)/regionReport.jsx — Báo cáo khu vực

import TabScreenLayout from '@/components/Main/TabScreenLayout';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
    ActivityIndicator, Platform, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const fmt = n => (n || 0).toLocaleString('vi-VN') + ' đ';
const fmtShort = n => {
    if (!n) return '0';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    return (n / 1_000).toFixed(0) + 'k';
};

const REGIONS = ['Miền Bắc', 'Miền Trung', 'Miền Nam'];
const REGION_COLORS = {
    'Miền Bắc': { c: '#2563EB', bg: '#EFF6FF', icon: 'location-outline' },
    'Miền Trung': { c: '#7C3AED', bg: '#F5F3FF', icon: 'map-outline' },
    'Miền Nam': { c: '#059669', bg: '#ECFDF5', icon: 'globe-outline' },
};
// Province → region mapping (simplified)
const PROVINCE_REGION = {
    'Hà Nội': 'Miền Bắc', 'Hải Phòng': 'Miền Bắc', 'Quảng Ninh': 'Miền Bắc',
    'Bắc Ninh': 'Miền Bắc', 'Thái Nguyên': 'Miền Bắc', 'Nam Định': 'Miền Bắc',
    'Đà Nẵng': 'Miền Trung', 'Huế': 'Miền Trung', 'Quảng Nam': 'Miền Trung',
    'Nghệ An': 'Miền Trung', 'Bình Định': 'Miền Trung', 'Khánh Hòa': 'Miền Trung',
    'TP.HCM': 'Miền Nam', 'Hồ Chí Minh': 'Miền Nam', 'Bình Dương': 'Miền Nam',
    'Đồng Nai': 'Miền Nam', 'Long An': 'Miền Nam', 'Cần Thơ': 'Miền Nam',
    'Vũng Tàu': 'Miền Nam', 'Bà Rịa': 'Miền Nam',
};

function getRegion(address) {
    if (!address) return 'Khác';
    for (const [province, region] of Object.entries(PROVINCE_REGION)) {
        if (address.includes(province)) return region;
    }
    return 'Khác';
}

function RegionCard({ region, data, total, isSelected, onSelect }) {
    const cfg = REGION_COLORS[region] || { c: '#64748B', bg: '#F1F5F9', icon: 'location-outline' };
    const pct = total > 0 ? Math.round((data.revenue / total) * 100) : 0;
    return (
        <TouchableOpacity
            style={[RC.card, isSelected && RC.cardSelected, { borderTopColor: cfg.c, borderTopWidth: 3 }]}
            onPress={() => onSelect(isSelected ? null : region)}
            activeOpacity={0.8}
        >
            <View style={[RC.iconWrap, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={20} color={cfg.c} />
            </View>
            <Text style={RC.name}>{region}</Text>
            <Text style={[RC.revenue, { color: cfg.c }]}>{fmtShort(data.revenue)}</Text>
            <Text style={RC.orders}>{data.orders} đơn hàng</Text>
            <View style={RC.progressTrack}>
                <View style={[RC.progressFill, { width: `${pct}%`, backgroundColor: cfg.c }]} />
            </View>
            <Text style={RC.pct}>{pct}% tổng DT</Text>
        </TouchableOpacity>
    );
}
const RC = StyleSheet.create({
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 4, minWidth: 140 },
    cardSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    name: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    revenue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    orders: { fontSize: 11, color: '#64748B' },
    progressTrack: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    pct: { fontSize: 10, color: '#94A3B8', marginTop: 3 },
});

export default function RegionReportScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const isAdmin = role === 'admin';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState([]);
    const [allOrders, setAllOrders] = useState([]);
    const [selected, setSelected] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            // Fetch users with region
            const uSnap = await getDocs(query(collection(db, 'users'), where('verified', '==', true)));
            setUsers(uSnap.docs.map(d => d.data()));

            // Fetch customers + orders
            const cSnap = isAdmin
                ? await getDocs(collection(db, 'customers'))
                : await getDocs(query(collection(db, 'customers'), where('createdBy', '==', userDetail.email)));
            const phones = cSnap.docs.map(d => d.data().phone).filter(Boolean);
            const orders = [];
            await Promise.all(phones.slice(0, 100).map(async phone => {
                try {
                    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
                    const s = await getDoc(firestoreDoc(db, 'orders', phone));
                    if (s.exists()) (s.data().orders || []).forEach(o => orders.push({ ...o, customerPhone: phone }));
                } catch (_) { }
            }));
            setAllOrders(orders.filter(o => o.status !== 'Đã hủy'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userDetail?.email, isAdmin]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    // Aggregate by region
    const regionData = useMemo(() => {
        const map = {};
        REGIONS.forEach(r => { map[r] = { revenue: 0, orders: 0, users: [], products: {} }; });
        map['Khác'] = { revenue: 0, orders: 0, users: [], products: {} };

        allOrders.forEach(o => {
            const region = getRegion(o.address);
            if (!map[region]) map[region] = { revenue: 0, orders: 0, users: [], products: {} };
            const val = (o.items || []).reduce((s, p) => s + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0);
            map[region].revenue += val;
            map[region].orders += 1;
            (o.items || []).forEach(p => {
                if (!map[region].products[p.name]) map[region].products[p.name] = 0;
                map[region].products[p.name] += parseFloat(p.qty || 1);
            });
        });
        users.forEach(u => {
            const region = u.regionName || u.region || 'Khác';
            if (map[region]) map[region].users.push(u);
        });
        return map;
    }, [allOrders, users]);

    const totalRevenue = Object.values(regionData).reduce((s, d) => s + d.revenue, 0);
    const detailData = selected ? regionData[selected] : null;

    return (
        <TabScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false}
                contentContainerStyle={G.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>

                <Text style={G.pageTitle}>Báo cáo khu vực</Text>

                {loading ? (
                    <View style={{ alignItems: 'center', paddingTop: 60 }}>
                        <ActivityIndicator size="large" color="#2563EB" />
                    </View>
                ) : (<>
                    {/* Summary bar */}
                    <View style={G.summaryBar}>
                        <View style={G.summaryItem}>
                            <Ionicons name="bar-chart-outline" size={18} color="#2563EB" />
                            <View>
                                <Text style={G.summaryLabel}>Tổng doanh thu</Text>
                                <Text style={G.summaryValue}>{fmt(totalRevenue)}</Text>
                            </View>
                        </View>
                        <View style={G.summaryDivider} />
                        <View style={G.summaryItem}>
                            <Ionicons name="receipt-outline" size={18} color="#059669" />
                            <View>
                                <Text style={G.summaryLabel}>Tổng đơn hàng</Text>
                                <Text style={G.summaryValue}>{allOrders.length}</Text>
                            </View>
                        </View>
                        <View style={G.summaryDivider} />
                        <View style={G.summaryItem}>
                            <Ionicons name="people-outline" size={18} color="#7C3AED" />
                            <View>
                                <Text style={G.summaryLabel}>Người dùng</Text>
                                <Text style={G.summaryValue}>{users.length}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Region cards */}
                    <Text style={G.sectionTitle}>Phân bổ theo khu vực</Text>
                    <View style={G.regionCards}>
                        {REGIONS.map(r => (
                            <RegionCard key={r} region={r} data={regionData[r] || { revenue: 0, orders: 0 }}
                                total={totalRevenue} isSelected={selected === r} onSelect={setSelected} />
                        ))}
                    </View>

                    {/* Detail panel khi chọn khu vực */}
                    {selected && detailData && (
                        <View style={G.detailCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Text style={G.cardTitle}>Chi tiết: {selected}</Text>
                                <TouchableOpacity onPress={() => setSelected(null)}>
                                    <Ionicons name="close" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                            {/* Stats */}
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                <View style={G.detailStat}>
                                    <Text style={G.detailStatLabel}>Doanh thu</Text>
                                    <Text style={G.detailStatValue}>{fmt(detailData.revenue)}</Text>
                                </View>
                                <View style={G.detailStat}>
                                    <Text style={G.detailStatLabel}>Đơn hàng</Text>
                                    <Text style={G.detailStatValue}>{detailData.orders}</Text>
                                </View>
                                <View style={G.detailStat}>
                                    <Text style={G.detailStatLabel}>Người bán</Text>
                                    <Text style={G.detailStatValue}>{detailData.users?.length || 0}</Text>
                                </View>
                            </View>
                            {/* Top products in region */}
                            {Object.keys(detailData.products || {}).length > 0 && (
                                <>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.06 }}>Sản phẩm bán chạy</Text>
                                    {Object.entries(detailData.products).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty], i) => (
                                        <View key={name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10 }}>
                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563EB' }}>{i + 1}</Text>
                                            </View>
                                            <Text style={{ flex: 1, fontSize: 12, color: '#0F172A' }} numberOfLines={1}>{name}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>{qty} đơn vị</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                            {/* Users in region */}
                            {detailData.users?.length > 0 && (
                                <>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.06 }}>Người bán khu vực</Text>
                                    {detailData.users.slice(0, 3).map(u => (
                                        <View key={u.email} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                                            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>
                                                    {(u.name || '?').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{u.name || u.email}</Text>
                                                <Text style={{ fontSize: 10, color: '#94A3B8' }}>{u.role}</Text>
                                            </View>
                                            {u.revenueTotal > 0 && <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>{fmtShort(u.revenueTotal)}</Text>}
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    )}

                    {/* Comparison table */}
                    <View style={G.card}>
                        <Text style={G.cardTitle}>So sánh khu vực</Text>
                        <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 12, marginBottom: 4 }}>
                            <Text style={{ flex: 1.5, fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Khu vực</Text>
                            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right' }}>Doanh thu</Text>
                            <Text style={{ flex: 0.8, fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right' }}>Đơn</Text>
                            <Text style={{ flex: 0.8, fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right' }}>TB/đơn</Text>
                        </View>
                        {REGIONS.map((r, i) => {
                            const d = regionData[r] || { revenue: 0, orders: 0 };
                            const avg = d.orders > 0 ? d.revenue / d.orders : 0;
                            const cfg = REGION_COLORS[r];
                            return (
                                <View key={r} style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' }, i % 2 === 1 && { backgroundColor: '#FAFBFF' }]}>
                                    <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.c }} />
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{r}</Text>
                                    </View>
                                    <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: cfg.c, textAlign: 'right' }}>{fmtShort(d.revenue)}</Text>
                                    <Text style={{ flex: 0.8, fontSize: 12, color: '#374151', textAlign: 'right' }}>{d.orders}</Text>
                                    <Text style={{ flex: 0.8, fontSize: 12, color: '#64748B', textAlign: 'right' }}>{fmtShort(avg)}</Text>
                                </View>
                            );
                        })}
                    </View>
                </>)}

                <View style={{ height: 80 }} />
            </ScrollView>
        </TabScreenLayout>
    );
}

const G = StyleSheet.create({
    scroll: { padding: isWeb ? 32 : 16, paddingTop: isWeb ? 24 : 16 },
    pageTitle: { fontSize: isWeb ? 26 : 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 20 },
    summaryBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryDivider: { width: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 },
    summaryLabel: { fontSize: 11, color: '#94A3B8' },
    summaryValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
    regionCards: { flexDirection: isWeb ? 'row' : 'column', gap: 12, marginBottom: 16 },
    detailCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE', borderLeftWidth: 4, borderLeftColor: '#2563EB', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    detailStat: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, alignItems: 'center' },
    detailStatLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    detailStatValue: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
});