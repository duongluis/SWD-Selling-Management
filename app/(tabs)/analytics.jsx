// app/(tabs)/analytics.jsx — Báo cáo doanh thu (redesign) responsive
import TabScreenLayout, { useLayout } from '@/components/Main/TabScreenLayout';
import { THEME } from '@/components/Styles/theme';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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

function BarChart({ bars }) {
    if (!bars?.length) return null;
    const max = Math.max(...bars.map(b => b.v), 1);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 8, marginTop: 16 }}>
            {bars.map((b, i) => {
                const pct = Math.max((b.v / max) * 100, 3);
                const isMax = b.v === max && max > 0;
                return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        {b.v > 0 && <Text style={{ fontSize: 8, color: '#64748B', marginBottom: 3 }}>{fmtShort(b.v)}</Text>}
                        <View style={{ width: '55%', height: '85%', backgroundColor: '#EFF6FF', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
                            <View style={{ width: '100%', height: `${pct}%`, borderRadius: 6, backgroundColor: isMax ? '#1E3A8A' : '#93C5FD' }} />
                        </View>
                        <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 5, fontWeight: '600' }}>{b.l}</Text>
                    </View>
                );
            })}
        </View>
    );
}

export default function AnalyticsScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const isAdmin = role === 'admin';
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [period, setPeriod] = useState('quarterly'); // 'quarterly'|'yearly'
    const { isDesktop } = useLayout();
    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            const cSnap = isAdmin
                ? await getDocs(collection(db, 'customers'))
                : await getDocs(query(collection(db, 'customers'), where('createdBy', '==', userDetail.email)));
            const phones = cSnap.docs.map(d => d.data().phone).filter(Boolean);
            const all = [];
            await Promise.all(phones.slice(0, 100).map(async phone => {
                try {
                    const s = await getDoc(doc(db, 'orders', phone));
                    if (s.exists()) (s.data().orders || []).forEach(o => all.push(o));
                } catch (_) { }
            }));
            setOrders(all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            if (isAdmin) {
                const snap = await getDocs(query(collection(db, 'users'), where('verified', '==', true)));
                setLeaderboard(snap.docs.map(d => d.data())
                    .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin' && (u.revenueTotal || 0) > 0)
                    .sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0)).slice(0, 5));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userDetail?.email, isAdmin]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const active = orders.filter(o => o.status !== 'Đã hủy');
    const totalRevenue = active.reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    const thisRev = active.filter(o => (o.createdAt || '').startsWith(thisKey)).reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
    const lastRev = active.filter(o => (o.createdAt || '').startsWith(lastKey)).reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
    const growth = lastRev > 0 ? ((thisRev - lastRev) / lastRev * 100).toFixed(1) : null;
    const pending = active.filter(o => o.status !== 'Đã thanh toán').reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
    const paidThis = active.filter(o => o.status === 'Đã thanh toán' && (o.createdAt || '').startsWith(thisKey)).reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);

    const bars = useMemo(() => {
        if (period === 'quarterly') {
            return Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const v = active.filter(o => (o.createdAt || '').startsWith(key)).reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
                return { l: `T${d.getMonth() + 1}`, v };
            });
        }
        return Array.from({ length: 4 }, (_, i) => {
            const yr = now.getFullYear() - 3 + i;
            const v = active.filter(o => (o.createdAt || '').startsWith(String(yr))).reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0), 0);
            return { l: String(yr), v };
        });
    }, [active, period, now]);

    const topProducts = useMemo(() => {
        const map = new Map();
        active.forEach(o => (o.items || []).forEach(p => {
            const k = p.name;
            if (!map.has(k)) map.set(k, { name: k, units: 0, revenue: 0 });
            const r = map.get(k); r.units += parseFloat(p.qty || 1); r.revenue += parseFloat(p.price || 0) * parseFloat(p.qty || 1);
        }));
        return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [active]);

    if (loading) return (
        <TabScreenLayout>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        </TabScreenLayout>
    );

    return (
        <TabScreenLayout>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[A.scroll, { padding: isDesktop ? THEME.spacing.xxl : THEME.spacing.lg }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                <View style={A.pageHeader}>
                    <Text style={[A.pageTitle, { fontSize: isDesktop ? 26 : 22 }]}>Báo cáo doanh thu</Text>
                    <View style={A.userBadge}>
                        <Ionicons name={isAdmin ? 'shield-checkmark-outline' : 'person-outline'} size={13} color="#2563EB" />
                        <Text style={A.userBadgeText}>{isAdmin ? 'Toàn hệ thống' : (userDetail?.name || userDetail?.email || 'Của tôi')}</Text>
                    </View>
                </View>

                <View style={[A.topCards, { flexDirection: isDesktop ? 'row' : 'column', gap: 12 }]}>
                    <View style={[A.topCard, { flex: isDesktop ? 1 : undefined }]}>
                        <View style={[A.topCardIcon, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="trending-up-outline" size={20} color="#2563EB" />
                        </View>
                        <Text style={A.topCardLabel}>TỔNG THU NHẬP</Text>
                        <Text style={A.topCardValue}>{fmt(totalRevenue)}</Text>
                        {growth && <Text style={[A.topCardSub, { color: parseFloat(growth) >= 0 ? '#10B981' : '#EF4444' }]}>↗ {parseFloat(growth) >= 0 ? '+' : ''}{growth}% so với tháng trước</Text>}
                    </View>
                    <View style={A.topCard}>
                        <View style={[A.topCardIcon, { backgroundColor: '#FFFBEB' }]}>
                            <Ionicons name="time-outline" size={20} color="#D97706" />
                        </View>
                        <Text style={A.topCardLabel}>ĐANG CHỜ XỬ LÝ</Text>
                        <Text style={[A.topCardValue, { color: '#D97706' }]}>{fmt(pending)}</Text>
                        <Text style={A.topCardSub}>Dự kiến quyết toán sớm</Text>
                    </View>
                    <View style={A.topCard}>
                        <View style={[A.topCardIcon, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
                        </View>
                        <Text style={A.topCardLabel}>ĐÃ THANH TOÁN (THÁNG NÀY)</Text>
                        <Text style={[A.topCardValue, { color: '#16A34A' }]}>{fmt(paidThis)}</Text>
                    </View>
                </View>

                <View style={A.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={A.cardTitle}>Xu hướng thu nhập</Text>
                            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>Biểu đồ tăng trưởng 6 tháng gần nhất</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {['quarterly', 'yearly'].map(p => (
                                <TouchableOpacity key={p} style={[A.pBtn, period === p && A.pBtnActive]} onPress={() => setPeriod(p)}>
                                    <Text style={[A.pBtnText, period === p && A.pBtnTextActive]}>{p === 'quarterly' ? 'Quý này' : 'Năm nay'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <BarChart bars={bars} />
                </View>

                <View style={A.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={A.cardTitle}>Lịch sử giao dịch</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>{active.length} giao dịch</Text>
                    </View>
                    <View style={A.tHead}>
                        <Text style={[A.th, { flex: 1.5 }]}>Đơn hàng</Text>
                        <Text style={[A.th, { flex: 1 }]}>Khách hàng</Text>
                        <Text style={[A.th, { flex: 1, textAlign: 'center' }]}>Giá trị</Text>
                        <Text style={[A.th, { flex: 0.8, textAlign: 'center' }]}>Trạng thái</Text>
                    </View>
                    {active.slice(0, 10).map((o, i) => {
                        const val = (o.items || []).reduce((s, p) => s + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0);
                        const isPaid = o.status === 'Đã thanh toán';
                        return (
                            <View key={o.id || i} style={[A.tRow, i % 2 === 1 && { backgroundColor: '#FAFBFF' }]}>
                                <View style={{ flex: 1.5 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB' }}>#{o.id}</Text>
                                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>{o.createdAt?.slice(0, 10) || '—'}</Text>
                                </View>
                                <Text style={[A.td, { flex: 1 }]} numberOfLines={1}>{o.customer || '—'}</Text>
                                <Text style={[A.td, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>{fmtShort(val)}</Text>
                                <View style={{ flex: 0.8 }}>
                                    <View style={[A.sBadge, { backgroundColor: isPaid ? '#ECFDF5' : '#FFFBEB' }]}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isPaid ? '#16A34A' : '#D97706' }}>{isPaid ? 'ĐÃ TT' : 'CHỜ TT'}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {topProducts.length > 0 && (
                    <View style={A.card}>
                        <Text style={A.cardTitle}>Sản phẩm hàng đầu</Text>
                        {topProducts.map((p, i) => (
                            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 12 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#2563EB' }}>{i + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{p.name}</Text>
                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{p.units} đơn vị đã bán</Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{fmtShort(p.revenue)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {isAdmin && leaderboard.length > 0 && (
                    <View style={A.card}>
                        <Text style={A.cardTitle}>🏆 Top doanh số</Text>
                        {leaderboard.map((u, i) => (
                            <View key={u.email} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 10 }}>
                                <View style={[{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
                                i === 0 && { backgroundColor: '#F59E0B' }, i === 1 && { backgroundColor: '#94A3B8' }, i === 2 && { backgroundColor: '#CD7F32' }, i > 2 && { backgroundColor: '#E2E8F0' }]}>
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{i + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{u.name || u.email}</Text>
                                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>{u.email}</Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>{fmtShort(u.revenueTotal || 0)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>
        </TabScreenLayout>
    );
}

const A = StyleSheet.create({
    pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    pageTitle: { fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    userBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
    userBadgeText: { fontSize: 12, fontWeight: '600', color: '#2563EB', maxWidth: 160 },
    topCards: { marginBottom: 16 },
    topCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', gap: 4, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    topCardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    topCardLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.06, textTransform: 'uppercase' },
    topCardValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    topCardSub: { fontSize: 11, color: '#64748B', fontWeight: '500' },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    pBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
    pBtnActive: { backgroundColor: '#1E3A8A' },
    pBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    pBtnTextActive: { color: '#fff' },
    tHead: { flexDirection: 'row', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
    th: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
    tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    td: { fontSize: 12, color: '#374151' },
    sBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: 'center' },
});