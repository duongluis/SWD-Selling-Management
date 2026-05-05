// app/(tabs)/revenue.jsx
// Màn báo cáo doanh thu — thiết kế theo ảnh mẫu

import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, Image, Platform, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png');

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const fmtShort = (n) => {
    if (!n) return '0';
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

const PERIODS = [
    { key: 'daily', label: 'Hàng\nngày' },
    { key: 'weekly', label: 'Hàng\ntuần' },
    { key: 'monthly', label: 'Hàng\ntháng' },
    { key: 'yearly', label: 'Hàng\nnăm' },
];

// ── Bar Chart ────────────────────────────────────────────────
function BarChart({ bars, period }) {
    if (!bars || bars.length === 0) return null;
    const max = Math.max(...bars.map(b => b.amount), 1);
    return (
        <View style={C.chartWrap}>
            <View style={C.chartBars}>
                {bars.map((b, i) => {
                    const pct = Math.max((b.amount / max) * 100, 3);
                    const isHighest = b.amount === max && max > 0;
                    return (
                        <View key={i} style={C.barCol}>
                            {b.amount > 0 && (
                                <Text style={C.barAmt}>{fmtShort(b.amount)}</Text>
                            )}
                            <View style={C.barTrack}>
                                <View style={[
                                    C.barFill,
                                    { height: `${pct}%` },
                                    isHighest ? C.barFillHigh : C.barFillNormal,
                                ]} />
                            </View>
                            <Text style={C.barLabel}>{b.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ── Category Progress ────────────────────────────────────────
function CategoryRow({ label, pct, color }) {
    return (
        <View style={C.catRow}>
            <View style={C.catLabelRow}>
                <Text style={C.catLabel}>{label}</Text>
                <Text style={C.catPct}>{pct}%</Text>
            </View>
            <View style={C.catTrack}>
                <View style={[C.catFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

// ── Top Product Row ───────────────────────────────────────────
function TopProductRow({ rank, name, units, revenue, trend }) {
    const icons = ['laptop-outline', 'phone-portrait-outline', 'headset-outline', 'cube-outline', 'cart-outline'];
    return (
        <View style={C.prodRow}>
            <View style={C.prodIcon}>
                <Ionicons name={icons[rank % icons.length]} size={20} color="#2563EB" />
            </View>
            <View style={C.prodInfo}>
                <Text style={C.prodName} numberOfLines={1}>{name}</Text>
                <Text style={C.prodUnits}>{units} đơn vị đã bán</Text>
            </View>
            <View style={C.prodRight}>
                <Text style={C.prodRevenue}>{fmtShort(revenue)}</Text>
                {trend !== undefined && (
                    <View style={C.trendRow}>
                        <Ionicons
                            name={trend >= 0 ? 'trending-up' : 'trending-down'}
                            size={11}
                            color={trend >= 0 ? '#10B981' : '#EF4444'}
                        />
                        <Text style={[C.trendText, { color: trend >= 0 ? '#10B981' : '#EF4444' }]}>
                            {Math.abs(trend)}%
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function RevenueScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const insets = useSafeAreaInsets();
    const role = getRole(userDetail);
    const isAdmin = role === 'admin';

    const [period, setPeriod] = useState('monthly');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    // ── Fetch data ────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            let phones = [];
            if (isAdmin) {
                const snap = await getDocs(collection(db, 'customers'));
                phones = snap.docs.map(d => d.data().phone).filter(Boolean);
            } else {
                const snap = await getDocs(
                    query(collection(db, 'customers'), where('createdBy', '==', userDetail.email))
                );
                phones = snap.docs.map(d => d.data().phone).filter(Boolean);
            }

            const allOrders = [];
            await Promise.all(phones.slice(0, 100).map(async (phone) => {
                try {
                    const snap = await getDoc(doc(db, 'orders', phone));
                    if (!snap.exists()) return;
                    (snap.data().orders || []).forEach(o => allOrders.push(o));
                } catch (_) { }
            }));
            allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setOrders(allOrders);

            // Top products
            const productMap = new Map();
            allOrders.filter(o => o.status !== 'Đã hủy').forEach(o => {
                (o.items || []).forEach(item => {
                    const key = item.name;
                    if (!productMap.has(key)) productMap.set(key, { name: key, units: 0, revenue: 0 });
                    const p = productMap.get(key);
                    p.units += item.qty || 1;
                    p.revenue += (item.price || 0) * (item.qty || 1);
                });
            });
            const top = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
            setTopProducts(top);

            // Leaderboard (admin)
            if (isAdmin) {
                const snap = await getDocs(query(collection(db, 'users'), where('verified', '==', true)));
                const board = snap.docs.map(d => d.data())
                    .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin' && (u.revenueTotal || 0) > 0)
                    .sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0))
                    .slice(0, 5);
                setLeaderboard(board);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userDetail?.email, isAdmin]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
    const handleRefresh = () => { setRefreshing(true); fetchData(); };

    // ── Compute stats ─────────────────────────────────────────
    const activeOrders = orders.filter(o => o.status !== 'Đã hủy');
    const totalRevenue = activeOrders.reduce((s, o) =>
        s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
    const totalCount = activeOrders.length;
    const avgValue = totalCount > 0 ? totalRevenue / totalCount : 0;

    // Growth vs previous period
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthRev = activeOrders.filter(o => (o.createdAt || '').startsWith(thisMonthKey))
        .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
    const lastMonthRev = activeOrders.filter(o => (o.createdAt || '').startsWith(lastMonthKey))
        .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
    const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : null;

    // ── Bar chart data by period ──────────────────────────────
    const buildBars = () => {
        if (period === 'weekly') {
            // 4 tuần trong tháng hiện tại
            const bars = [1, 2, 3, 4].map(w => ({ label: `TUẦN ${w}`, amount: 0 }));
            activeOrders.filter(o => (o.createdAt || '').startsWith(thisMonthKey)).forEach(o => {
                const day = parseInt((o.createdAt || '').split('-')[2]) || 1;
                const week = Math.min(Math.ceil(day / 7) - 1, 3);
                bars[week].amount += (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
            });
            return bars;
        }
        if (period === 'monthly') {
            return Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const amt = activeOrders.filter(o => (o.createdAt || '').startsWith(key))
                    .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
                return { label: `T${d.getMonth() + 1}`, amount: amt };
            });
        }
        if (period === 'yearly') {
            return Array.from({ length: 4 }, (_, i) => {
                const yr = now.getFullYear() - 3 + i;
                const amt = activeOrders.filter(o => (o.createdAt || '').startsWith(String(yr)))
                    .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
                return { label: String(yr), amount: amt };
            });
        }
        // daily — 7 ngày gần nhất
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const amt = activeOrders.filter(o => (o.createdAt || '').startsWith(key))
                .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
            return { label: `T${d.getDate()}`, amount: amt };
        });
    };
    const bars = buildBars();

    // ── Category breakdown (mock based on order types) ────────
    const buon = activeOrders.filter(o => o.orderType === 'buon').length;
    const le = activeOrders.filter(o => o.orderType === 'le').length;
    const total = buon + le || 1;
    const categories = [
        { label: 'Đơn buôn (Wholesale)', pct: Math.round(buon / total * 100), color: '#1E3A8A' },
        { label: 'Đơn lẻ (Retail)', pct: Math.round(le / total * 100), color: '#3B82F6' },
        { label: 'Dịch vụ khác', pct: Math.max(100 - Math.round(buon / total * 100) - Math.round(le / total * 100), 0), color: '#93C5FD' },
    ].filter(c => c.pct > 0);

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }]}>
            <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* ── Header ── */}
                <View style={S.header}>
                    <Text style={S.headerTitle}>Báo cáo doanh thu</Text>
                    <TouchableOpacity style={S.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
                        <Ionicons name="refresh-outline" size={17} color="#2563EB" />
                    </TouchableOpacity>
                </View>

                {/* ── Period tabs ── */}
                <View style={S.periodRow}>
                    {PERIODS.map(p => (
                        <TouchableOpacity
                            key={p.key}
                            style={[S.periodTab, period === p.key && S.periodTabActive]}
                            onPress={() => setPeriod(p.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[S.periodLabel, period === p.key && S.periodLabelActive]}>
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View style={S.loadWrap}>
                        <ActivityIndicator size="large" color="#2563EB" />
                        <Text style={S.loadText}>Đang tải...</Text>
                    </View>
                ) : (<>

                    {/* ── Hero revenue card ── */}
                    <View style={S.heroCard}>
                        <Text style={S.heroLabel}>Tổng doanh thu</Text>
                        <View style={S.heroRow}>
                            <Text style={S.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                                {fmt(totalRevenue)}
                            </Text>
                            {growth !== null && (
                                <View style={[S.growthBadge, parseFloat(growth) >= 0 ? S.growthPos : S.growthNeg]}>
                                    <Ionicons
                                        name={parseFloat(growth) >= 0 ? 'trending-up' : 'trending-down'}
                                        size={12}
                                        color={parseFloat(growth) >= 0 ? '#10B981' : '#EF4444'}
                                    />
                                    <Text style={[S.growthText, { color: parseFloat(growth) >= 0 ? '#10B981' : '#EF4444' }]}>
                                        {parseFloat(growth) >= 0 ? '+' : ''}{growth}%
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── Mini stats ── */}
                    <View style={S.miniRow}>
                        <View style={S.miniCard}>
                            <Text style={S.miniLabel}>Số lượng bán</Text>
                            <Text style={S.miniValue}>{totalCount.toLocaleString()}</Text>
                            {growth !== null && (
                                <Text style={[S.miniSub, { color: parseFloat(growth) >= 0 ? '#10B981' : '#EF4444' }]}>
                                    {parseFloat(growth) >= 0 ? '+' : ''}{growth}% so với tháng trước
                                </Text>
                            )}
                        </View>
                        <View style={S.miniCard}>
                            <Text style={S.miniLabel}>Giá trị TB/đơn</Text>
                            <Text style={S.miniValue}>{fmtShort(avgValue)}</Text>
                            <Text style={S.miniSub}>trên mỗi đơn hàng</Text>
                        </View>
                    </View>

                    {/* ── Bar chart ── */}
                    <View style={S.card}>
                        <View style={S.cardHeaderRow}>
                            <Text style={S.cardTitle}>Xu hướng doanh thu</Text>
                            <Text style={S.cardPeriodTag}>
                                {PERIODS.find(p => p.key === period)?.label.replace('\n', ' ')}
                            </Text>
                        </View>
                        <BarChart bars={bars} period={period} />
                    </View>

                    {/* ── Category breakdown ── */}
                    <View style={S.card}>
                        <Text style={S.cardTitle}>Phân loại danh mục</Text>
                        {categories.map(cat => (
                            <CategoryRow key={cat.label} {...cat} />
                        ))}
                    </View>

                    {/* ── Top products ── */}
                    {topProducts.length > 0 && (
                        <View style={[S.card, { marginBottom: 8 }]}>
                            <Text style={S.cardTitle}>Sản phẩm hàng đầu</Text>
                            {topProducts.map((p, i) => (
                                <TopProductRow
                                    key={p.name}
                                    rank={i}
                                    name={p.name}
                                    units={p.units}
                                    revenue={p.revenue}
                                    trend={i === 0 ? 4 : i === 1 ? 2 : i === 2 ? -1 : undefined}
                                />
                            ))}
                        </View>
                    )}

                    {/* ── Leaderboard (admin) ── */}
                    {isAdmin && leaderboard.length > 0 && (
                        <View style={S.card}>
                            <Text style={S.cardTitle}>🏆 Top doanh số</Text>
                            {leaderboard.map((u, i) => (
                                <View key={u.email} style={S.leaderRow}>
                                    <View style={[S.rankBadge,
                                    i === 0 && { backgroundColor: '#F59E0B' },
                                    i === 1 && { backgroundColor: '#94A3B8' },
                                    i === 2 && { backgroundColor: '#CD7F32' },
                                    ]}>
                                        <Text style={S.rankText}>{i + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={S.leaderName}>{u.name || u.email}</Text>
                                        <Text style={S.leaderEmail}>{u.email}</Text>
                                    </View>
                                    <Text style={S.leaderRevenue}>{fmt(u.revenueTotal)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {orders.length === 0 && (
                        <View style={S.empty}>
                            <Ionicons name="bar-chart-outline" size={40} color="#CBD5E1" />
                            <Text style={S.emptyTitle}>Chưa có dữ liệu</Text>
                            <Text style={S.emptySub}>Dữ liệu sẽ hiển thị khi có đơn hàng</Text>
                        </View>
                    )}

                </>)}

                <View style={{ height: isWeb ? 32 : 100 }} />
            </ScrollView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FF' },
    watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.04 },
    scroll: { paddingHorizontal: isWeb ? 40 : 20, paddingTop: isWeb ? 28 : 16 },
    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    headerTitle: { fontSize: isWeb ? 26 : 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    // Period tabs
    periodRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 6, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    periodTab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    periodTabActive: { backgroundColor: '#1E3A8A' },
    periodLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textAlign: 'center', lineHeight: 16 },
    periodLabelActive: { color: '#FFFFFF', fontWeight: '700' },
    // Load
    loadWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    loadText: { fontSize: 14, color: '#94A3B8' },
    // Hero card
    heroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, marginBottom: 14, shadowColor: '#1E3A8A', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
    heroLabel: { fontSize: 13, color: '#64748B', marginBottom: 8, fontWeight: '500' },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    heroValue: { fontSize: isWeb ? 36 : 30, fontWeight: '900', color: '#0F172A', letterSpacing: -1, flex: 1 },
    growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    growthPos: { backgroundColor: '#ECFDF5' },
    growthNeg: { backgroundColor: '#FEF2F2' },
    growthText: { fontSize: 12, fontWeight: '700' },
    // Mini stats
    miniRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    miniCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    miniLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: '500' },
    miniValue: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
    miniSub: { fontSize: 10, color: '#94A3B8', lineHeight: 14 },
    // Cards
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    cardPeriodTag: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
    // Bar chart
    chartWrap: {},
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 8 },
    barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barAmt: { fontSize: 8, color: '#64748B', marginBottom: 3, textAlign: 'center' },
    barTrack: { width: '60%', height: '85%', backgroundColor: '#F1F5F9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 6 },
    barFillHigh: { backgroundColor: '#1E3A8A' },
    barFillNormal: { backgroundColor: '#93C5FD' },
    barLabel: { fontSize: 9, color: '#64748B', marginTop: 6, fontWeight: '700', textAlign: 'center' },
    // Category
    catRow: { marginBottom: 14 },
    catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    catLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
    catPct: { fontSize: 13, color: '#374151', fontWeight: '700' },
    catTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
    catFill: { height: '100%', borderRadius: 4 },
    // Top products
    prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    prodIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    prodInfo: { flex: 1 },
    prodName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    prodUnits: { fontSize: 11, color: '#94A3B8' },
    prodRight: { alignItems: 'flex-end', gap: 3 },
    prodRevenue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    trendText: { fontSize: 11, fontWeight: '600' },
    // Leaderboard
    leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    leaderName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    leaderEmail: { fontSize: 11, color: '#94A3B8' },
    leaderRevenue: { fontSize: 13, fontWeight: '700', color: '#10B981' },
    // Empty
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
    emptySub: { fontSize: 13, color: '#94A3B8' },
});

const C = StyleSheet.create({
    chartWrap: {},
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 8 },
    barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    barAmt: { fontSize: 8, color: '#64748B', marginBottom: 3, textAlign: 'center' },
    barTrack: { width: '65%', height: '85%', backgroundColor: '#F1F5F9', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 6 },
    barFillHigh: { backgroundColor: '#1E3A8A' },
    barFillNormal: { backgroundColor: '#93C5FD' },
    barLabel: { fontSize: 9, color: '#64748B', marginTop: 6, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },
    catRow: { marginBottom: 14 },
    catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    catLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
    catPct: { fontSize: 13, color: '#374151', fontWeight: '700' },
    catTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
    catFill: { height: '100%', borderRadius: 4 },
    prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    prodIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    prodInfo: { flex: 1 },
    prodName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    prodUnits: { fontSize: 11, color: '#94A3B8' },
    prodRight: { alignItems: 'flex-end', gap: 3 },
    prodRevenue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    trendText: { fontSize: 11, fontWeight: '600' },
});