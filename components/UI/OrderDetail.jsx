// components/UI/OrderDetail.jsx
// Panel chi tiết đơn hàng — dùng ở order.jsx (web) và OrderView (mobile)

import { showAlert } from '@/components/Main/showAlert';
import { createNotification, getRoomIdByOrderId, sendStatusUpdateMessage } from '@/components/Utils/chatService';
import { fmtCurrency } from '@/components/Utils/formatters';
import { isAdmin as checkAdmin } from '@/components/Utils/roleHelper';
import { syncServiceStatusFromOrder } from '@/components/Utils/syncOrderStatus';
import { db } from '@/config/firebaseConfig';
import statusConfig from '@/config/status.json';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';

const isWeb = Platform.OS === 'web';
const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

// ── Xuất biên bản bàn giao ────────────────────────────────────
async function _getLogo() {
    try {
        const { Asset } = await import('expo-asset');
        const a = Asset.fromModule(require('../../assets/images/logo-light.png'));
        await a.downloadAsync();
        return a.uri;
    } catch { return null; }
}

async function _printHtml(html) {
    if (isWeb) {
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 400);
    } else {
        try {
            const Print = await import('expo-print');
            await Print.printAsync({ html });
        } catch (e) { console.error(e); }
    }
}

function _buildHandoverHtml({ order, seller, logoBase64 }) {
    const fN = (n) => Math.round(n || 0).toLocaleString('vi-VN');
    const fV = (n) => fN(n) + ' đ';
    const hdNum = `BB-${new Date().getFullYear()}-${(order.id || '001').slice(-6).padStart(6, '0')}`;
    const today = new Date().toLocaleDateString('vi-VN');
    const items = order.items || [];
    const subtotal = items.reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);
    const rows = items.map((p, i) => `<tr>
      <td style="text-align:center;color:#94a3b8">${i + 1}</td>
      <td>${p.name || ''}</td>
      <td style="text-align:center">${fN(p.qty)}</td>
      <td style="text-align:right">${fV(p.price)}</td>
      <td style="text-align:right;font-weight:600">${fV(PARSE(p.price) * PARSE(p.qty || 1))}</td>
      <td style="color:#64748b;font-style:italic">${p.note || '—'}</td>
    </tr>`).join('');
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Biên bản ${hdNum}</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#0f172a;font-size:13px;position:relative}
.watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);width:80%;opacity:0.1;pointer-events:none;z-index:0;object-fit:contain}
body>*:not(.watermark){position:relative;z-index:1}
h1{font-size:20px;font-weight:700;margin:0 0 4px;text-align:center}
.sub{color:#64748b;font-size:12px;text-align:center;margin-bottom:8px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0 20px}
.party{border-radius:8px;padding:14px;border:1px solid #e2e8f0}
.party-title{font-size:10px;font-weight:700;letter-spacing:.06em;color:#185fa5;text-transform:uppercase;margin-bottom:8px}
.party-name{font-size:15px;font-weight:700;margin-bottom:4px}
.party-detail{font-size:11px;color:#64748b;line-height:1.6}
table{width:100%;border-collapse:collapse;margin:12px 0}
th{font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;padding:10px 12px;text-align:left;border-bottom:1px solid #e2e8f0}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
.tfoot td{font-weight:600;font-size:13px;border-top:1px solid #e2e8f0}
.total-row td{font-size:15px;font-weight:700;color:#185fa5}
.info-box{border-radius:8px;padding:12px;margin:16px 0;font-size:12px;color:#64748b}
.terms{font-size:11px;color:#94a3b8;line-height:1.7;margin:12px 0}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
.sig-col{border-top:1px solid #cbd5e1;padding-top:10px;text-align:center}
.sig-label{font-size:11px;color:#64748b;margin-bottom:40px}
.sig-name{font-size:13px;font-weight:700}
@media print{body{padding:16px}}</style></head><body>
${logoBase64 ? `<img class="watermark" src="${logoBase64}" alt=""/>` : ''}
<h1>BIÊN BẢN BÀN GIAO HÀNG HỆ THỐNG LỌC TỔNG SINH HOẠT</h1>
<div class="sub">Mã biên bản: ${hdNum} &nbsp;·&nbsp; Ngày ${today}</div>
<div class="parties">
  <div class="party"><div class="party-title">Bên nhận (A)</div><div class="party-name">${order.customer || '—'}</div>
  <div class="party-detail">SĐT: ${order.phone || '—'}<br>Địa chỉ: ${order.address || '—'}</div></div>
  <div class="party"><div class="party-title">Bên giao (B)</div><div class="party-name">${seller?.name || 'SWD Company'}</div>
  <div class="party-detail">SĐT: ${seller?.phone || '—'}<br>Email: ${seller?.email || '—'}</div></div>
</div>
<table><thead><tr>
  <th style="width:30px">#</th><th>Sản phẩm</th>
  <th style="width:60px;text-align:center">SL</th>
  <th style="width:110px;text-align:right">Đơn giá</th>
  <th style="width:120px;text-align:right">Thành tiền</th>
  <th style="width:120px">Ghi chú</th>
</tr></thead><tbody>${rows}</tbody>
<tfoot>
  <tr class="total-row"><td colspan="4">Tổng thanh toán</td><td style="text-align:right">${fV(subtotal)}</td><td></td></tr>
</tfoot></table>
<div class="info-box">${order.note ? 'Ghi chú: ' + order.note : 'Ghi chú: Không có'}</div>
<div class="terms">${order.orderType === 'buon'
            ? 'Hàng hoá được kiểm tra tại thời điểm giao nhận. Mọi khiếu nại cần phản ánh trong vòng 24 giờ kể từ khi nhận hàng.'
            : 'Lắp đặt miễn phí trong vòng 24 giờ kể từ khi giao hàng thành công.'}</div>
<div class="sig">
  <div class="sig-col"><div class="sig-label">Đại diện bên nhận</div><div class="sig-name">${order.customer || '—'}</div><div style="font-size:11px;color:#94a3b8">Ký và ghi rõ họ tên</div></div>
  <div class="sig-col"><div class="sig-label">Đại diện bên giao</div><div class="sig-name">${seller?.name || 'SWD Company'}</div><div style="font-size:11px;color:#94a3b8">Ký và đóng dấu</div></div>
</div></body></html>`;
}

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

const LOCKED_STATUSES = ['Đã thanh toán', 'Hoàn thành', 'Đã hủy', 'CANCELLED', 'PENDING', 'COMPLETED'];

// Lấy danh sách trạng thái theo loại đơn từ status.json
const getStatusOptions = (orderType) => {
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    return (statusConfig[key] || statusConfig['don_le']).map(s => s.name);
};

// Kiểm tra trạng thái hiện tại có được phép thay đổi không
const isStatusChangeable = (orderType, currentStatus) => {
    if (!currentStatus || ['CANCELLED', 'PENDING', 'COMPLETED'].includes(currentStatus)) return false;
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    const found = (statusConfig[key] || statusConfig['don_le']).find(s => s.name === currentStatus);
    return found ? found.changeable : false;
};

// ── Status Chip ───────────────────────────────────────────────
export function StatusChip({ status, onPress, dropdown }) {
    const cfg = scfg(status);
    return (
        <TouchableOpacity
            style={[SD.chip, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
            disabled={!onPress}
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
                    <TouchableOpacity
                        key={s}
                        style={[SD.menuItem, active && { backgroundColor: cfg.bg }]}
                        onPress={() => { onChange(s); onClose(); }}
                    >
                        <View style={[SD.dot, { backgroundColor: cfg.c }]} />
                        <Text style={[SD.menuText, { color: active ? cfg.c : '#374151', fontWeight: active ? '700' : '500' }]}>
                            {s}
                        </Text>
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
    menu: { position: 'absolute', zIndex: 9999, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 180, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    menuText: { fontSize: 13 },
});

// ── OrderDetail Panel ─────────────────────────────────────────
export default function OrderDetail({ order, onClose, onUpdated, role }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const admin = checkAdmin(role);
    const chipRef = useRef(null);

    // ── State — khai báo TRƯỚC mọi return ──
    const [localOrder, setLocalOrder] = useState(null);
    const [services, setServices] = useState([]);
    const [svLoading, setSvLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
    const [updating, setUpdating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [orderCreator, setOrderCreator] = useState(null);

    // ── Fetch helpers — dùng useCallback để không phụ thuộc closure ──
    const fetchServices = useCallback(async (orderId) => {
        if (!orderId) return;
        setSvLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'service'), where('orderId', '==', orderId))
            );
            setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })));
        } catch (_) { }
        finally { setSvLoading(false); }
    }, []);

    const fetchOrderCreator = useCallback(async (o) => {
        try {
            const phone = o?.phone || o?.customerPhone;
            if (!phone) return;
            const custSnap = await getDocs(
                query(collection(db, 'customers'), where('phone', '==', phone))
            );
            if (!custSnap.empty) {
                setOrderCreator(custSnap.docs[0].data().createdBy || null);
            }
        } catch (_) { }
    }, []);

    // ── Effect — 1 useEffect duy nhất ──
    useEffect(() => {
        if (order) {
            setLocalOrder(order);
            setMenuOpen(false);
            fetchServices(order.id);
            fetchOrderCreator(order);
        }
    }, [order, fetchServices, fetchOrderCreator]);

    // ── Guard — đặt SAU toàn bộ hooks ──
    if (!order || !localOrder) return null;

    // ── Derived values ──
    const total = (localOrder.items || []).reduce(
        (s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0
    );
    const tcfg = TYPE_CFG[localOrder.orderType];
    const date = localOrder.createdAt
        ? new Date(localOrder.createdAt).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        })
        : null;

    // Quyền sửa: admin hoặc người tạo đơn, trừ các trạng thái đã khoá
    const isCreator = !!orderCreator && orderCreator === userDetail?.email;
    const canEditOrder = (admin || isCreator)
        && !LOCKED_STATUSES.includes(localOrder.status);

    // Quyền đổi status: chỉ admin
    const canChangeStatus = admin
        && isStatusChangeable(localOrder.orderType, localOrder.status);

    // ── Handlers ──
    const handleExport = async () => {
        setExporting(true);
        try {
            const logo = await _getLogo();
            const html = _buildHandoverHtml({ order: localOrder, seller: userDetail, logoBase64: logo });
            await _printHtml(html);
        } catch (e) { console.error(e); }
        finally { setExporting(false); }
    };

    const openMenu = () => {
        if (!canChangeStatus || !chipRef.current) return;
        chipRef.current.measure((_fx, _fy, width, height, pageX, pageY) => {
            const sw = Dimensions.get('window').width;
            setMenuPos({ top: pageY + height + 4, right: sw - pageX - width });
            setMenuOpen(true);
        });
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

                // Sync service + gửi chat message (fire-and-forget)
                Promise.resolve(
                    syncServiceStatusFromOrder(localOrder.id, newStatus)
                ).catch(() => { });
                sendStatusUpdateMessage({
                    orderId: localOrder.id,
                    newStatus,
                    changedBy: userDetail?.email,
                    changedByName: userDetail?.name,
                }).catch(() => { });

                // Thông báo người tạo đơn → dẫn tới màn chat
                const roomId = getRoomIdByOrderId(localOrder.id);
                if (orderCreator && orderCreator !== userDetail?.email) {
                    await createNotification({
                        userEmail: orderCreator,
                        type: 'order_status_changed',
                        title: '🔄 Trạng thái đơn hàng thay đổi',
                        body: `Đơn #${localOrder.id} (KH: ${localOrder.customer || '—'}) chuyển sang "${newStatus}"`,
                        orderId: localOrder.id,
                        roomId,
                        path: `/chat/${roomId}?orderId=${localOrder.id}`,
                    });
                }

                const next = { ...localOrder, status: newStatus };
                setLocalOrder(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setUpdating(false); setMenuOpen(false); }
        });
    };

    // ── Render ──
    return (
        <View style={DP.root}>
            {/* ── Header ── */}
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
                    {/* Xuất HĐ */}
                    <TouchableOpacity style={DP.aBtn} onPress={handleExport} disabled={exporting}>
                        {exporting
                            ? <ActivityIndicator size="small" color="#2563EB" style={{ width: 13 }} />
                            : <Ionicons name="document-text-outline" size={13} color="#2563EB" />
                        }
                        <Text style={DP.aBtnText}>{exporting ? 'Đang xuất...' : 'Xuất HĐ'}</Text>
                    </TouchableOpacity>

                    {/* Chat */}
                    <TouchableOpacity
                        style={DP.aBtn}
                        onPress={() => router.push({
                            pathname: '/chat/[roomID]',
                            params: {
                                roomID: getRoomIdByOrderId(localOrder.id),
                                orderId: localOrder.id,
                            },
                        })}
                    >
                        <Ionicons name="chatbubble-outline" size={13} color="#2563EB" />
                        <Text style={DP.aBtnText}>Chat</Text>
                    </TouchableOpacity>

                    {/* Sửa — admin hoặc người tạo đơn, trạng thái chưa khoá */}
                    {canEditOrder && (
                        <TouchableOpacity
                            style={DP.aBtn}
                            onPress={() => router.push({
                                pathname: '/editOrder/[orderID]',
                                params: {
                                    orderID: localOrder.id,
                                    orderParam: JSON.stringify(localOrder),
                                },
                            })}
                        >
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={DP.aBtnText}>Sửa</Text>
                        </TouchableOpacity>
                    )}

                    {/* Status chip — measure để định vị modal menu */}
                    <View ref={chipRef} collapsable={false}>
                        {updating
                            ? <ActivityIndicator size="small" color="#2563EB" />
                            : <StatusChip
                                status={localOrder.status}
                                dropdown={canChangeStatus}
                                onPress={canChangeStatus ? openMenu : undefined}
                            />
                        }
                    </View>
                </View>
            </View>

            {/* ── Status dropdown — dùng Modal để vượt overflow ── */}
            {menuOpen && admin && (
                <Modal
                    transparent
                    statusBarTranslucent
                    animationType="none"
                    onRequestClose={() => setMenuOpen(false)}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={() => setMenuOpen(false)}
                    />
                    <StatusMenu
                        status={localOrder.status}
                        options={getStatusOptions(localOrder.orderType)}
                        onChange={handleStatusChange}
                        onClose={() => setMenuOpen(false)}
                        style={{ top: menuPos.top, right: menuPos.right }}
                    />
                </Modal>
            )}

            {/* ── Body ── */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

                {/* 2-col: khách hàng + dịch vụ */}
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
                                <View style={DP.svCountBadge}>
                                    <Text style={DP.svCountText}>{services.length}</Text>
                                </View>
                            )}
                        </View>
                        {svLoading
                            ? <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} />
                            : services.length === 0
                                ? <Text style={DP.noSv}>Chưa có dịch vụ</Text>
                                : services.slice(0, 2).map((sv, i) => {
                                    const c = scfg(sv.status);
                                    return (
                                        <View key={sv.docId || i} style={DP.svRow}>
                                            <Ionicons name="construct-outline" size={13} color="#8B5CF6" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={DP.svId}>#{sv.id || sv.docId?.slice(-6)}</Text>
                                                <Text style={DP.svType}>
                                                    {sv.type === 'DELIVERY' ? 'Giao hàng' : 'Lắp đặt'}
                                                </Text>
                                            </View>
                                            <View style={[DP.svStatus, { backgroundColor: c.bg }]}>
                                                <Text style={[DP.svStatusText, { color: c.c }]}>
                                                    {sv.status || 'Chờ xử lý'}
                                                </Text>
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
                        <View style={DP.sectionIcon}>
                            <Ionicons name="water-outline" size={13} color="#2563EB" />
                        </View>
                        <Text style={DP.sectionTitle}>Sản phẩm</Text>
                        <View style={DP.sectionBadge}>
                            <Text style={DP.sectionBadgeText}>{(localOrder.items || []).length}</Text>
                        </View>
                    </View>
                    {(localOrder.items || []).map((p, i) => {
                        const lt = PARSE(p.price) * PARSE(p.qty || 1);
                        return (
                            <View key={i} style={DP.prodRow}>
                                <View style={DP.prodIcon}>
                                    <Ionicons name="water-outline" size={14} color="#2563EB" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={DP.prodName}>{p.name}</Text>
                                    <Text style={DP.prodSub}>
                                        x{p.qty || 1} · {fmtCurrency(PARSE(p.price))}
                                    </Text>
                                </View>
                                <Text style={DP.prodTotal}>{fmtCurrency(lt)}</Text>
                            </View>
                        );
                    })}
                    {localOrder.note && (
                        <View style={DP.noteBox}>
                            <Text style={DP.noteText}>{localOrder.note}</Text>
                        </View>
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
    root: { width: 360, backgroundColor: '#fff', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', borderRadius: isWeb ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
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