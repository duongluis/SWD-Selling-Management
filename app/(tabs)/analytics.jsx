// app/(tabs)/revenue.jsx
// Màn báo cáo chi tiết doanh thu

import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, Image, Platform, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png');

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const fmtShort = (n) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
};

function getRole(u) {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    return 'other';
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, bg }) {
    return (
        <View style={[R.statCard, isWeb && R.statCardWeb]}>
            <View style={[R.statIconWrap, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={R.statLabel}>{label}</Text>
                <Text style={[R.statValue, { color }]}>{value}</Text>
                {sub ? <Text style={R.statSub}>{sub}</Text> : null}
            </View>
        </View>
    );
}

// ── Month bar chart ───────────────────────────────────────────
function MonthChart({ data }) {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(d => d.amount), 1);
    return (
        <View style={R.chartWrap}>
            <Text style={R.chartTitle}>Doanh thu theo tháng</Text>
            <View style={R.chartBars}>
                {data.map((d, i) => {
                    const pct = (d.amount / max) * 100;
                    return (
                        <View key={i} style={R.barCol}>
                            <Text style={R.barAmount}>{d.amount > 0 ? fmtShort(d.amount) : ''}</Text>
                            <View style={R.barTrack}>
                                <View style={[R.barFill, { height: `${Math.max(pct, 2)}%`, backgroundColor: pct > 50 ? '#2563EB' : '#93C5FD' }]} />
                            </View>
                            <Text style={R.barLabel}>{d.month}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ── Order row ─────────────────────────────────────────────────
function OrderRow({ order, index }) {
    const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
    const isCancelled = order.status === 'Đã hủy';
    return (
        <View style={[R.orderRow, index % 2 === 0 && R.orderRowAlt]}>
            <View style={{ flex: 2 }}>
                <Text style={[R.orderIdText, isCancelled && R.strikethrough]}>#{order.id}</Text>
                <Text style={R.orderCustomer} numberOfLines={1}>{order.customer}</Text>
            </View>
            <Text style={[R.orderAmount, isCancelled && { color: '#94A3B8' }]}>{fmt(total)}</Text>
            <View style={[R.statusPill, { backgroundColor: isCancelled ? '#F1F5F9' : '#ECFDF5' }]}>
                <Text style={[R.statusText, { color: isCancelled ? '#94A3B8' : '#059669' }]}>
                    {isCancelled ? 'Đã hủy' : order.status || '—'}
                </Text>
            </View>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function RevenueScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [monthData, setMonthData] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    const isAdmin = role === 'admin';

    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            // ── Fetch orders ─────────────────────────────────────
            let phones = [];
            if (isAdmin) {
                const custSnap = await getDocs(collection(db, 'customers'));
                phones = custSnap.docs.map(d => d.data().phone).filter(Boolean);
            } else {
                const custSnap = await getDocs(
                    query(collection(db, 'customers'), where('addBy', '==', userDetail.email))
                );
                phones = custSnap.docs.map(d => d.data().phone).filter(Boolean);
            }

            const allOrders = [];
            await Promise.all(phones.map(async (phone) => {
                try {
                    const snap = await getDoc(doc(db, 'orders', phone));
                    if (!snap.exists()) return;
                    (snap.data().orders || []).forEach(o => allOrders.push(o));
                } catch (_) { }
            }));

            allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setOrders(allOrders);

            // ── Tính doanh thu theo tháng (6 tháng gần nhất) ─────
            const now = new Date();
            const months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                return {
                    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    month: `T${d.getMonth() + 1}`,
                    amount: 0,
                };
            });

            allOrders.forEach(o => {
                if (o.status === 'Đã hủy') return;
                const key = (o.createdAt || '').slice(0, 7);
                const m = months.find(m => m.key === key);
                if (m) m.amount += (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
            });
            setMonthData(months);

            // ── Leaderboard (admin only) ──────────────────────────
            if (isAdmin) {
                const userSnap = await getDocs(
                    query(collection(db, 'users'), where('verified', '==', true))
                );
                const board = userSnap.docs
                    .map(d => d.data())
                    .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin' && (u.revenueTotal || 0) > 0)
                    .sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))
                    .slice(0, 10);
                setLeaderboard(board);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userDetail?.email, isAdmin]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleRefresh = () => { setRefreshing(true); fetchData(); };

    // ── Thống kê tổng ────────────────────────────────────────
    const activeOrders = orders.filter(o => o.status !== 'Đã hủy');
    const cancelledOrders = orders.filter(o => o.status === 'Đã hủy');
    const totalRevenue = activeOrders.reduce((s, o) =>
        s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
    const avgOrderValue = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;
    const thisMonth = monthData[monthData.length - 1]?.amount || 0;
    const lastMonth = monthData[monthData.length - 2]?.amount || 0;
    const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return (
        <View style={R.root}>
            <Image source={BG_IMAGE} style={R.watermark} resizeMode="contain" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={R.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* Header */}
                <View style={R.header}>
                    <View>
                        <Text style={R.headerTitle}>Báo cáo doanh thu</Text>
                        <Text style={R.headerSub}>
                            {isAdmin ? 'Tổng quan toàn hệ thống' : `Tài khoản: ${userDetail?.name || userDetail?.email}`}
                        </Text>
                    </View>
                    <TouchableOpacity style={R.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
                        <Ionicons name="refresh-outline" size={17} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={R.loadWrap}>
                        <ActivityIndicator size="large" color="#2563EB" />
                        <Text style={R.loadText}>Đang tải...</Text>
                    </View>
                ) : (<>

                    {/* Stats */}
                    <View style={[R.statsRow, isWeb && R.statsRowWeb]}>
                        <StatCard
                            icon="cash-outline" label="Tổng doanh thu"
                            value={fmt(totalRevenue)} color="#10B981" bg="#ECFDF5"
                        />
                        <StatCard
                            icon="receipt-outline" label="Đơn hàng"
                            value={String(activeOrders.length)}
                            sub={cancelledOrders.length > 0 ? `${cancelledOrders.length} đã hủy` : undefined}
                            color="#2563EB" bg="#EFF6FF"
                        />
                        <StatCard
                            icon="trending-up-outline" label="Tháng này"
                            value={fmt(thisMonth)}
                            sub={growth !== 0 ? `${growth > 0 ? '+' : ''}${growth.toFixed(0)}% so tháng trước` : 'Chưa có tháng trước'}
                            color={growth >= 0 ? '#059669' : '#EF4444'} bg={growth >= 0 ? '#ECFDF5' : '#FEF2F2'}
                        />
                        <StatCard
                            icon="calculator-outline" label="Giá trị TB/đơn"
                            value={fmt(avgOrderValue)} color="#8B5CF6" bg="#F5F3FF"
                        />
                    </View>

                    {/* Chart */}
                    <View style={R.card}>
                        <MonthChart data={monthData} />
                    </View>

                    {/* Leaderboard — admin only */}
                    {isAdmin && leaderboard.length > 0 && (
                        <View style={R.card}>
                            <Text style={R.cardTitle}>🏆 Top doanh số</Text>
                            {leaderboard.map((u, i) => (
                                <View key={u.email} style={R.leaderRow}>
                                    <View style={[R.rankBadge, i < 3 && { backgroundColor: ['#F59E0B', '#94A3B8', '#CD7F32'][i] }]}>
                                        <Text style={R.rankText}>{i + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={R.leaderName}>{u.name || u.email}</Text>
                                        <Text style={R.leaderEmail}>{u.email}</Text>
                                    </View>
                                    <Text style={R.leaderRevenue}>{fmt(u.revenueTotal)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Recent orders */}
                    <View style={R.card}>
                        <Text style={R.cardTitle}>Đơn hàng gần đây</Text>
                        <View style={R.tableHeader}>
                            <Text style={[R.thCell, { flex: 2 }]}>Đơn hàng</Text>
                            <Text style={R.thCell}>Tổng tiền</Text>
                            <Text style={R.thCell}>Trạng thái</Text>
                        </View>
                        {orders.slice(0, 20).map((o, i) => (
                            <OrderRow key={o.id || i} order={o} index={i} />
                        ))}
                        {orders.length === 0 && (
                            <View style={R.empty}>
                                <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                                <Text style={R.emptyText}>Chưa có đơn hàng nào</Text>
                            </View>
                        )}
                    </View>

                </>)}

                <View style={{ height: isWeb ? 32 : 100 }} />
            </ScrollView>
        </View>
    );
}

const R = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.05 },
    scroll: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
    headerTitle: { fontSize: isWeb ? 26 : 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: '#64748B', marginTop: 3 },
    refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    loadWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    loadText: { fontSize: 14, color: '#94A3B8' },
    // Stats
    statsRow: { flexDirection: 'column', gap: 10, marginBottom: 16 },
    statsRowWeb: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    statCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    statCardWeb: { flex: 1 },
    statIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
    statValue: { fontSize: isWeb ? 22 : 20, fontWeight: '800', letterSpacing: -0.5 },
    statSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    // Card
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
    // Chart
    chartWrap: {},
    chartTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 },
    barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barAmount: { fontSize: 9, color: '#64748B', marginBottom: 3, textAlign: 'center' },
    barTrack: { width: '70%', height: '80%', backgroundColor: '#F1F5F9', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 4 },
    barLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
    // Leaderboard
    leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    rankBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    leaderName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    leaderEmail: { fontSize: 11, color: '#94A3B8' },
    leaderRevenue: { fontSize: 13, fontWeight: '700', color: '#10B981' },
    // Orders table
    tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 4 },
    thCell: { flex: 1, fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
    orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
    orderRowAlt: { backgroundColor: '#FAFBFF', marginHorizontal: -16, paddingHorizontal: 16 },
    orderIdText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    orderCustomer: { fontSize: 11, color: '#64748B' },
    orderAmount: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0F172A' },
    strikethrough: { textDecorationLine: 'line-through', color: '#94A3B8' },
    statusPill: { flex: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, alignItems: 'center' },
    statusText: { fontSize: 10, fontWeight: '600' },
    empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    emptyText: { fontSize: 14, color: '#94A3B8' },
});