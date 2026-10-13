// app/(tabs)/analytics.jsx — Báo cáo doanh thu (redesign) responsive
import TabScreenLayout, { useLayout } from '@/components/Main/TabScreenLayout';
import { THEME } from '@/components/Styles/theme';
import { productItems, productTotal } from '@/components/Utils/orderItems';
import { getRole, isAdminOrGD } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { db } from '../../config/firebaseConfig';


const fmt = n => (n || 0).toLocaleString('vi-VN') + ' đ';
const fmtShort = n => {
    if (!n) return '0';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
};

const pad2 = n => String(n).padStart(2, '0');
const monthKey = (y, m) => `${y}-${pad2(m)}`;   // m: 1..12

// 'YYYY-MM' của 1 mốc thời gian. Chuỗi ngày thuần ('2026-10-07') cắt thẳng; chuỗi có giờ
// (ISO, lưu theo UTC) phải đổi về giờ máy, nếu không đơn trả lúc rạng sáng mùng 1 bị tính
// vào tháng trước.
const ymOf = (v) => {
    const s = String(v || '');
    if (s.length <= 10) return s.slice(0, 7);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s.slice(0, 7) : monthKey(d.getFullYear(), d.getMonth() + 1);
};
const fmtDate = (v) => {
    const s = String(v || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
};

const PAID = 'Đã thanh toán';
const WAITING = 'Chờ thanh toán';
const sumOf = (list) => list.reduce((s, o) => s + productTotal(o), 0);

const TYPE_LABEL = { buon: 'Đơn buôn', le: 'Đơn lẻ' };

const PERIODS = [
    { key: 'monthly', label: 'Theo tháng' },
    { key: 'quarterly', label: 'Theo quý' },
    { key: 'yearly', label: 'Theo năm' },
];
// Kỳ báo cáo đánh số liên tục để lùi/tiến bằng ±1: tháng = năm*12 + (tháng-1),
// quý = năm*4 + (quý-1), năm = năm.
const periodIndex = (period, d) => {
    const y = d.getFullYear(), m = d.getMonth();
    if (period === 'monthly') return y * 12 + m;
    if (period === 'quarterly') return y * 4 + Math.floor(m / 3);
    return y;
};
// → { label, year, has(ym) } với ym dạng 'YYYY-MM'
const rangeOf = (period, idx) => {
    if (period === 'monthly') {
        const y = Math.floor(idx / 12), m = idx % 12 + 1;
        const key = monthKey(y, m);
        return { label: `Tháng ${m}/${y}`, year: y, has: ym => ym === key };
    }
    if (period === 'quarterly') {
        const y = Math.floor(idx / 4), q = idx % 4;
        const keys = [1, 2, 3].map(i => monthKey(y, q * 3 + i));
        return { label: `Quý ${q + 1}/${y}`, year: y, has: ym => keys.includes(ym) };
    }
    return { label: `Năm ${idx}`, year: idx, has: ym => ym.startsWith(`${idx}-`) };
};
const PREV_LABEL = { monthly: 'tháng trước', quarterly: 'quý trước', yearly: 'năm trước' };

const TX_FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'paid', label: 'Đã thanh toán' },
    { key: 'pending', label: 'Chờ thanh toán' },
];
const TX_PAGE = 10;

function BarChart({ bars, showAllValues, onSelect }) {
    if (!bars?.length) return null;
    const max = Math.max(...bars.map(b => b.v), 1);
    return (
        <View style={A.chart}>
            {bars.map((b, i) => {
                const pct = Math.max((b.v / max) * 100, 3);
                const isMax = b.v === max && max > 0;
                return (
                    <TouchableOpacity key={i} style={A.chartCol} activeOpacity={0.7} onPress={() => onSelect?.(b)}>
                        {/* Nhiều cột trên màn hẹp thì số chồng lên nhau — chỉ ghi số ở cột đang chọn và cột cao nhất */}
                        <Text style={[A.chartValue, b.current && A.chartValueMax]} numberOfLines={1}>
                            {b.v > 0 && (showAllValues || isMax || b.current) ? fmtShort(b.v) : ' '}
                        </Text>
                        <View style={A.chartTrack}>
                            <View style={[A.chartFill, { height: `${pct}%`, backgroundColor: b.current ? '#1E3A8A' : '#93C5FD' }]} />
                        </View>
                        <Text style={[A.chartLabel, b.current && A.chartLabelCurrent]}>{b.l}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

function StatCard({ icon, color, bg, label, value, sub, subColor, style }) {
    return (
        <View style={[A.topCard, style]}>
            <View style={A.topCardHead}>
                <View style={[A.topCardIcon, { backgroundColor: bg }]}>
                    <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={A.topCardLabel} numberOfLines={2}>{label}</Text>
            </View>
            <Text style={[A.topCardValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={[A.topCardSub, subColor && { color: subColor }]} numberOfLines={1}>{sub}</Text>
        </View>
    );
}

function StatusBadge({ status }) {
    const isPaid = status === PAID;
    return (
        <View style={[A.sBadge, { backgroundColor: isPaid ? '#ECFDF5' : '#FFFBEB' }]}>
            <View style={[A.sDot, { backgroundColor: isPaid ? '#16A34A' : '#D97706' }]} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: isPaid ? '#16A34A' : '#D97706' }}>{status}</Text>
        </View>
    );
}

export default function AnalyticsScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const fullAccess = isAdminOrGD(role);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [userNames, setUserNames] = useState({});   // email → tên, cho cột "Người bán"
    // Kỳ báo cáo quyết định số liệu của MỌI mục trên màn, không riêng biểu đồ
    const [period, setPeriod] = useState('monthly'); // 'monthly'|'quarterly'|'yearly'
    const [offset, setOffset] = useState(0);         // 0 = kỳ hiện tại, -1 = kỳ trước...
    const [txFilter, setTxFilter] = useState('all');
    const [txLimit, setTxLimit] = useState(TX_PAGE);
    const { isDesktop } = useLayout();
    const nowIdx = periodIndex(period, new Date());
    const idx = nowIdx + offset;
    const cur = useMemo(() => rangeOf(period, idx), [period, idx]);
    const prev = useMemo(() => rangeOf(period, idx - 1), [period, idx]);
    const changePeriod = (p) => { setPeriod(p); setOffset(0); setTxLimit(TX_PAGE); };
    const shiftPeriod = (d) => { setOffset(o => o + d); setTxLimit(TX_PAGE); };
    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            let ordersSnap;
            if (fullAccess) {
                ordersSnap = await getDocs(collection(db, 'orders'));
            } else {
                // Lấy team emails
                const lvl2Snap = await getDocs(
                    query(collection(db, 'users'), where('advisor', '==', userDetail.email))
                );
                const lvl2Emails = lvl2Snap.docs.map(d => d.data().email).filter(Boolean);
                const names = {};
                lvl2Snap.docs.forEach(d => { const u = d.data(); if (u.email) names[u.email] = u.name; });

                let lvl3Emails = [];
                for (let i = 0; i < lvl2Emails.length; i += 30) {
                    const chunk = lvl2Emails.slice(i, i + 30);
                    const s = await getDocs(query(collection(db, 'users'), where('advisor', 'in', chunk)));
                    s.docs.forEach(d => {
                        const u = d.data();
                        if (u.email) { lvl3Emails.push(u.email); names[u.email] = u.name; }
                    });
                }
                setUserNames(names);

                const teamEmails = [...new Set([userDetail.email, ...lvl2Emails, ...lvl3Emails])];

                // Fetch orders theo teamEmails, chia chunk 30
                const allDocs = [];
                for (let i = 0; i < teamEmails.length; i += 30) {
                    const chunk = teamEmails.slice(i, i + 30);
                    const s = await getDocs(
                        query(collection(db, 'orders'), where('createdBy', 'in', chunk))
                    );
                    s.docs.forEach(d => allDocs.push({ ...d.data(), docId: d.id }));
                }
                // Lọc chờ thanh toán + đã thanh toán
                const filtered = allDocs.filter(o =>
                    ['Chờ thanh toán', 'Đã thanh toán'].includes(o.status)
                );
                setOrders(filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));

                // Leaderboard chỉ cho admin → skip
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // Admin: lấy tất cả, lọc status
            const allDocs = ordersSnap.docs
                .map(d => ({ ...d.data(), docId: d.id }))
                .filter(o => ['Chờ thanh toán', 'Đã thanh toán'].includes(o.status));

            setOrders(allDocs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));

            // Leaderboard cho admin
            const snap = await getDocs(query(collection(db, 'users'), where('verified', '==', true)));
            const names = {};
            snap.docs.forEach(d => { const u = d.data(); if (u.email) names[u.email] = u.name; });
            setUserNames(names);
            // Chỉ giữ danh sách người bán; doanh số xếp hạng tính theo kỳ đang chọn ở dưới
            setSellers(
                snap.docs.map(d => d.data())
                    .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin')
            );

        } catch (e) {
            console.error('fetchData error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userDetail?.email, fullAccess]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    // ── Đơn trong kỳ đang chọn ────────────────────────────────
    // Đơn thuộc kỳ theo createdAt; riêng tiền đã thu thì theo ngày thanh toán
    // (đơn cũ chưa có paymentDate → createdAt).
    const periodOrders = useMemo(() => orders.filter(o => cur.has(ymOf(o.createdAt))), [orders, cur]);
    const paidInPeriod = useMemo(() => orders.filter(o =>
        o.status === PAID && cur.has(ymOf(o.paymentDate || o.createdAt))
    ), [orders, cur]);

    const stats = useMemo(() => {
        const waitingOrders = periodOrders.filter(o => o.status === WAITING);
        const rev = sumOf(periodOrders);
        const prevRev = sumOf(orders.filter(o => prev.has(ymOf(o.createdAt))));
        return {
            rev, count: periodOrders.length,
            waiting: sumOf(waitingOrders), waitingCount: waitingOrders.length,
            paid: sumOf(paidInPeriod), paidCount: paidInPeriod.length,
            avg: periodOrders.length ? Math.round(rev / periodOrders.length) : 0,
            growth: prevRev > 0 ? (rev - prevRev) / prevRev * 100 : null,
        };
    }, [orders, periodOrders, paidInPeriod, prev]);

    const growthText = stats.growth == null
        ? `${stats.count} đơn · chưa có số ${PREV_LABEL[period]}`
        : `${stats.growth >= 0 ? '▲ +' : '▼ '}${stats.growth.toFixed(1)}% so với ${PREV_LABEL[period]} · ${stats.count} đơn`;

    // ── Biểu đồ: các kỳ cùng năm với kỳ đang chọn (theo năm: 4 năm tính tới kỳ đang chọn) ──
    const bars = useMemo(() => {
        const first = period === 'monthly' ? cur.year * 12
            : period === 'quarterly' ? cur.year * 4
                : idx - 3;
        const n = period === 'monthly' ? 12 : 4;
        return Array.from({ length: n }, (_, i) => {
            const r = rangeOf(period, first + i);
            return {
                idx: first + i,
                l: period === 'monthly' ? `T${i + 1}` : period === 'quarterly' ? `Quý ${i + 1}` : String(first + i),
                v: sumOf(orders.filter(o => r.has(ymOf(o.createdAt)))),
                current: first + i === idx,
            };
        });
    }, [orders, period, cur, idx]);
    const barsTotal = bars.reduce((s, b) => s + b.v, 0);

    // ── Lịch sử giao dịch ─────────────────────────────────────
    const txList = useMemo(() => periodOrders.filter(o =>
        txFilter === 'all' || (txFilter === 'paid' ? o.status === PAID : o.status === WAITING)
    ), [periodOrders, txFilter]);
    const txCount = { all: stats.count, paid: stats.count - stats.waitingCount, pending: stats.waitingCount };
    // Chỉ cần cột "Người bán" khi danh sách có đơn của người khác
    const showSeller = orders.some(o => o.createdBy && o.createdBy !== userDetail?.email);
    const sellerOf = (o) => userNames[o.createdBy] || o.createdBy?.split('@')[0] || '—';

    const { topProducts, productRevenue } = useMemo(() => {
        const map = new Map();
        periodOrders.forEach(o => productItems(o).forEach(p => {
            const k = p.name;
            if (!map.has(k)) map.set(k, { name: k, units: 0, revenue: 0 });
            const r = map.get(k); r.units += parseFloat(p.qty || 1); r.revenue += parseFloat(p.price || 0) * parseFloat(p.qty || 1);
        }));
        const all = [...map.values()].sort((a, b) => b.revenue - a.revenue);
        return { topProducts: all.slice(0, 5), productRevenue: all.reduce((s, p) => s + p.revenue, 0) };
    }, [periodOrders]);

    // Top doanh số trong kỳ: tiền đã thu, gom theo người bán
    const leaderboard = useMemo(() => {
        const rev = {};
        paidInPeriod.forEach(o => { rev[o.createdBy] = (rev[o.createdBy] || 0) + productTotal(o); });
        return sellers
            .map(u => ({ ...u, periodRevenue: rev[u.email] || 0 }))
            .filter(u => u.periodRevenue > 0)
            .sort((a, b) => b.periodRevenue - a.periodRevenue)
            .slice(0, 5);
    }, [sellers, paidInPeriod]);

    const showLeaderboard = fullAccess && leaderboard.length > 0;

    return loading ?
        (
            <TabScreenLayout>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            </TabScreenLayout>
        ) : (
            <TabScreenLayout>
                <ScrollView
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={[A.scroll, { padding: isDesktop ? THEME.spacing.xxl : THEME.spacing.lg }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                >
                    <View style={A.pageHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={[A.pageTitle, { fontSize: isDesktop ? 26 : 22 }]}>Báo cáo doanh thu</Text>
                            <Text style={A.pageSub}>Doanh thu sản phẩm của đơn chờ thanh toán và đã thanh toán, theo kỳ đang chọn</Text>
                        </View>
                        <View style={A.userBadge}>
                            <Ionicons name={fullAccess ? 'shield-checkmark-outline' : 'person-outline'} size={13} color="#2563EB" />
                            <Text style={A.userBadgeText} numberOfLines={1}>{fullAccess ? 'Toàn hệ thống' : (userDetail?.name || userDetail?.email || 'Của tôi')}</Text>
                        </View>
                    </View>

                    {/* Thanh chọn kỳ — áp dụng cho toàn bộ số liệu bên dưới */}
                    <View style={A.periodBar}>
                        <View style={A.pRow}>
                            {PERIODS.map(p => (
                                <TouchableOpacity key={p.key} style={[A.pBtn, period === p.key && A.pBtnActive]} onPress={() => changePeriod(p.key)}>
                                    <Text style={[A.pBtnText, period === p.key && A.pBtnTextActive]}>{p.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={A.periodNav}>
                            <TouchableOpacity style={A.navBtn} onPress={() => shiftPeriod(-1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="chevron-back" size={16} color="#1E3A8A" />
                            </TouchableOpacity>
                            <Text style={A.periodLabel}>{cur.label}</Text>
                            <TouchableOpacity style={A.navBtn} onPress={() => shiftPeriod(1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="chevron-forward" size={16} color="#1E3A8A" />
                            </TouchableOpacity>
                            {offset !== 0 && (
                                <TouchableOpacity style={A.todayBtn} onPress={() => shiftPeriod(-offset)}>
                                    <Text style={A.todayText}>Hiện tại</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Desktop: 4 thẻ 1 hàng · Mobile: lưới 2x2 */}
                    <View style={A.topCards}>
                        <StatCard
                            style={isDesktop ? A.topCardDesktop : A.topCardMobile}
                            icon="trending-up-outline" color="#2563EB" bg="#EFF6FF"
                            label="Doanh thu"
                            value={isDesktop ? fmt(stats.rev) : fmtShort(stats.rev)}
                            sub={growthText}
                            subColor={stats.growth == null ? undefined : stats.growth >= 0 ? '#10B981' : '#EF4444'}
                        />
                        <StatCard
                            style={isDesktop ? A.topCardDesktop : A.topCardMobile}
                            icon="checkmark-circle-outline" color="#16A34A" bg="#ECFDF5"
                            label="Đã thanh toán"
                            value={isDesktop ? fmt(stats.paid) : fmtShort(stats.paid)}
                            sub={`${stats.paidCount} đơn thu tiền trong kỳ`}
                        />
                        <StatCard
                            style={isDesktop ? A.topCardDesktop : A.topCardMobile}
                            icon="time-outline" color="#D97706" bg="#FFFBEB"
                            label="Chờ thanh toán"
                            value={isDesktop ? fmt(stats.waiting) : fmtShort(stats.waiting)}
                            sub={`${stats.waitingCount} đơn chưa thu tiền`}
                        />
                        <StatCard
                            style={isDesktop ? A.topCardDesktop : A.topCardMobile}
                            icon="receipt-outline" color="#0F172A" bg="#F1F5F9"
                            label="Trung bình mỗi đơn"
                            value={isDesktop ? fmt(stats.avg) : fmtShort(stats.avg)}
                            sub={`${stats.count} đơn trong kỳ`}
                        />
                    </View>

                    <View style={A.card}>
                        <View style={A.cardHead}>
                            <View style={{ flex: 1, minWidth: 160 }}>
                                <Text style={A.cardTitle}>Xu hướng doanh thu</Text>
                                <Text style={A.cardSub}>
                                    {period === 'yearly' ? `${idx - 3} – ${idx}` : `Năm ${cur.year}`} · Tổng {fmt(barsTotal)} · Bấm vào cột để xem kỳ đó
                                </Text>
                            </View>
                        </View>
                        <BarChart bars={bars} showAllValues={isDesktop || bars.length <= 4} onSelect={b => shiftPeriod(b.idx - idx)} />
                    </View>

                    <View style={A.card}>
                        <View style={A.cardHead}>
                            <View style={{ flex: 1, minWidth: 160 }}>
                                <Text style={A.cardTitle}>Lịch sử giao dịch</Text>
                                <Text style={A.cardSub}>{cur.label} · {txList.length} đơn · {fmt(sumOf(txList))}</Text>
                            </View>
                            <View style={A.pRow}>
                                {TX_FILTERS.map(f => (
                                    <TouchableOpacity key={f.key} style={[A.pBtn, txFilter === f.key && A.pBtnActive]} onPress={() => { setTxFilter(f.key); setTxLimit(TX_PAGE); }}>
                                        <Text style={[A.pBtnText, txFilter === f.key && A.pBtnTextActive]}>{f.label} ({txCount[f.key]})</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {txList.length === 0 ? (
                            <View style={A.empty}>
                                <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                                <Text style={A.emptyText}>Không có giao dịch trong {cur.label.toLowerCase()}</Text>
                            </View>
                        ) : isDesktop ? (
                            <>
                                <View style={A.tHead}>
                                    <Text style={[A.th, { flex: 1.2 }]}>Đơn hàng</Text>
                                    <Text style={[A.th, { flex: 1.4 }]}>Khách hàng</Text>
                                    {showSeller && <Text style={[A.th, { flex: 1.2 }]}>Người bán</Text>}
                                    <Text style={[A.th, { flex: 0.8 }]}>Loại đơn</Text>
                                    <Text style={[A.th, { flex: 1.1, textAlign: 'right' }]}>Giá trị</Text>
                                    <Text style={[A.th, { flex: 1.2, paddingLeft: 16 }]}>Trạng thái</Text>
                                </View>
                                {txList.slice(0, txLimit).map((o, i) => (
                                    <View key={o.docId || o.id || i} style={[A.tRow, i % 2 === 1 && { backgroundColor: '#FAFBFF' }]}>
                                        <View style={{ flex: 1.2 }}>
                                            <Text style={A.tId} numberOfLines={1}>#{o.id}</Text>
                                            <Text style={A.tDate}>{fmtDate(o.createdAt)}</Text>
                                        </View>
                                        <Text style={[A.td, { flex: 1.4 }]} numberOfLines={1}>{o.customer || '—'}</Text>
                                        {showSeller && <Text style={[A.td, { flex: 1.2 }]} numberOfLines={1}>{sellerOf(o)}</Text>}
                                        <Text style={[A.td, { flex: 0.8 }]} numberOfLines={1}>{TYPE_LABEL[o.orderType] || '—'}</Text>
                                        <Text style={[A.td, A.tValue, { flex: 1.1 }]} numberOfLines={1}>{fmt(productTotal(o))}</Text>
                                        <View style={{ flex: 1.2, paddingLeft: 16 }}>
                                            <StatusBadge status={o.status} />
                                        </View>
                                    </View>
                                ))}
                            </>
                        ) : (
                            txList.slice(0, txLimit).map((o, i) => (
                                <View key={o.docId || o.id || i} style={A.mRow}>
                                    <View style={A.mRowTop}>
                                        <Text style={A.tId} numberOfLines={1}>#{o.id}</Text>
                                        <StatusBadge status={o.status} />
                                    </View>
                                    <View style={A.mRowTop}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[A.td, { fontWeight: '600' }]} numberOfLines={1}>{o.customer || '—'}</Text>
                                            <Text style={A.tDate} numberOfLines={1}>
                                                {fmtDate(o.createdAt)}
                                                {TYPE_LABEL[o.orderType] ? ` · ${TYPE_LABEL[o.orderType]}` : ''}
                                                {showSeller ? ` · ${sellerOf(o)}` : ''}
                                            </Text>
                                        </View>
                                        <Text style={[A.td, A.tValue]}>{fmt(productTotal(o))}</Text>
                                    </View>
                                </View>
                            ))
                        )}

                        {txList.length > txLimit && (
                            <TouchableOpacity style={A.moreBtn} onPress={() => setTxLimit(l => l + TX_PAGE)}>
                                <Text style={A.moreText}>Xem thêm ({txList.length - txLimit} đơn)</Text>
                                <Ionicons name="chevron-down" size={14} color="#2563EB" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={isDesktop && showLeaderboard ? A.twoCol : null}>
                        {topProducts.length > 0 && (
                            <View style={[A.card, isDesktop && showLeaderboard && { flex: 1 }]}>
                                <Text style={A.cardTitle}>Sản phẩm hàng đầu</Text>
                                <Text style={A.cardSub}>{cur.label} · theo doanh thu, kèm tỷ trọng</Text>
                                {topProducts.map((p, i) => {
                                    const share = productRevenue > 0 ? p.revenue / productRevenue * 100 : 0;
                                    return (
                                        <View key={p.name} style={A.listRow}>
                                            <View style={A.rankBox}>
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#2563EB' }}>{i + 1}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={A.listRowTop}>
                                                    <Text style={[A.listName, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                                                    <Text style={A.listValue}>{fmt(p.revenue)}</Text>
                                                </View>
                                                <View style={A.shareTrack}>
                                                    <View style={[A.shareFill, { width: `${Math.max(share, 2)}%` }]} />
                                                </View>
                                                <Text style={A.listSub}>{p.units} sản phẩm đã bán · {share.toFixed(1)}%</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {showLeaderboard && (
                            <View style={[A.card, isDesktop && { flex: 1 }]}>
                                <Text style={A.cardTitle}>🏆 Top doanh số</Text>
                                <Text style={A.cardSub}>{cur.label} · doanh số đã thanh toán</Text>
                                {leaderboard.map((u, i) => (
                                    <View key={u.email} style={A.listRow}>
                                        <View style={[A.rankDot,
                                        i === 0 && { backgroundColor: '#F59E0B' }, i === 1 && { backgroundColor: '#94A3B8' }, i === 2 && { backgroundColor: '#CD7F32' }, i > 2 && { backgroundColor: '#CBD5E1' }]}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{i + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={A.listName} numberOfLines={1}>{u.name || u.email}</Text>
                                            <Text style={A.listSub} numberOfLines={1}>{u.email}</Text>
                                        </View>
                                        <Text style={[A.listValue, { color: '#10B981' }]}>{fmt(u.periodRevenue)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={{ height: 80 }} />
                </ScrollView>
            </TabScreenLayout>
        );
}

const A = StyleSheet.create({
    pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
    pageTitle: { fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    pageSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
    userBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
    userBadgeText: { fontSize: 12, fontWeight: '600', color: '#2563EB', maxWidth: 160 },
    topCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    topCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    topCardDesktop: { flex: 1, minWidth: 200 },
    topCardMobile: { flexGrow: 1, flexBasis: '45%' },
    topCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    topCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    topCardLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
    topCardValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    topCardSub: { fontSize: 11, color: '#64748B', fontWeight: '500' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
    cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    cardSub: { fontSize: 12, color: '#64748B', marginTop: 3 },
    twoCol: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    periodBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
    periodNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    periodLabel: { fontSize: 14, fontWeight: '800', color: '#0F172A', minWidth: 104, textAlign: 'center' },
    navBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    todayBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
    todayText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
    pRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
    pBtnActive: { backgroundColor: '#1E3A8A' },
    pBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    pBtnTextActive: { color: '#fff' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 6, marginTop: 4 },
    chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    chartValue: { fontSize: 10, color: '#64748B', marginBottom: 4 },
    chartValueMax: { color: '#1E3A8A', fontWeight: '700' },
    chartTrack: { width: '60%', maxWidth: 48, flex: 1, backgroundColor: '#EFF6FF', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    chartFill: { width: '100%', borderRadius: 6 },
    chartLabel: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: '600' },
    chartLabelCurrent: { color: '#1E3A8A', fontWeight: '800' },
    empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    emptyText: { fontSize: 13, color: '#94A3B8' },
    tHead: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginBottom: 4, gap: 12 },
    th: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
    tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 12 },
    td: { fontSize: 13, color: '#374151' },
    tId: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
    tDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    tValue: { textAlign: 'right', fontWeight: '700', color: '#0F172A' },
    mRow: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 6 },
    mRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    sBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    sDot: { width: 5, height: 5, borderRadius: 3 },
    moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 10, backgroundColor: '#EFF6FF' },
    moreText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
    listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 12 },
    listRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    listName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    listValue: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    listSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    rankBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    rankDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    shareTrack: { height: 5, borderRadius: 3, backgroundColor: '#EFF6FF', marginTop: 6, overflow: 'hidden' },
    shareFill: { height: '100%', borderRadius: 3, backgroundColor: '#93C5FD' },
});
