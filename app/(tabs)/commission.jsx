// app/(tabs)/commission.jsx — Hoa hồng + Thưởng (responsive)

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

// ── Helpers vai trò → price field ────────────────────────────
const getRolePriceField = (role) => ({
    daily: 'price_a',
    phantan: 'price_p',
    ctv: 'price_c',
}[role] || 'price');

const getRoleFromUserData = (u) => {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

/**
 * Tính hoa hồng đúng công thức:
 * commission = Σ (price_sp_i - basePrice_sp_i) * qty_i
 *
 * basePrice theo vai trò người tạo cấp 1 (không có advisor):
 * - daily  → price_a
 * - phantan → price_p
 * - ctv    → price_c
 * - khác   → price (niêm yết)
 *
 * Nếu người tạo có advisor, ta dùng priceField đã được lưu vào đơn (baseRolePriceField).
 */
function calcCommission(items = [], basePriceField = 'price') {
    return Math.max(
        items.reduce((sum, p) => {
            const sellPrice = parseFloat(p.price || 0);
            // Ưu tiên lấy basePrice được lưu trong item, fallback sang priceField tương ứng vai trò
            const basePrice = parseFloat(p[basePriceField] || p.basePrice || p.price || 0);
            const qty = parseFloat(p.qty || 1);
            return sum + (sellPrice - basePrice) * qty;
        }, 0),
        0
    );
}

/**
 * Tính thưởng:
 * bonus = 1% × Σ price_field_role_collab_i × qty_i
 * price_field lấy theo vai trò của người được gán collaboration
 */
function calcBonus(items = [], collabPriceField = 'price') {
    return items.reduce((sum, p) => {
        const rolePrice = parseFloat(p[collabPriceField] || p.price || 0);
        const qty = parseFloat(p.qty || 1);
        return sum + rolePrice * qty * 0.01;
    }, 0);
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, color, borderColor }) {
    return (
        <View style={[SC.card, { borderTopColor: borderColor || color, borderTopWidth: 3 }]}>
            <Text style={SC.label}>{label}</Text>
            <Text style={[SC.value, { color }]}>{value}</Text>
        </View>
    );
}
const SC = StyleSheet.create({
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: IS_DESKTOP ? 16 : 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: IS_DESKTOP ? 130 : 90 },
    label: { fontSize: IS_DESKTOP ? 11 : 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 6 },
    value: { fontSize: IS_DESKTOP ? 24 : 18, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
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

// ── TypeBadge ─────────────────────────────────────────────────
function TypeBadge({ type }) {
    const isBonus = type === 'bonus';
    return (
        <View style={[TB.wrap, { backgroundColor: isBonus ? '#F5F3FF' : '#EFF6FF' }]}>
            <Ionicons name={isBonus ? 'gift-outline' : 'cash-outline'} size={10} color={isBonus ? '#7C3AED' : '#2563EB'} />
            <Text style={[TB.text, { color: isBonus ? '#7C3AED' : '#2563EB' }]}>{isBonus ? 'Thưởng' : 'Hoa hồng'}</Text>
        </View>
    );
}
const TB = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    text: { fontSize: 10, fontWeight: '700' },
});

// ── Mobile Card ───────────────────────────────────────────────
function CommCardMobile({ r, isAdmin, onApprove }) {
    const isBonus = r.recordType === 'bonus';
    return (
        <View style={MR.card}>
            <View style={MR.top}>
                <View style={{ flex: 1 }}>
                    <Text style={MR.orderId}>#{r.id}</Text>
                    <Text style={MR.date}>{r.createdAt?.slice(0, 10) || '—'}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                    <StatusBadge status={r.status} />
                    <TypeBadge type={r.recordType} />
                </View>
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
                    <Text style={MR.infoLabel}>{isBonus ? 'Thưởng' : 'Hoa hồng'}</Text>
                    <Text style={[MR.infoValue, { color: isBonus ? '#7C3AED' : '#2563EB', fontWeight: '800' }]}>
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
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Xác nhận trả</Text>
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
    type: { width: 90 },
    value: { flex: 1, minWidth: 90, alignItems: 'flex-end' },
    commission: { flex: 1, minWidth: 110, alignItems: 'center' },
    status: { width: 110 },
};
const COL_ADMIN = {
    order: { flex: 1.2, minWidth: 130 },
    customer: { flex: 1, minWidth: 110 },
    seller: { flex: 1, minWidth: 130 },
    type: { width: 90 },
    value: { flex: 1, minWidth: 90, alignItems: 'flex-end' },
    commission: { flex: 1, minWidth: 110, alignItems: 'center' },
    status: { width: 110 },
    action: { width: 130 },
};

function TableHeader({ isAdmin }) {
    const COL = isAdmin ? COL_ADMIN : COL_BASE;
    return (
        <View style={[WRAP_BASE, DT.head]}>
            <View style={COL.order}><Text style={DT.th}>Đơn hàng</Text></View>
            <View style={COL.customer}><Text style={DT.th}>Khách hàng</Text></View>
            {isAdmin && <View style={COL.seller}><Text style={DT.th}>Nhân viên</Text></View>}
            <View style={COL.type}><Text style={DT.th}>Loại</Text></View>
            <View style={COL.value}><Text style={DT.th}>Giá trị</Text></View>
            <View style={COL.commission}><Text style={DT.th}>Số tiền</Text></View>
            <View style={COL.status}><Text style={DT.th}>Trạng thái</Text></View>
            {isAdmin && <View style={COL.action}><Text style={DT.th}>Hành động</Text></View>}
        </View>
    );
}

function CommRowDesktop({ r, isAdmin, onApprove, odd }) {
    const COL = isAdmin ? COL_ADMIN : COL_BASE;
    const isPaid = r.status === 'paid';
    const isBonus = r.recordType === 'bonus';
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
            <View style={COL.type}>
                <TypeBadge type={r.recordType} />
            </View>
            <View style={COL.value}>
                <Text style={[DT.td, { fontWeight: '600' }]} numberOfLines={1}>{fmtShort(r.totalValue)}</Text>
            </View>
            <View style={COL.commission}>
                <Text style={[DT.td, { fontWeight: '800', color: isBonus ? '#7C3AED' : '#2563EB' }]} numberOfLines={1}>
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

// ── Main Tabs ─────────────────────────────────────────────────
const MAIN_TABS = [
    { key: 'commission', label: 'Hoa hồng', icon: 'cash-outline', color: '#2563EB' },
    { key: 'bonus', label: 'Thưởng', icon: 'gift-outline', color: '#7C3AED' },
];

// ── Screen ────────────────────────────────────────────────────
export default function CommissionScreen() {
    const { userDetail } = useContext(UserDetailContext);

    const role = getRole(userDetail);
    const isAdmin = role === 'admin';
    const { isMobile } = useLayout();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState([]);
    const [mainTab, setMainTab] = useState('commission'); // 'commission' | 'bonus'
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Cache: email → userData (để lấy role & collaboration)
    const [userCache, setUserCache] = useState({});



    const getUserData = useCallback(async (email, cache) => {
        if (!email) return null;
        if (cache[email]) return cache[email];
        try {
            const snap = await getDoc(doc(db, 'users', email));
            if (snap.exists()) {
                const data = snap.data();
                setUserCache(prev => ({ ...prev, [email]: data }));
                return data;
            }
        } catch (_) { }
        return null;
    }, []);

    // Tìm advisor cấp 1 (không có advisor trên họ)
    const findLevel1Advisor = useCallback(async (email, cache) => {
        let currentEmail = email;
        let visited = new Set();
        while (currentEmail) {
            if (visited.has(currentEmail)) break;
            visited.add(currentEmail);
            const userData = await getUserData(currentEmail, cache);
            if (!userData) break;
            if (!userData.advisor) return userData; // cấp 1
            currentEmail = userData.advisor;
        }
        return null;
    }, [getUserData]);

    const fetchData = useCallback(async () => {
        if (!userDetail?.email) return;
        try {
            let rawOrders = [];
            const localCache = { ...userCache };

            if (isAdmin) {
                // Admin: lấy tất cả
                const snap = await getDocs(collection(db, 'orders'));
                rawOrders = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
            } else {
                // ── Phần 1: Đơn của team mình (để tính hoa hồng của mình) ──
                const l2Snap = await getDocs(
                    query(collection(db, 'users'), where('advisor', '==', userDetail.email))
                );
                const l2Emails = l2Snap.docs.map(d => d.data().email).filter(Boolean);

                let l3Emails = [];
                for (let i = 0; i < l2Emails.length; i += 10) {
                    const chunk = l2Emails.slice(i, i + 10);
                    const s = await getDocs(query(collection(db, 'users'), where('advisor', 'in', chunk)));
                    s.docs.forEach(d => { if (d.data().email) l3Emails.push(d.data().email); });
                }

                const teamEmails = [...new Set([userDetail.email, ...l2Emails, ...l3Emails])];

                for (let i = 0; i < teamEmails.length; i += 10) {
                    const chunk = teamEmails.slice(i, i + 10);
                    const s = await getDocs(
                        query(collection(db, 'orders'), where('createdBy', 'in', chunk))
                    );
                    s.docs.forEach(d => rawOrders.push({ ...d.data(), docId: d.id }));
                }

                // ── Phần 2: Đơn của users có collaboration == myEmail (để tính thưởng) ──
                // Tìm tất cả users mà A là collaboration của họ
                const collabSnap = await getDocs(
                    query(collection(db, 'users'), where('collaboration', '==', userDetail.email))
                );
                const collabSourceEmails = collabSnap.docs.map(d => d.data().email).filter(Boolean);

                if (collabSourceEmails.length > 0) {
                    for (let i = 0; i < collabSourceEmails.length; i += 10) {
                        const chunk = collabSourceEmails.slice(i, i + 10);
                        const s = await getDocs(
                            query(collection(db, 'orders'), where('createdBy', 'in', chunk))
                        );
                        s.docs.forEach(d => {
                            // Tránh trùng với đơn đã có trong rawOrders
                            const exists = rawOrders.some(o => o.id === d.data().id || o.docId === d.id);
                            if (!exists) rawOrders.push({ ...d.data(), docId: d.id });
                        });
                    }
                }
            }

            // Hoa hồng: chỉ customer pay
            const commissionEligible = rawOrders.filter(o =>
                o.status === 'Đã thanh toán' &&
                o.paymentMethod === 'customer'
            );

            // Thưởng: tất cả đơn đã thanh toán, không phân biệt payment
            const bonusEligible = rawOrders.filter(o =>
                o.status === 'Đã thanh toán'
            );

            // Gộp, dedup theo id — đơn nào đủ điều kiện cả 2 thì tính cả 2
            const allEligible = [...new Map(
                [...commissionEligible, ...bonusEligible].map(o => [o.id, o])
            ).values()];

            const enriched = await Promise.all(allEligible.map(async (o) => {
                const creatorEmail = o.createdBy;
                const creatorData = await getUserData(creatorEmail, localCache);
                if (!creatorData) return null;

                const creatorRole = getRoleFromUserData(creatorData);

                let basePriceField = 'price';
                if (creatorData.advisor) {
                    const level1 = await findLevel1Advisor(creatorData.advisor, localCache);
                    if (level1) basePriceField = getRolePriceField(getRoleFromUserData(level1));
                } else {
                    basePriceField = getRolePriceField(creatorRole);
                }

                const items = o.items || [];
                const totalValue = items.reduce(
                    (s, p) => s + parseFloat(p.price || 0) * parseFloat(p.qty || 1), 0
                );

                // Hoa hồng: chỉ tính nếu đơn đủ điều kiện customer pay
                const isCommissionEligible = o.paymentMethod === 'customer';
                const commission = isCommissionEligible ? calcCommission(items, basePriceField) : 0;

                // Thưởng: tính cho tất cả
                const collaboratorEmail = creatorData.collaboration || null;
                let bonusAmount = 0;
                if (collaboratorEmail) {
                    // Xác định price field để tính giá nhập
                    let bonusPriceField = 'price'; // fallback

                    if (o.rootAdvisor) {
                        // Có rootAdvisor → lấy role của rootAdvisor
                        const rootAdvisorData = await getUserData(o.rootAdvisor, localCache);
                        if (rootAdvisorData) {
                            bonusPriceField = getRolePriceField(getRoleFromUserData(rootAdvisorData));
                        }
                    } else {
                        // Không có rootAdvisor → dùng role của người tạo đơn (creatorData)
                        bonusPriceField = getRolePriceField(creatorRole);
                    }

                    bonusAmount = calcBonus(items, bonusPriceField);
                }
                return {
                    ...o,
                    sellerEmail: creatorEmail,
                    totalValue,
                    commission,
                    bonusAmount,
                    collaboratorEmail,
                    basePriceField,
                    commissionStatus: o.commissionStatus || 'pending',
                    bonusStatus: o.bonusStatus || 'pending',
                };
            }));



            const validOrders = enriched
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            setOrders(validOrders);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userDetail?.email, isAdmin, findLevel1Advisor, getUserData]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleApprove = useCallback((r) => {
        if (!userDetail?.email) return;
        const isBonus = r.recordType === 'bonus';
        const amount = isBonus ? r.bonusAmount : r.commission;
        const statusField = isBonus ? 'bonusStatus' : 'commissionStatus';
        const targetEmail = isBonus ? r.collaboratorEmail : r.sellerEmail;

        if (r.status === 'paid') return;
        showAlert(
            `Xác nhận thanh toán ${isBonus ? 'thưởng' : 'hoa hồng'}`,
            `Trả ${fmt(amount)} cho ${targetEmail || '—'}?\n\nĐơn: #${r.id}\nKhách hàng: ${r.customer || '—'}`,
            async () => {
                try {
                    await updateDoc(doc(db, 'orders', r.id), { [statusField]: 'paid' });
                    setOrders(prev => prev.map(o =>
                        o.id === r.id ? { ...o, [statusField]: 'paid' } : o
                    ));
                    if (targetEmail && targetEmail !== userDetail?.email) {
                        await createNotification({
                            userEmail: targetEmail,
                            type: isBonus ? 'bonus_paid' : 'commission_paid',
                            title: isBonus ? '🎁 Thưởng đã được thanh toán' : '💰 Hoa hồng đã được thanh toán',
                            body: `${isBonus ? 'Thưởng' : 'Hoa hồng'} ${fmt(amount)} cho đơn #${r.id} (KH: ${r.customer || '—'}) đã được trả.`,
                            orderId: r.id,
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

    // ── Records theo mainTab ──────────────────────────────────
    const commRecords = useMemo(() => {
        if (!userDetail?.email) return [];

        if (mainTab === 'commission') {
            // Hoa hồng: chỉ đơn do chính mình hoặc team tạo, không phải đơn từ collaboration
            return orders
                .filter(o => isAdmin || o.sellerEmail === userDetail.email)
                .map(o => ({
                    ...o,
                    commission: o.commission,
                    status: o.commissionStatus || 'pending',
                    recordType: 'commission',
                }))
                .filter(o => o.commission > 0);
        } else {
            // Thưởng: chỉ đơn mà mình là collaborator
            return orders
                .filter(o => isAdmin || o.collaboratorEmail === userDetail.email)
                .map(o => ({
                    ...o,
                    commission: o.bonusAmount,
                    status: o.bonusStatus || 'pending',
                    recordType: 'bonus',
                }))
                .filter(o => o.commission > 0);
        }
    }, [orders, mainTab, isAdmin, userDetail.email]);

    const filteredRecords = useMemo(() => {
        if (!userDetail?.email) return [];

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

    if (!userDetail) return null;

    if (loading) return (
        <TabScreenLayout>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        </TabScreenLayout>
    );

    const accentColor = mainTab === 'bonus' ? '#7C3AED' : '#2563EB';

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Báo cáo Thu nhập"
                subtitle={isAdmin ? 'Quản lý hoa hồng & thưởng toàn hệ thống' : 'Hoa hồng và thưởng của bạn'}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Tìm theo mã đơn, khách hàng..."
            />

            {/* ── Main Tabs ── */}
            <View style={MT.wrap}>
                {MAIN_TABS.map(t => {
                    const active = mainTab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={[MT.tab, active && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
                            onPress={() => { setMainTab(t.key); setStatusFilter('all'); }}
                        >
                            <Ionicons name={t.icon} size={16} color={active ? t.color : '#94A3B8'} />
                            <Text style={[MT.label, active && { color: t.color }]}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                <View style={S.statsRow}>
                    <StatCard label="Chờ giải ngân" value={fmtShort(pendingCount)} color="#D97706" borderColor="#FDE68A" />
                    <StatCard label="Đã thanh toán" value={fmtShort(paidCount)} color="#16A34A" borderColor="#86EFAC" />
                    <StatCard label="Tổng cộng" value={fmtShort(pendingCount + paidCount)} color={accentColor} borderColor={mainTab === 'bonus' ? '#DDD6FE' : '#BFDBFE'} />
                </View>

                <View style={S.card}>
                    <View style={S.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.cardTitle}>
                                {mainTab === 'bonus' ? 'Xu hướng thưởng' : 'Xu hướng hoa hồng'}
                            </Text>
                            <Text style={S.cardSub}>6 tháng gần nhất</Text>
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
                        <Text style={S.cardTitle}>
                            {mainTab === 'bonus' ? 'Lịch sử thưởng' : 'Lịch sử hoa hồng'}
                        </Text>
                        <View style={S.countBadge}>
                            <Text style={S.countText}>
                                {search ? `${filteredRecords.length}/${commRecords.length}` : commRecords.length} giao dịch
                            </Text>
                        </View>
                    </View>

                    {filteredRecords.length === 0 ? (
                        <View style={S.emptyWrap}>
                            <Ionicons name={mainTab === 'bonus' ? 'gift-outline' : 'cash-outline'} size={36} color="#CBD5E1" />
                            <Text style={S.emptyText}>
                                {search ? 'Không tìm thấy kết quả' : mainTab === 'bonus' ? 'Chưa có thưởng nào' : 'Chưa có hoa hồng nào'}
                            </Text>
                        </View>
                    ) : isMobile ? (
                        <View style={{ marginTop: 4 }}>
                            {filteredRecords.slice(0, 20).map((r, i) => (
                                <CommCardMobile key={`${r.id}-${r.recordType}-${i}`} r={r} isAdmin={isAdmin} onApprove={handleApprove} />
                            ))}
                        </View>
                    ) : (
                        <>
                            <TableHeader isAdmin={isAdmin} />
                            {filteredRecords.slice(0, 20).map((r, i) => (
                                <CommRowDesktop key={`${r.id}-${r.recordType}-${i}`} r={r} isAdmin={isAdmin} onApprove={handleApprove} odd={i % 2 === 1} />
                            ))}
                        </>
                    )}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </TabScreenLayout>
    );
}

// ── Main Tab Styles ───────────────────────────────────────────
const MT = StyleSheet.create({
    wrap: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    label: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
});

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
});