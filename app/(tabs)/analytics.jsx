import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useCustomers } from '../../components/Hooks/useCustomers'; // adjust path as needed
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const { width: SCREEN_W } = Dimensions.get('window');

// ── Quarter helpers ───────────────────────────────────────────
const getCurrentQuarter = () => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
};
const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};
const isThisQuarter = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const qKey = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    return qKey === getCurrentQuarter();
};
const getWeekLabel = (weeksAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7);
    return `T${d.getDate()}/${d.getMonth() + 1}`;
};

const fmt = (n) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};
const fmtVND = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const PERIOD_TABS = [
    { key: 'day', label: 'THEO NGÀY' },
    { key: 'week', label: 'THEO TUẦN' },
    { key: 'month', label: 'THEO THÁNG' },
    { key: 'now', label: 'TẤT CẢ' },
];

// ── Mini Line Chart (SVG) ────────────────────────────────────
function MiniChart({ data, color = '#4A9EFF', height = 120, width }) {
    if (!data || data.length < 2) return null;
    const w = width || (isWeb ? 500 : SCREEN_W - 64);
    const h = height;
    const pad = 8;
    const max = Math.max(...data.map(d => d.value), 1);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = max - min || 1;
    const step = (w - pad * 2) / (data.length - 1);

    const pts = data.map((d, i) => ({
        x: pad + i * step,
        y: pad + (h - pad * 2) * (1 - (d.value - min) / range),
    }));

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;

    if (Platform.OS === 'web') {
        return (
            <svg width={w} height={h} style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={areaD} fill="url(#areaGrad)" />
                <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
                ))}
            </svg>
        );
    }
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4, paddingHorizontal: pad }}>
            {data.map((d, i) => {
                const barH = Math.max(4, ((d.value - min) / range) * (height - 20));
                return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <View style={{ width: '60%', height: barH, backgroundColor: color, borderRadius: 3, opacity: 0.85 }} />
                    </View>
                );
            })}
        </View>
    );
}

// ── Progress Bar ─────────────────────────────────────────────
function ProgressBar({ pct, color }) {
    return (
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function RevenueAnalyticsScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);

    // ✅ Use the shared hook — respects role-based access automatically
    const { customers, loading: customersLoading } = useCustomers();

    const [period, setPeriod] = useState('month');
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    // ── Fetch orders whenever customers list changes ─────────
    useEffect(() => {
        if (customersLoading) return;           // wait for customers to load first
        if (customers.length === 0) return;

        const fetchOrders = async () => {
            setOrdersLoading(true);
            try {
                const phones = customers.map(c => c.phone).filter(Boolean);
                const all = [];
                for (const phone of phones) {
                    try {
                        const snap = await getDoc(doc(db, 'orders', phone));
                        if (snap.exists()) {
                            (snap.data().orders || []).forEach(o => all.push(o));
                        }
                    } catch (_) { }
                }
                setOrders(all);
            } catch (e) {
                console.error('fetchOrders error:', e);
            } finally {
                setOrdersLoading(false);
            }
        };

        fetchOrders();
    }, [customers, customersLoading]);

    const loading = customersLoading || ordersLoading;

    // ── Filter by period ────────────────────────────────────────
    const filterOrders = (list) => {
        switch (period) {
            case 'ngày': return list.filter(o => o.createdAt && new Date(o.createdAt).toDateString() === new Date().toDateString());
            case 'tuần': return list.filter(o => { const d = new Date(o.createdAt); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w; });
            case 'tháng': return list.filter(o => isThisMonth(o.createdAt));
            case 'tất cả thời gian': return list.filter(o => isThisQuarter(o.createdAt));
            default: return list;
        }
    };

    const filtered = filterOrders(orders);

    const totalRevenue = filtered.reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + p.price * p.qty, 0), 0);
    const totalOrders = filtered.length;
    const completedOrders = filtered.filter(o => o.status === 'COMPLETED' || o.status === 'CONFIRMED').length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Revenue vs prev period delta
    const prevFiltered = period === 'month'
        ? orders.filter(o => {
            const d = new Date(o.createdAt || 0);
            const p = new Date(); p.setMonth(p.getMonth() - 1);
            return d.getMonth() === p.getMonth() && d.getFullYear() === p.getFullYear();
        })
        : [];
    const prevRevenue = prevFiltered.reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + p.price * p.qty, 0), 0);
    const delta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const deltaPos = delta >= 0;

    // Weekly chart data (last 5 weeks)
    const chartData = Array.from({ length: 5 }, (_, i) => {
        const ago = 4 - i;
        const start = new Date(); start.setDate(start.getDate() - ago * 7 - 6);
        const end = new Date(); end.setDate(end.getDate() - ago * 7);
        const val = orders
            .filter(o => { const d = new Date(o.createdAt || 0); return d >= start && d <= end; })
            .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + p.price * p.qty, 0), 0);
        return { label: getWeekLabel(ago), value: val };
    });

    // Category performance (by status)
    const categories = [
        { label: 'Đã hoàn thành', count: filtered.filter(o => o.status === 'COMPLETED').length, color: '#4A9EFF' },
        { label: 'Lắp đặt', count: filtered.filter(o => o.status === 'SHIPPED').length, color: '#A78BFA' },
        { label: 'Chờ xử lý', count: filtered.filter(o => o.status === 'PENDING').length, color: '#34D399' },
    ];
    const maxCat = Math.max(...categories.map(c => c.count), 1);

    // Top customers
    const topCustomers = Object.entries(
        filtered.reduce((acc, o) => {
            const key = o.customer || '?';
            const val = (o.items || []).reduce((s, p) => s + p.price * p.qty, 0);
            acc[key] = (acc[key] || 0) + val;
            return acc;
        }, {})
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, revenue]) => ({ name, revenue }));

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0A0F2C', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#4A9EFF" size="large" />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Header */}
                <View style={styles.header}>
                    {!isWeb && (
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="#FFF" />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerSub}>TỔNG QUAN</Text>
                        <Text style={styles.headerTitle}>BÁO CÁO TÀI CHÍNH</Text>
                    </View>
                    <View style={styles.headerAvatar}>
                        <Text style={styles.headerAvatarText}>
                            {(userDetail?.name || 'U').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                    </View>
                </View>

                {/* Period tabs */}
                <View style={styles.periodTabs}>
                    {PERIOD_TABS.map(t => (
                        <TouchableOpacity
                            key={t.key}
                            style={[styles.periodTab, period === t.key && styles.periodTabActive]}
                            onPress={() => setPeriod(t.key)}
                        >
                            <Text style={[styles.periodTabText, period === t.key && styles.periodTabTextActive]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Total Revenue hero */}
                <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>Tổng doanh thu</Text>
                    <View style={styles.heroRow}>
                        <Text style={styles.heroAmount}>{fmt(totalRevenue)}</Text>
                        <View style={[styles.deltaBadge, { backgroundColor: deltaPos ? '#16A34A22' : '#DC262622' }]}>
                            <Ionicons name={deltaPos ? 'trending-up' : 'trending-down'} size={14} color={deltaPos ? '#4ADE80' : '#F87171'} />
                            <Text style={[styles.deltaText, { color: deltaPos ? '#4ADE80' : '#F87171' }]}>
                                {delta === 0 ? '—' : `${deltaPos ? '+' : ''}${delta.toFixed(1)}%`}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNum}>{totalOrders}</Text>
                            <Text style={styles.statLbl}>Đơn hàng</Text>
                            <Text style={styles.statPeriod}>Trong {period === 'month' ? 'Tháng' : period}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNum}>{fmtVND(avgOrderValue)}</Text>
                            <Text style={styles.statLbl}>Giá trị trung bình</Text>
                            <Text style={styles.statPeriod}>Mỗi Đơn hàng</Text>
                        </View>
                    </View>

                    <View style={styles.premiumBadge}>
                        <Ionicons name="trophy-outline" size={13} color="#F59E0B" />
                        <Text style={styles.premiumText}>
                            {totalRevenue >= 500_000_000 ? 'Bậc Kim Cương' :
                                totalRevenue >= 200_000_000 ? 'Bậc Vàng' :
                                    totalRevenue >= 100_000_000 ? 'Bậc Bạc' :
                                        totalRevenue >= 50_000_000 ? 'Bậc Đồng' : 'Doanh nghiệp mới'}
                        </Text>
                    </View>
                </View>

                {/* Revenue Trends chart */}
                <View style={styles.card}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle}>Xu hướng doanh thu</Text>
                        <View style={styles.legendRow}>
                            <View style={styles.legendDot} /><Text style={styles.legendText}>Hiện nay</Text>
                            <View style={[styles.legendDot, { backgroundColor: '#A78BFA' }]} /><Text style={styles.legendText}>Khách hàng</Text>
                        </View>
                    </View>
                    <MiniChart data={chartData} color="#4A9EFF" height={130} />
                    <View style={styles.chartLabels}>
                        {chartData.map((d, i) => (
                            <Text key={i} style={styles.chartLabel}>{d.label}</Text>
                        ))}
                    </View>
                </View>

                {/* Category Performance */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Báo cáo doanh thu</Text>
                    {categories.map((cat, i) => (
                        <View key={i} style={styles.catRow}>
                            <View style={styles.catInfo}>
                                <Text style={styles.catLabel}>{cat.label}</Text>
                                <Text style={styles.catCount}>{cat.count} đơn</Text>
                            </View>
                            <View style={styles.catBarWrap}>
                                <ProgressBar pct={maxCat > 0 ? (cat.count / maxCat) * 100 : 0} color={cat.color} />
                            </View>
                            <Text style={[styles.catPct, { color: cat.color }]}>
                                {totalOrders > 0 ? `${Math.round(cat.count / totalOrders * 100)}%` : '0%'}
                            </Text>
                        </View>
                    ))}
                    <View style={styles.insightBox}>
                        <Ionicons name="bulb-outline" size={15} color="#F59E0B" />
                        <Text style={styles.insightText}>
                            {completedOrders > 0
                                ? `Tỉ lệ hoàn thành ${Math.round(completedOrders / totalOrders * 100)}% trong kỳ này. ${deltaPos ? 'Tăng trưởng tốt so với kỳ trước!' : 'Cần cải thiện so với kỳ trước.'}`
                                : 'Chưa có đơn hoàn thành trong kỳ này.'}
                        </Text>
                    </View>
                </View>

                {/* Top Customers */}
                <View style={styles.card}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle}>Khách hàng tiềm năng</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/customer')}>
                            <Text style={styles.viewAllText}>Xem tất cả</Text>
                        </TouchableOpacity>
                    </View>
                    {topCustomers.length === 0 ? (
                        <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
                    ) : topCustomers.map((c, i) => (
                        <View key={i} style={styles.topRow}>
                            <View style={[styles.topRank, { backgroundColor: ['#b24876', '#fd5274', '#ff8d73'][i] + '22' }]}>
                                <Text style={[styles.topRankText, { color: ['#b24876', '#fd5274', '#ff8d73'][i] }]}>
                                    #{i + 1}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.topName}>{c.name}</Text>
                                <Text style={styles.topSub}>{((c.revenue / (totalRevenue || 1)) * 100).toFixed(0)}% of total</Text>
                            </View>
                            <Text style={styles.topRevenue}>{fmtVND(c.revenue)}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: isWeb ? 32 : 100 }} />
            </ScrollView>
        </View>
    );
}

// styles unchanged — paste your original StyleSheet here
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#fff' },
    scroll: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 24 : 52 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7ca9bd', alignItems: 'center', justifyContent: 'center' },
    headerSub: { fontSize: 10, color: '#7ca9bd', letterSpacing: 1.5, fontWeight: '700', marginBottom: 3 },
    headerTitle: { fontSize: isWeb ? 26 : 22, fontWeight: '900', color: '#7ca9bd', letterSpacing: -0.3 },
    headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    headerAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
    periodTabs: { flexDirection: 'row', backgroundColor: '#7ca9bd', borderRadius: 10, padding: 3, marginBottom: 20, gap: 2 },
    periodTab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
    periodTabActive: { backgroundColor: '#2563EB' },
    periodTabText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    periodTabTextActive: { color: '#FFFFFF' },
    heroCard: { backgroundColor: '#7ca9bd', borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#7ca9bd' },
    heroLabel: { fontSize: 10, color: '#fff', letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    heroAmount: { fontSize: isWeb ? 44 : 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
    deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
    deltaText: { fontSize: 12, fontWeight: '700' },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    statItem: { flex: 1 },
    statDivider: { width: 1, height: 40, backgroundColor: '#7ca9bd', marginHorizontal: 16 },
    statNum: { fontSize: isWeb ? 24 : 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
    statLbl: { fontSize: 10, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
    statPeriod: { fontSize: 10, color: '#fff' },
    premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    premiumText: { fontSize: 11, color: '#7ca9bd', fontWeight: '800', letterSpacing: 0.5 },
    card: { backgroundColor: '#7ca9bd', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#7ca9bd' },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 0 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4A9EFF' },
    legendText: { fontSize: 11, color: '#fff', marginRight: 6 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    chartLabel: { fontSize: 10, color: '#fff', textAlign: 'center', flex: 1 },
    catRow: { marginBottom: 14 },
    catInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    catLabel: { fontSize: 12, color: '#fff', fontWeight: '500' },
    catCount: { fontSize: 12, color: '#fff' },
    catBarWrap: { marginBottom: 3 },
    catPct: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
    insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#65c1d6', borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: '#fff' },
    insightText: { flex: 1, fontSize: 12, color: '#fff', lineHeight: 17 },
    viewAllText: { fontSize: 11, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    topRank: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    topRankText: { fontSize: 12, fontWeight: '800' },
    topName: {
        fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2
    },
    topSub: { fontSize: 11, color: '#fff' },
    topRevenue: { fontSize: 13, fontWeight: '700', color: '#4ADE80' },
    emptyText: { fontSize: 13, color: '#fff', textAlign: 'center', paddingVertical: 16 },
});