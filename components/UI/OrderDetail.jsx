// components/UI/OrderDetail.jsx
// Panel chi tiết đơn hàng — dùng ở order.jsx (web) và OrderView (mobile)

import { showAlert } from '@/components/Main/showAlert';
import { getRoomIdByOrderId, sendStatusUpdateMessage } from '@/components/Utils/chatService';
import { fmtCurrency } from '@/components/Utils/formatters';
import { isAdmin as checkAdmin } from '@/components/Utils/roleHelper';
import { syncServiceStatusFromOrder } from '@/components/Utils/syncOrderStatus';
import statusConfig from '@/config/status.json';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';

const isWeb = Platform.OS === 'web';
const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

// ── Status config ─────────────────────────────────────────────
const S_CFG = {
    'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
    'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
    'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
    'Đã lắp đặt': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
    'Chờ thanh toán': { c: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
    'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
    'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
    'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
    'PENDING': { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' },
};
const scfg = (s) => S_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const TYPE_CFG = {
    buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
    le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};

// Lấy danh sách trạng thái theo loại đơn từ status.json
const getStatusOptions = (orderType) => {
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    return (statusConfig[key] || statusConfig['don_le']).map(s => s.name);
};

// Kiểm tra trạng thái hiện tại có được phép thay đổi không
const isStatusChangeable = (orderType, currentStatus) => {
    // Các trạng thái tiếng Anh cũ luôn bị khoá
    if (!currentStatus || ['CANCELLED', 'PENDING', 'COMPLETED'].includes(currentStatus)) return false;
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    const found = (statusConfig[key] || statusConfig['don_le']).find(s => s.name === currentStatus);
    // Fallback false: trạng thái không tìm thấy trong config → không cho đổi
    return found ? found.changeable : false;
};

// ── Status Chip ───────────────────────────────────────────────
export function StatusChip({ status, onPress, dropdown }) {
    const cfg = scfg(status);
    return (
        <TouchableOpacity
            style={[SD.chip, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={[SD.dot, { backgroundColor: cfg.c }]} />
            <Text style={[SD.text, { color: cfg.c }]}>{status || 'PENDING'}</Text>
            {dropdown && <Ionicons name="chevron-down" size={11} color={cfg.c} />}
        </TouchableOpacity>
    );
}

// ── Status Menu ───────────────────────────────────────────────
export function StatusMenu({ status, options, onChange, onClose, style }) {
    return (
        <View style={[SD.menu, style]}>
            {(options || getStatusOptions('le')).map(s => {
                const cfg = scfg(s);
                const active = s === status;
                return (
                    <TouchableOpacity key={s}
                        style={[SD.menuItem, active && { backgroundColor: cfg.bg }]}
                        onPress={() => { onChange(s); onClose(); }}
                    >
                        <View style={[SD.dot, { backgroundColor: cfg.c }]} />
                        <Text style={[SD.menuText, { color: active ? cfg.c : '#374151', fontWeight: active ? '700' : '500' }]}>{s}</Text>
                        {active && <Ionicons name="checkmark" size={13} color={cfg.c} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const SD = StyleSheet.create({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 12, fontWeight: '700' },
    menu: { position: 'absolute', top: 32, right: 0, zIndex: 999, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 180, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    menuText: { fontSize: 13 },
});

// ── OrderDetail Panel ─────────────────────────────────────────
export default function OrderDetail({ order, onClose, onUpdated, role }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const admin = checkAdmin(role);

    const chipRef = useRef(null);
    const [localOrder, setLocalOrder] = useState(null);
    const [services, setServices] = useState([]);
    const [svLoading, setSvLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
    const [updating, setUpdating] = useState(false);

    const openMenu = () => {
        if (chipRef.current) {
            chipRef.current.measure((_fx, _fy, width, height, pageX, pageY) => {
                const sw = Dimensions.get('window').width;
                setMenuPos({ top: pageY + height + 4, right: sw - pageX - width });
                setMenuOpen(true);
            });
        }
    };

    useEffect(() => {
        if (order) { setLocalOrder(order); fetchServices(order.id); }
    }, [order]);

    const fetchServices = async (orderId) => {
        if (!orderId) return;
        setSvLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'service'), where('orderId', '==', orderId)));
            setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })));
        } catch (_) { }
        finally { setSvLoading(false); }
    };

    const handleStatusChange = async (newStatus) => {
        if (!admin || !localOrder) return;
        showAlert('Cập nhật trạng thái', `Chuyển sang "${newStatus}"?`, async () => {
            setUpdating(true);
            try {
                const phone = localOrder.phone || localOrder.customerPhone;
                const ref = doc(db, 'orders', phone);
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const ordersChange = (snap.data().orders || []).map(o =>
                    o.id === localOrder.id ? { ...o, status: newStatus } : o
                );
                await updateDoc(ref, { orders: ordersChange });
                // Auto-sync linked service status
                Promise.resolve(syncServiceStatusFromOrder(localOrder.id, newStatus)).catch(() => { });
                const next = { ...localOrder, status: newStatus };
                setLocalOrder(next);
                onUpdated?.(next);
                sendStatusUpdateMessage({
                    orderId: localOrder.id, newStatus,
                    changedBy: userDetail?.email, changedByName: userDetail?.name,
                }).catch(() => { });
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setUpdating(false); }
        });
    };

    if (!order || !localOrder) return null;

    const total = (localOrder.items || []).reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);
    const tcfg = TYPE_CFG[localOrder.orderType];
    const date = localOrder.createdAt
        ? new Date(localOrder.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    return (
        <View style={DP.root}>
            {/* Header */}
            <View style={DP.header}>
                <View style={DP.headerTop}>
                    {date && <Text style={DP.date}>{date}</Text>}
                    <TouchableOpacity style={DP.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                </View>
                <View style={DP.titleRow}>
                    <Text style={DP.title}>Order #{localOrder.id}</Text>
                    {tcfg && (
                        <View style={[DP.typePill, { backgroundColor: tcfg.bg }]}>
                            <Text style={[DP.typePillText, { color: tcfg.c }]}>{tcfg.label}</Text>
                        </View>
                    )}
                </View>
                <View style={DP.actions}>
                    <TouchableOpacity style={DP.aBtn}
                        onPress={() => router.push({ pathname: '/orderContract', params: { orderParam: JSON.stringify(localOrder) } })}>
                        <Ionicons name="document-text-outline" size={13} color="#2563EB" />
                        <Text style={DP.aBtnText}>Xem HĐ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={DP.aBtn}
                        onPress={() => router.push({ pathname: '/chat/[roomID]', params: { roomID: getRoomIdByOrderId(localOrder.id), orderId: localOrder.id } })}>
                        <Ionicons name="chatbubble-outline" size={13} color="#2563EB" />
                        <Text style={DP.aBtnText}>Chat</Text>
                    </TouchableOpacity>
                    {(admin || localOrder.createdBy === userDetail?.email) && localOrder.status === 'Chờ xác nhận' && (
                        <TouchableOpacity style={DP.aBtn}
                            onPress={() => router.push({ pathname: '/editOrder/[orderID]', params: { orderID: localOrder.id, orderParam: JSON.stringify(order) } })}>
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={DP.aBtnText}>Sửa</Text>
                        </TouchableOpacity>
                    )}
                    <View ref={chipRef} collapsable={false}>
                        {updating
                            ? <ActivityIndicator size="small" color="#2563EB" />
                            : <StatusChip
                                status={localOrder.status}
                                dropdown={admin && isStatusChangeable(localOrder.orderType, localOrder.status)}
                                onPress={admin && isStatusChangeable(localOrder.orderType, localOrder.status) ? openMenu : undefined}
                              />
                        }
                    </View>
                </View>
            </View>

            {menuOpen && admin && (
                <Modal transparent statusBarTranslucent animationType="none" onRequestClose={() => setMenuOpen(false)}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setMenuOpen(false)} />
                    <StatusMenu
                        status={localOrder.status}
                        options={getStatusOptions(localOrder.orderType)}
                        onChange={handleStatusChange}
                        onClose={() => setMenuOpen(false)}
                        style={{ top: menuPos.top, right: menuPos.right }}
                    />
                </Modal>
            )}

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* 2-col info */}
                <View style={DP.infoGrid}>
                    <View style={[DP.infoCol, { borderRightWidth: 0.5, borderRightColor: '#F1F5F9' }]}>
                        <View style={DP.infoColLabel}>
                            <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoColLabelText}>Khách hàng</Text>
                        </View>
                        <View style={DP.infoRow2}>
                            <Ionicons name="person-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoVal}>{localOrder.customer}</Text>
                        </View>
                        {localOrder.address && (
                            <View style={DP.infoRow2}>
                                <Ionicons name="location-outline" size={13} color="#94A3B8" />
                                <Text style={DP.infoSub} numberOfLines={2}>{localOrder.address}</Text>
                            </View>
                        )}
                    </View>
                    <View style={DP.infoCol}>
                        <View style={DP.infoColLabel}>
                            <Ionicons name="construct-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoColLabelText}>Dịch vụ</Text>
                            {services.length > 0 && (
                                <View style={DP.svCountBadge}><Text style={DP.svCountText}>{services.length}</Text></View>
                            )}
                        </View>
                        {svLoading ? <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} /> :
                            services.length === 0 ? <Text style={DP.noSv}>Chưa có dịch vụ</Text> :
                                services.slice(0, 2).map((sv, i) => {
                                    const c = scfg(sv.status);
                                    return (
                                        <View key={sv.docId || i} style={DP.svRow}>
                                            <Ionicons name="construct-outline" size={13} color="#8B5CF6" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={DP.svId}>#{sv.id || sv.docId?.slice(-6)}</Text>
                                                <Text style={DP.svType}>{sv.type === 'DELIVERY' ? 'Giao hàng' : 'Lắp đặt'}</Text>
                                            </View>
                                            <View style={[DP.svStatus, { backgroundColor: c.bg }]}>
                                                <Text style={[DP.svStatusText, { color: c.c }]}>{sv.status || 'Chờ xử lý'}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                        }
                        {services.length > 0 && (
                            <TouchableOpacity style={{ marginTop: 6 }}>
                                <Text style={DP.svLink}>Xem tất cả dịch vụ →</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Sản phẩm */}
                <View style={DP.section}>
                    <View style={DP.sectionHead}>
                        <View style={DP.sectionIcon}><Ionicons name="water-outline" size={13} color="#2563EB" /></View>
                        <Text style={DP.sectionTitle}>Sản phẩm</Text>
                        <View style={DP.sectionBadge}><Text style={DP.sectionBadgeText}>{(localOrder.items || []).length}</Text></View>
                    </View>
                    {(localOrder.items || []).map((p, i) => {
                        const lt = PARSE(p.price) * PARSE(p.qty || 1);
                        return (
                            <View key={i} style={DP.prodRow}>
                                <View style={DP.prodIcon}><Ionicons name="water-outline" size={14} color="#2563EB" /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={DP.prodName}>{p.name}</Text>
                                    <Text style={DP.prodSub}>x{p.qty || 1} · {fmtCurrency(PARSE(p.price))}</Text>
                                </View>
                                <Text style={DP.prodTotal}>{fmtCurrency(lt)}</Text>
                            </View>
                        );
                    })}
                    {localOrder.note && (
                        <View style={DP.noteBox}><Text style={DP.noteText}>{localOrder.note}</Text></View>
                    )}
                </View>

                {/* Total bar */}
                <View style={DP.totalBar}>
                    <Text style={DP.totalLabel}>Tổng cộng</Text>
                    <Text style={DP.totalValue}>{fmtCurrency(total)}</Text>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const DP = StyleSheet.create({
    root: { width: 360, backgroundColor: 'transparent', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', borderRadius: isWeb ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
    header: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 6 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    date: { fontSize: 11, color: '#94A3B8' },
    closeBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    typePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    typePillText: { fontSize: 10, fontWeight: '700' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    infoGrid: { flexDirection: 'row', paddingVertical: 14 },
    infoCol: { flex: 1, paddingHorizontal: 14, gap: 6 },
    infoColLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    infoColLabelText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.06 },
    infoRow2: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    infoVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
    infoSub: { fontSize: 11, color: '#64748B', lineHeight: 16, flex: 1 },
    svCountBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    svCountText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    noSv: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    svRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: '#F8FAFC' },
    svId: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    svType: { fontSize: 11, color: '#64748B' },
    svStatus: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    svStatusText: { fontSize: 10, fontWeight: '700' },
    svLink: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
    section: { paddingHorizontal: 16, paddingVertical: 12 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    sectionIcon: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1 },
    sectionBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    sectionBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    prodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: '#F8FAFC' },
    prodIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    prodName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    prodSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    prodTotal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    noteBox: { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 0.5, borderColor: '#E2E8F0' },
    noteText: { fontSize: 12, color: '#64748B', lineHeight: 17 },
    totalBar: { margin: 16, borderRadius: 12, backgroundColor: '#1E3A5F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18 },
    totalLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    totalValue: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
});