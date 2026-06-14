// app/(tabs)/commission.jsx — Hoa hồng (responsive)

import ScreenHeader from '@/components/Main/ScreenHeader';
import { showAlert } from '@/components/Main/showAlert';
import TabScreenLayout, { useLayout } from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import { createNotification } from '@/components/Utils/chatService';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
    ActivityIndicator, Dimensions, Platform,
    RefreshControl, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const width = Dimensions.get('window').width;
const IS_DESKTOP = Platform.OS === 'web' && width >= 768;

const fmt = n => (n || 0).toLocaleString('vi-VN') + ' đ';
const fmtShort = n => {
    if (!n) return '0';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
};

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color, borderColor }) {
    return (
        <View style={[SC.card, { borderTopColor: borderColor || color, borderTopWidth: 3 }]}>
            <Text style={SC.label}>{label}</Text>
            <Text style={[SC.value, { color }]}>{value}</Text>
            {sub && <Text style={SC.sub}>{sub}</Text>}
        </View>
    );
}
const SC = StyleSheet.create({
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: IS_DESKTOP ? 16 : 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: IS_DESKTOP ? 130 : 90 },
    label: { fontSize: IS_DESKTOP ? 11 : 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 6 },
    value: { fontSize: IS_DESKTOP ? 24 : 18, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
    sub: { fontSize: IS_DESKTOP ? 11 : 10, color: '#64748B' },
});

// ── MiniBarChart ──────────────────────────────────────────────
function MiniBarChart({ bars }) {
    if (!bars?.length) return null;
    const max = Math.max(...bars.map(b => b.v), 1);
    return (
        <View style={BC.wrap}>
            {bars.map((b, i) => {
                const pct = Math.max((b.v / max) * 100, 4);
                const isMax = b.v === max && max > 0;
                return (
                    <View key={i} style={BC.col}>
                        <View style={BC.track}>
                            <View style={[BC.fill, { height: `${pct}%` }, isMax ? BC.fillHigh : BC.fillNorm]} />
                        </View>
                        <Text style={BC.lbl}>{b.l}</Text>
                    </View>
                );
            })}
        </View>
    );
}
const BC = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6, marginTop: 12 },
    col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    track: { width: '70%', height: '85%', backgroundColor: '#EFF6FF', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    fill: { width: '100%', borderRadius: 6 },
    fillHigh: { backgroundColor: '#1E3A8A' },
    fillNorm: { backgroundColor: '#93C5FD' },
    lbl: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
});

// ── StatusBadge ───────────────────────────────────────────────
const STAT_CFG = {
    pending: { label: 'Chờ trả', c: '#D97706', bg: '#FFFBEB' },
    paid: { label: 'Đã trả', c: '#16A34A', bg: '#DCFCE7' },
};
function StatusBadge({ status }) {
    const cfg = STAT_CFG[status] || { label: status, c: '#64748B', bg: '#F1F5F9' };
    return (
        <View style={[SB.wrap, { backgroundColor: cfg.bg }]}>
            <View style={[SB.dot, { backgroundColor: cfg.c }]} />
            <Text style={[SB.text, { color: cfg.c }]}>{cfg.label}</Text>
        </View>
    );
}
const SB = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    text: { fontSize: 11, fontWeight: '700' },
});

// ── Mobile Card ───────────────────────────────────────────────
function CommCardMobile({ r, isAdmin, onApprove }) {
    return (
        <View style={MR.card}>
            <View style={MR.top}>
                <View style={{ flex: 1 }}>
                    <Text style={MR.orderId}>#{r.id}</Text>
                    <Text style={MR.date}>{r.createdAt?.slice(0, 10) || '—'}</Text>
                </View>
                <StatusBadge status={r.status} />
            </View>
            <View style={MR.mid}>
                <View style={MR.infoCol}>
                    <Text style={MR.infoLabel}>Khách hàng</Text>
                    <Text style={MR.infoValue} numberOfLines={1}>{r.customer || '—'}</Text>
                </View>
                <View style={[MR.infoCol, { alignItems: 'center' }]}>
                    <Text style={MR.infoLabel}>Giá trị đơn</Text>
                    <Text style={MR.infoValue}>{fmtShort(r.totalValue)}</Text>
                </View>
                <View style={[MR.infoCol, { alignItems: 'flex-end' }]}>
                    <Text style={MR.infoLabel}>Hoa hồng</Text>
                    <Text style={[MR.infoValue, { color: '#2563EB', fontWeight: '800' }]}>
                        {fmt(r.commission)}
                    </Text>
                    {isAdmin && r.sellerEmail && (
                        <Text style={[MR.infoLabel, { marginTop: 2, fontSize: 9 }]} numberOfLines={1}>
                            {r.sellerEmail.split('@')[0]}
                        </Text>
                    )}
                </View>
            </View>
            {isAdmin && r.status !== 'paid' && (
                <TouchableOpacity style={MR.approveBtn} onPress={() => onApprove(r)}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Xác nhận trả hoa hồng</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
const MR = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 10, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    top: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    orderId: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    date: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    mid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    infoCol: { flex: 1 },
    infoLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3 },
    infoValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginTop: 12, alignSelf: 'flex-end' },
});

// ── Desktop Table ─────────────────────────────────────────────
const WRAP_BASE = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 };

const COL_BASE = {
    order: { flex: 1.4, minWidth: 140 },
    customer: { flex: 1.2, minWidth: 120 },
    value: { flex: 1, minWidth: 90, alignItems: 'flex-end' },
    commission: { flex: 1, minWidth: 110, alignItems: 'center' },
    status: { width: 130 },
};
const COL_ADMIN = {
    order: { flex: 1.2, minWidth: 130 },
    customer: { flex: 1, minWidth: 110 },
    seller: { flex: 1, minWidth: 130 },
    value: { flex: 1, minWidth: 90, alignItems: 'flex-end' },
    commission: { flex: 1, minWidth: 110, alignItems: 'center' },
    status: { width: 130, alignItems: 'flex-start' },
    action: { width: 140 },
};

function TableHeader({ isAdmin }) {
    const COL = isAdmin ? COL_ADMIN : COL_BASE;
    return (
        <View style={[WRAP_BASE, DT.head]}>
            <View style={COL.order}><Text style={DT.th}>Đơn hàng</Text></View>
            <View style={COL.customer}><Text style={DT.th}>Khách hàng</Text></View>
            {isAdmin && <View style={COL.seller}><Text style={DT.th}>Nhân viên</Text></View>}
            <View style={COL.value}><Text style={DT.th}>Giá trị</Text></View>
            <View style={COL.commission}><Text style={DT.th}>Hoa hồng</Text></View>
            <View style={COL.status}><Text style={DT.th}>Trạng thái</Text></View>
            {isAdmin && <View style={COL.action}><Text style={DT.th}>Hành động</Text></View>}
        </View>
    );
}

function CommRowDesktop({ r, isAdmin, onApprove, odd }) {
    const COL = isAdmin ? COL_ADMIN : COL_BASE;
    const isPaid = r.status === 'paid';
    return (
        <View style={[WRAP_BASE, DT.row, odd && DT.rowOdd]}>
            <View style={COL.order}>
                <Text style={DT.td} numberOfLines={1}>#{r.id}</Text>
                <Text style={DT.sub}>{r.createdAt?.slice(0, 10) || '—'}</Text>
            </View>
            <View style={COL.customer}>
                <Text style={DT.td} numberOfLines={1}>{r.customer || '—'}</Text>
            </View>
            {isAdmin && (
                <View style={COL.seller}>
                    <Text style={DT.td} numberOfLines={1}>{r.sellerEmail || '—'}</Text>
                </View>
            )}
            <View style={COL.value}>
                <Text style={[DT.td, { fontWeight: '600' }]} numberOfLines={1}>{fmtShort(r.totalValue)}</Text>
            </View>
            <View style={COL.commission}>
                <Text style={[DT.td, { fontWeight: '800', color: '#2563EB' }]} numberOfLines={1}>
                    {fmt(r.commission)}
                </Text>
            </View>
            <View style={COL.status}>
                <StatusBadge status={r.status} />
            </View>
            {isAdmin && (
                <View style={COL.action}>
                    <TouchableOpacity
                        style={isPaid ? DT.btnDone : DT.btnPending}
                        onPress={() => !isPaid && onApprove(r)}
                        disabled={isPaid}
                    >
                        <Ionicons
                            name={isPaid ? 'checkmark-circle' : 'checkmark-circle-outline'}
                            size={13}
                            color={isPaid ? '#16A34A' : '#fff'}
                        />
                        <Text style={isPaid ? DT.btnTextDone : DT.btnTextPending}>
                            {isPaid ? 'Đã trả' : 'Xác nhận trả'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
const DT = StyleSheet.create({
    head: { backgroundColor: '#F8FAFC', paddingVertical: 10, borderRadius: 10, marginTop: 10, marginBottom: 2 },
    th: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    row: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    rowOdd: { backgroundColor: '#FAFBFF' },
    td: { fontSize: 13, color: '#0F172A' },
    sub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
    btnPending: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
    btnDone: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DCFCE7', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
    btnTextPending: { fontSize: 11, color: '#fff', fontWeight: '700' },
    btnTextDone: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
});

// ── Screen ────────────────────────────────────────────────────
export default function CommissionScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const isAdmin = role === 'admin';
    const { isMobile } = useLayout();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [period, setPeriod] = useState('yearly');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            let rawOrders = [];

            if (isAdmin) {
                const snap = await getDocs(collection(db, 'orders'));
                rawOrders = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
            } else {
                const lvl2Snap = await getDocs(
                    query(collection(db, 'users'), where('advisor', '==', userDetail.email))
                );
                const lvl2Emails = lvl2Snap.docs.map(d => d.data().email).filter(Boolean);

                let lvl3Emails = [];
                for (let i = 0; i < lvl2Emails.length; i += 30) {
                    const chunk = lvl2Emails.slice(i, i + 30);
                    const s = await getDocs(query(collection(db, 'users'), where('advisor', 'in', chunk)));
                    s.docs.forEach(d => { if (d.data().email) lvl3Emails.push(d.data().email); });
                }
                const teamEmails = [...new Set([userDetail.email, ...lvl2Emails, ...lvl3Emails])];

                for (let i = 0; i < teamEmails.length; i += 30) {
                    const chunk = teamEmails.slice(i, i + 30);
                    const s = await getDocs(
                        query(collection(db, 'orders'), where('createdBy', 'in', chunk))
                    );
                    s.docs.forEach(d => rawOrders.push({ ...d.data(), docId: d.id }));
                }
            }

            // Lọc sơ bộ: đã thanh toán + khách hàng thanh toán
            const preFiltered = rawOrders.filter(o =>
                o.status === 'Đã thanh toán' &&
                o.paymentMethod === 'customer'
            );

            // Kiểm tra điều kiện người tạo đơn
            const eligibleEmails = new Set();
            const allCreatorEmails = [...new Set(preFiltered.map(o => o.createdBy).filter(Boolean))];

            await Promise.all(allCreatorEmails.map(async email => {
                try {
                    const uSnap = await getDoc(doc(db, 'users', email));
                    if (!uSnap.exists()) return;
                    const u = uSnap.data();
                    const r = getRole(u);
                    const hasAdvisor = u.advisor != null && u.advisor !== '';
                    if (!hasAdvisor && r !== 'daily') eligibleEmails.add(email);
                } catch (_) { }
            }));

            const allOrders = preFiltered
                .filter(o => eligibleEmails.has(o.createdBy))
                .map(o => ({ ...o, sellerEmail: o.createdBy || userDetail.email }));

            setOrders(allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [userDetail?.email, isAdmin]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleApprove = useCallback((r) => {
        if (r.status === 'paid') return;
        showAlert(
            'Xác nhận thanh toán hoa hồng',
            `Trả ${fmt(r.commission)} hoa hồng cho ${r.sellerEmail || 'người tạo đơn'}?\n\nĐơn: #${r.id}\nKhách hàng: ${r.customer || '—'}`,
            async () => {
                try {
                    await updateDoc(doc(db, 'orders', r.id), { commissionStatus: 'paid' });
                    setOrders(prev => prev.map(o =>
                        o.id === r.id ? { ...o, commissionStatus: 'paid' } : o
                    ));
                    if (r.sellerEmail && r.sellerEmail !== userDetail?.email) {
                        await createNotification({
                            userEmail: r.sellerEmail,
                            type: 'commission_paid',
                            title: '💰 Hoa hồng đã được thanh toán',
                            body: `Hoa hồng ${fmt(r.commission)} cho đơn #${r.id} (KH: ${r.customer || '—'}) đã được trả.`,
                            orderId: r.id,
                            roomId: `order_${r.id}`,
                            path: '/(tabs)/commission',
                        });
                    }
                } catch (e) {
                    console.error('handleApprove error:', e);
                    fetchData();
                }
            }
        );
    }, [userDetail?.email, fetchData]);

    const commRecords = useMemo(() =>
        orders.map(o => {
            const totalValue = (o.items || []).reduce((s, p) =>
                s + parseFloat(p.price || 0) * parseFloat(p.qty || 1), 0);
            const commission = Math.max(
                (o.items || []).reduce((s, p) =>
                    s + (parseFloat(p.basePrice || 0) - parseFloat(p.price || 0)) * parseFloat(p.qty || 1), 0),
                0
            );
            return { ...o, totalValue, commission, status: o.commissionStatus || 'pending' };
        })
        , [orders]);

    const filteredRecords = useMemo(() => {
        const q = search.trim().toLowerCase();
        return commRecords.filter(r => {
            const ms = !q || (
                String(r.id || '').toLowerCase().includes(q) ||
                String(r.customer || '').toLowerCase().includes(q) ||
                String(r.sellerEmail || '').toLowerCase().includes(q)
            );
            return ms && (statusFilter === 'all' || r.status === statusFilter);
        });
    }, [commRecords, search, statusFilter]);

    const pending = commRecords.filter(r => r.status === 'pending').reduce((s, r) => s + r.commission, 0);
    const paid = commRecords.filter(r => r.status === 'paid').reduce((s, r) => s + r.commission, 0);
    const pendingCount = commRecords.filter(r => r.status === 'pending').length;
    const paidCount = commRecords.filter(r => r.status === 'paid').length;

    const now = new Date();
    const bars = useMemo(() => Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const v = commRecords
            .filter(r => (r.createdAt || '').startsWith(key))
            .reduce((s, r) => s + r.commission, 0);
        return { l: `T${d.getMonth() + 1}`, v };
    }), [commRecords]);

    const thisMonth = commRecords
        .filter(r => (r.createdAt || '').startsWith(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        ))
        .reduce((s, r) => s + r.commission, 0);

    if (loading) return (
        <TabScreenLayout>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        </TabScreenLayout>
    );

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Báo cáo Hoa hồng"
                subtitle={isAdmin ? 'Quản lý hoa hồng toàn hệ thống' : 'Hoa hồng với những đơn hàng'}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Tìm theo mã đơn, khách hàng, nhân viên..."
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                <View style={S.statsRow}>
                    <StatCard label="Chờ giải ngân" value={fmtShort(pendingCount)}
                        // sub={`${pendingCount} khoản`}
                        color="#D97706" borderColor="#FDE68A" />
                    <StatCard label="Đã thanh toán" value={fmtShort(paidCount)}
                        // sub={`${paidCount} khoản`}
                        color="#16A34A" borderColor="#86EFAC" />
                    <StatCard label="Tổng cộng" value={fmtShort(pendingCount + paidCount)}
                        // sub="tất cả khoản"
                        color="#2563EB" borderColor="#BFDBFE" />
                </View>

                <View style={S.card}>
                    <View style={S.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.cardTitle}>Xu hướng thu nhập</Text>
                            <Text style={S.cardSub}>Tăng trưởng hoa hồng 6 tháng gần nhất</Text>
                        </View>
                    </View>
                    <MiniBarChart bars={bars} />
                </View>

                <FilterChips
                    options={[
                        { key: 'all', label: 'Tất cả', count: commRecords.length },
                        { key: 'pending', label: 'Chờ trả', count: pendingCount },
                        { key: 'paid', label: 'Đã trả', count: paidCount },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />

                <View style={S.card}>
                    <View style={S.cardHeader}>
                        <Text style={S.cardTitle}>Lịch sử quyết toán</Text>
                        <View style={S.countBadge}>
                            <Text style={S.countText}>
                                {search ? `${filteredRecords.length}/${commRecords.length}` : commRecords.length} giao dịch
                            </Text>
                        </View>
                    </View>

                    {filteredRecords.length === 0 ? (
                        <View style={S.emptyWrap}>
                            <Ionicons name={search ? 'search-outline' : 'cash-outline'} size={36} color="#CBD5E1" />
                            <Text style={S.emptyText}>
                                {search ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có hoa hồng nào'}
                            </Text>
                        </View>
                    ) : isMobile ? (
                        <View style={{ marginTop: 4 }}>
                            {filteredRecords.slice(0, 20).map((r, i) => (
                                <CommCardMobile key={r.id || i} r={r} isAdmin={isAdmin} onApprove={handleApprove} />
                            ))}
                        </View>
                    ) : (
                        <>
                            <TableHeader isAdmin={isAdmin} />
                            {filteredRecords.slice(0, 20).map((r, i) => (
                                <CommRowDesktop key={r.id || i} r={r} isAdmin={isAdmin} onApprove={handleApprove} odd={i % 2 === 1} />
                            ))}
                        </>
                    )}
                </View>

                {/* {!isAdmin && (
                    <View style={[S.card, S.bonusCard]}>
                        <Text style={S.bonusLabel}>THƯỞNG THÁNG</Text>
                        <Text style={S.bonusAmount}>Thu nhập tháng này: {fmt(thisMonth)}</Text>
                        <Text style={S.bonusRate}>Hoa hồng tính theo chênh lệch giá bán và giá nhập</Text>
                        <View style={S.progressTrack}>
                            <View style={[S.progressFill, { width: `${Math.min((thisMonth / 5_000_000) * 100, 100)}%` }]} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={S.progressHint}>Tiến độ đạt mốc thưởng</Text>
                            <Text style={S.progressHint}>5.000.000đ</Text>
                        </View>
                    </View>
                )} */}

                <View style={{ height: 80 }} />
            </ScrollView>
        </TabScreenLayout>
    );
}

const S = StyleSheet.create({
    scroll: { padding: IS_DESKTOP ? 32 : 16, paddingTop: IS_DESKTOP ? 16 : 12 },
    statsRow: { flexDirection: 'row', gap: IS_DESKTOP ? 12 : 8, marginBottom: 14 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: IS_DESKTOP ? 20 : 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 },
    cardTitle: { fontSize: IS_DESKTOP ? 15 : 14, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
    cardSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    countBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    countText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    emptyText: { fontSize: 14, color: '#94A3B8' },
    bonusCard: { backgroundColor: '#1E3A5F', borderColor: '#2C5282' },
    bonusLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
    bonusAmount: { color: '#fff', fontSize: IS_DESKTOP ? 15 : 14, fontWeight: '700', marginBottom: 4 },
    bonusRate: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#60A5FA', borderRadius: 3 },
    progressHint: { color: 'rgba(255,255,255,0.45)', fontSize: 10 },
});