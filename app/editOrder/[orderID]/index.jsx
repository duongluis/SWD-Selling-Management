// app/editOrder/[orderID]/index.jsx

import BgWatermark from '@/components/Main/BgWatermark';
import { createNotification } from '@/components/Utils/chatService';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
    KeyboardAvoidingView, Modal, Platform, Pressable,
    ScrollView, StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../../components/Main/showAlert';
import { showSuccess } from '../../../components/Main/showSuccess';
import { db } from '../../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';
import HelpButton from '@/components/Help/HelpButton';

const toDateStr = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};
const toDisplayStr = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const ORDER_TYPE_CONFIG = {
    buon: { label: 'Đơn buôn', color: '#2563EB', bg: '#EFF6FF', icon: 'cube-outline' },
    le: { label: 'Đơn lẻ', color: '#8B5CF6', bg: '#F5F3FF', icon: 'home-outline' },
};

const STATUS_CONFIG = {
    PENDING: { label: 'Chờ lắp đặt', color: '#F59E0B', bg: '#FFFBEB' },
    SHIPPED: { label: 'Đang giao hàng', color: '#3B82F6', bg: '#EFF6FF' },
    CONFIRMED: { label: 'Đã thanh toán', color: '#8B5CF6', bg: '#F5F3FF' },
    COMPLETED: { label: 'Hoàn thành', color: '#10B981', bg: '#ECFDF5' },
};

// ── Date Field ────────────────────────────────────────────────
function DateField({ value, onChange, webStyle }) {
    const [show, setShow] = useState(false);
    const [sel, setSel] = useState(new Date());
    const { isDesktop } = useLayout();

    const onNative = (_, date) => {
        if (Platform.OS === 'android') setShow(false);
        if (date) { setSel(date); onChange(toDateStr(date)); }
    };
    return isDesktop ? (
        <View style={webStyle || S.inputBox}>
            {/* lang="sv-SE" ép thứ tự nhập yyyy/mm/dd (năm trước) thay vì dd/mm/yyyy theo locale máy */}
            <input
                type="date"
                lang="sv-SE"
                value={value || ''}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', fontWeight: '500', cursor: 'pointer', width: '100%' }}
                onChange={e => { if (e.target.value) onChange(e.target.value); }}
            />
            <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
        </View>
    ) :
        (
            <>
                <TouchableOpacity style={S.inputBox} onPress={() => setShow(true)} activeOpacity={0.8}>
                    <Text style={{ flex: 1, fontSize: 14, color: value ? '#0F172A' : '#B0B0C8' }}>
                        {value ? toDisplayStr(value) : 'Chọn ngày...'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#B0B0C8" />
                </TouchableOpacity>
                {show && Platform.OS === 'ios' && (
                    <Modal transparent animationType="slide">
                        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShow(false)} />
                        <View style={{ backgroundColor: '#fff', padding: 16 }}>
                            <DateTimePicker value={sel} mode="date" display="spinner" onChange={onNative} />
                            <Pressable onPress={() => setShow(false)} style={{ alignItems: 'center', padding: 12 }}>
                                <Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text>
                            </Pressable>
                        </View>
                    </Modal>
                )}
                {show && Platform.OS === 'android' && (
                    <DateTimePicker value={sel} mode="date" display="default" onChange={onNative} />
                )}
            </>
        );
}

export default function EditOrder() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { userDetail } = useContext(UserDetailContext);
    const { isDesktop } = useLayout();

    const existing = params.orderParam ? JSON.parse(params.orderParam) : {};
    const phone = existing.customerPhone || existing._phone || '';

    const _role = (userDetail?.role || userDetail?.member || '').toLowerCase();
    const isAdmin = _role === 'admin';
    const isCTV = ['cộng tác viên', 'ctv', 'collaborator'].includes(_role);

    const canEdit = isAdmin || !isCTV;

    const [orderDate, setOrderDate] = useState(existing.createdAt || '');
    const [deliveryAddress, setDeliveryAddress] = useState(existing.address || '');
    const [notes, setNotes] = useState(existing.note || '');
    const [items, setItems] = useState(existing.items || []);
    const [submitting, setSubmitting] = useState(false);

    const updateItemQty = (id, qty) =>
        setItems(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, parseInt(qty) || 1) } : p));
    const removeItem = (id) => {
        if (items.length <= 1) { showAlert('Thông báo', 'Đơn hàng phải có ít nhất 1 sản phẩm'); return; }
        setItems(prev => prev.filter(p => p.id !== id));
    };
    const total = items.reduce((s, p) => s + (p.price * p.qty || 0), 0);

    const handleSubmit = async () => {
        if (!phone) { showAlert('Lỗi', 'Không xác định được số điện thoại'); return; }
        setSubmitting(true);
        try {
            const orderRef = doc(db, 'orders', existing.id);
            await updateDoc(orderRef, {
                createdAt: orderDate,
                address: deliveryAddress,
                note: notes,
                items: items,
            });

            let createdBy = null;
            try {
                const custSnap = await getDocs(
                    query(collection(db, 'customers'), where('phone', '==', phone))
                );
                if (!custSnap.empty) {
                    createdBy = custSnap.docs[0].data().createdBy || null;
                }
            } catch (_) { }

            const roomId = `order_${existing.id}`;

            if (isAdmin) {
                if (createdBy && createdBy !== userDetail?.email) {
                    await createNotification({
                        userEmail: createdBy,
                        type: 'order_updated',
                        title: '📝 Đơn hàng đã được cập nhật',
                        body: `Admin đã cập nhật thông tin đơn #${existing.id} (KH: ${existing.customer || '—'})`,
                        orderId: existing.id,
                        roomId,
                        path: '/(tabs)/order',
                    });
                }
            } else {
                const adminSnap = await getDocs(
                    query(collection(db, 'users'), where('role', '==', 'admin'))
                );
                await Promise.all(
                    adminSnap.docs.map(d => {
                        const adminEmail = d.data().email;
                        if (!adminEmail || adminEmail === userDetail?.email) return Promise.resolve();
                        return createNotification({
                            userEmail: adminEmail,
                            type: 'order_updated',
                            title: '📝 Đơn hàng vừa được sửa',
                            body: `${userDetail?.name || userDetail?.email} đã sửa thông tin đơn #${existing.id} (KH: ${existing.customer || '—'})`,
                            orderId: existing.id,
                            roomId,
                            path: '/(tabs)/order',
                        });
                    })
                );
            }

            showSuccess('Đã cập nhật đơn hàng!', `Mã đơn: ${existing.id}`, () => router.back());
        } catch (e) {
            showAlert('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const statusCfg = STATUS_CONFIG[existing.status] || STATUS_CONFIG.PENDING;
    const typeCfg = ORDER_TYPE_CONFIG[existing.orderType];
    const mobileBody = (
        <View style={[S.formCard, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>

            <View style={S.group}>
                <Text style={S.label}>Order ID</Text>
                <View style={[S.inputBox, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={{ flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' }}>{existing.id}</Text>
                    <Ionicons name="lock-closed-outline" size={13} color="#CBD5E1" />
                </View>
            </View>

            <View style={S.group}>
                <Text style={S.label}>Ngày giao hàng</Text>
                <DateField value={orderDate} onChange={setOrderDate} />
            </View>

            <View style={S.group}>
                <Text style={S.label}>Địa chỉ giao hàng</Text>
                <View style={[S.inputBox, { alignItems: 'flex-start', minHeight: 72 }]}>
                    <TextInput style={[S.input, { textAlignVertical: 'top' }]} placeholder="Địa chỉ..." placeholderTextColor="#B0B0C8" multiline value={deliveryAddress} onChangeText={setDeliveryAddress} />
                </View>
            </View>

            <View style={S.group}>
                <Text style={S.label}>Ghi chú</Text>
                <View style={[S.inputBox, { alignItems: 'flex-start', minHeight: 72 }]}>
                    <TextInput style={[S.input, { textAlignVertical: 'top' }]} placeholder="Ghi chú..." placeholderTextColor="#B0B0C8" multiline value={notes} onChangeText={setNotes} />
                </View>
            </View>

            <View style={S.group}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[S.label, { flex: 1, marginBottom: 0 }]}>Sản phẩm</Text>
                    {isCTV && (
                        <View style={S.lockBadge}>
                            <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                            <Text style={S.lockText}>CTV không được sửa</Text>
                        </View>
                    )}
                </View>
                {items.map((item, i) => (
                    <View key={item.id || i} style={S.itemRow}>
                        <View style={S.itemIcon}><Ionicons name="water-outline" size={14} color="#2563EB" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={S.itemPrice}>{fmt(item.price)}</Text>
                        </View>
                        {canEdit ? (
                            <View style={S.qtyBox}>
                                <TouchableOpacity onPress={() => updateItemQty(item.id || String(i), item.qty - 1)} style={S.qtyBtn}>
                                    <Ionicons name="remove" size={14} color="#374151" />
                                </TouchableOpacity>
                                <Text style={S.qtyText}>{item.qty}</Text>
                                <TouchableOpacity onPress={() => updateItemQty(item.id || String(i), item.qty + 1)} style={S.qtyBtn}>
                                    <Ionicons name="add" size={14} color="#374151" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text style={S.qtyReadonly}>x{item.qty}</Text>
                        )}
                        <Text style={S.itemTotal}>{fmt(item.price * item.qty)}</Text>
                        {canEdit && (
                            <TouchableOpacity onPress={() => removeItem(item.id || String(i))} style={S.removeBtn}>
                                <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
                <View style={S.totalRow}>
                    <Text style={S.totalLabel}>Tổng cộng</Text>
                    <Text style={S.totalValue}>{fmt(total)}</Text>
                </View>
            </View>

            <TouchableOpacity style={[S.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={20} color="#fff" />
                <Text style={S.submitBtnText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
            </TouchableOpacity>
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // WEB LAYOUT — 2 columns
    // ─────────────────────────────────────────────────────────
    return isDesktop ? (
        <View style={W.root}>
            <BgWatermark />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>

                {/* Page header */}
                <View style={W.pageHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity style={W.backBtn} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={16} color="#64748B" />
                        </TouchableOpacity>
                        <View>
                            <Text style={W.pageTitle}>Sửa đơn hàng</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                <Text style={W.pageSub}>Mã đơn: {existing.id}</Text>
                                {typeCfg && (
                                    <View style={[W.typePill, { backgroundColor: typeCfg.bg }]}>
                                        <Ionicons name={typeCfg.icon} size={11} color={typeCfg.color} />
                                        <Text style={[W.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                                    </View>
                                )}
                                <View style={[W.statusPill, { backgroundColor: statusCfg.bg }]}>
                                    <View style={[W.statusDot, { backgroundColor: statusCfg.color }]} />
                                    <Text style={[W.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <HelpButton screenKey="editOrder" />
                        <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()}>
                            <Ionicons name="close" size={16} color="#64748B" />
                            <Text style={W.cancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 2-column grid */}
                <View style={W.grid}>

                    {/* ── LEFT: thông tin đơn hàng ── */}
                    <View style={W.col}>
                        <View style={W.card}>
                            <View style={W.cardHeader}>
                                <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                                <Text style={W.cardTitle}>Thông tin đơn hàng</Text>
                            </View>

                            {/* Order ID readonly */}
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Order ID</Text>
                                <View style={[W.inputBox, { backgroundColor: '#F1F5F9' }]}>
                                    <Text style={{ flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' }}>{existing.id}</Text>
                                    <Ionicons name="lock-closed-outline" size={13} color="#CBD5E1" />
                                </View>
                            </View>

                            {/* Customer readonly */}
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Khách hàng</Text>
                                <View style={[W.inputBox, { backgroundColor: '#F1F5F9' }]}>
                                    <View style={W.customerAvatar}>
                                        <Text style={W.customerAvatarText}>
                                            {(existing.customer || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </Text>
                                    </View>
                                    <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' }}>
                                        {existing.customer}
                                    </Text>
                                    <Ionicons name="lock-closed-outline" size={13} color="#CBD5E1" />
                                </View>
                            </View>

                            {/* Row: date + address */}
                            <View style={W.row2}>
                                <View style={[W.inputGroup, { flex: 1 }]}>
                                    <Text style={W.label}>Ngày giao hàng</Text>
                                    <DateField
                                        value={orderDate}
                                        onChange={setOrderDate}
                                        webStyle={W.inputBox}
                                    />
                                </View>
                            </View>

                            <View style={W.inputGroup}>
                                <Text style={W.label}>Địa chỉ giao hàng</Text>
                                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}>
                                    <TextInput
                                        style={[W.input, { textAlignVertical: 'top' }]}
                                        placeholder="Địa chỉ..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={deliveryAddress}
                                        onChangeText={setDeliveryAddress}
                                    />
                                </View>
                            </View>

                            <View style={W.inputGroup}>
                                <Text style={W.label}>Ghi chú</Text>
                                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}>
                                    <TextInput
                                        style={[W.input, { textAlignVertical: 'top' }]}
                                        placeholder="Ghi chú đơn hàng..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={notes}
                                        onChangeText={setNotes}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* ── RIGHT: sản phẩm + tổng ── */}
                    <View style={W.colRight}>
                        <View style={W.card}>
                            <View style={W.cardHeader}>
                                <Ionicons name="cube-outline" size={16} color="#2563EB" />
                                <Text style={W.cardTitle}>Sản phẩm</Text>
                                <View style={W.itemCountBadge}>
                                    <Text style={W.itemCountText}>{items.length}</Text>
                                </View>
                                {isCTV && (
                                    <View style={W.lockBadge}>
                                        <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                                        <Text style={W.lockText}>CTV không được sửa</Text>
                                    </View>
                                )}
                            </View>

                            {items.map((item, i) => (
                                <View key={item.id || i} style={W.itemRow}>
                                    <View style={W.itemIcon}>
                                        <Ionicons name="water-outline" size={14} color="#2563EB" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={W.itemName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={W.itemPrice}>{fmt(item.price)} / cái</Text>
                                    </View>

                                    {canEdit ? (
                                        <View style={W.qtyBox}>
                                            <TouchableOpacity
                                                onPress={() => updateItemQty(item.id || String(i), item.qty - 1)}
                                                style={W.qtyBtn}
                                            >
                                                <Ionicons name="remove" size={14} color="#374151" />
                                            </TouchableOpacity>
                                            <Text style={W.qtyText}>{item.qty}</Text>
                                            <TouchableOpacity
                                                onPress={() => updateItemQty(item.id || String(i), item.qty + 1)}
                                                style={W.qtyBtn}
                                            >
                                                <Ionicons name="add" size={14} color="#374151" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <Text style={W.qtyReadonly}>x{item.qty}</Text>
                                    )}

                                    <Text style={W.itemTotal}>{fmt(item.price * item.qty)}</Text>

                                    {canEdit && (
                                        <TouchableOpacity
                                            onPress={() => removeItem(item.id || String(i))}
                                            style={W.removeBtn}
                                        >
                                            <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Divider */}
                            <View style={W.divider} />

                            {/* Total */}
                            <View style={W.totalBox}>
                                <View style={{ flex: 1 }}>
                                    <Text style={W.totalLabel}>Tổng cộng</Text>
                                    <Text style={W.totalSub}>{items.length} sản phẩm</Text>
                                </View>
                                <Text style={W.totalValue}>{fmt(total)}</Text>
                            </View>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[W.submitBtn, submitting && { opacity: 0.7 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'}
                                size={18}
                                color="#fff"
                            />
                            <Text style={W.submitBtnText}>
                                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    ) :

        // ─────────────────────────────────────────────────────────
        // MOBILE LAYOUT — hiển thị dọc
        // ─────────────────────────────────────────────────────────


        (
            <View style={{ flex: 1, backgroundColor: '#0A0F2C', paddingTop: insets.top }}>
                <BgWatermark />
                <StatusBar barStyle="light-content" backgroundColor="#0A0F2C" />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Sửa đơn hàng</Text>
                    <View style={{ width: 36 }} />
                </View>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                        {mobileBody}
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        );
}

// ── Web Styles ────────────────────────────────────────────────
const W = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 40 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    backBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    pageSub: { fontSize: 13, color: '#64748B' },
    typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    typePillText: { fontSize: 11, fontWeight: '700' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 11, fontWeight: '600' },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

    grid: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    col: { flex: 3 },
    colRight: { flex: 2, gap: 16 },

    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
    itemCountBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    itemCountText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
    lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    lockText: { fontSize: 10, color: '#94A3B8' },

    row2: { flexDirection: 'row', gap: 12 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },

    customerAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    customerAvatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: 10 },
    itemIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    itemPrice: { fontSize: 11, color: '#64748B', marginTop: 2 },
    qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
    qtyBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    qtyText: { fontSize: 14, fontWeight: '700', color: '#0F172A', minWidth: 24, textAlign: 'center' },
    qtyReadonly: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    itemTotal: { fontSize: 13, fontWeight: '700', color: '#2563EB', minWidth: 80, textAlign: 'right' },
    removeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },

    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 14 },
    totalBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', borderRadius: 12, padding: 16 },
    totalLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
    totalSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
    totalValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ── Mobile Styles ─────────────────────────────────────────────
const S = StyleSheet.create({
    formCard: { backgroundColor: '#F8F9FF', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 8 },
    group: { marginBottom: 18 },
    label: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3, marginBottom: 8 },
    lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    lockText: { fontSize: 10, color: '#94A3B8' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 11, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
    itemIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    itemPrice: { fontSize: 11, color: '#64748B', marginTop: 1 },
    qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
    qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    qtyText: { fontSize: 14, fontWeight: '700', color: '#0F172A', minWidth: 22, textAlign: 'center' },
    qtyReadonly: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    itemTotal: { fontSize: 13, fontWeight: '700', color: '#2563EB', minWidth: 72, textAlign: 'right' },
    removeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E3A8A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
    totalLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
    totalValue: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    submitBtn: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});