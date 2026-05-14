import BgWatermark from '@/components/Main/BgWatermark';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    KeyboardAvoidingView, Platform, ScrollView,
    StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomers } from '../../../components/Hooks/useCustomers';
import { showAlert } from '../../../components/Main/showAlert';
import { showSuccess } from '../../../components/Main/showSuccess';
import { db } from '../../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

const SERVICE_TYPES = [
    { key: 'MAINTENANCE', label: 'Bảo dưỡng', icon: 'construct-outline', color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'INSTALLATION', label: 'Lắp đặt', icon: 'build-outline', color: '#8B5CF6', bg: '#F5F3FF' },
    { key: 'SALT', label: 'Đổ muối', icon: 'water-outline', color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'DELIVERY', label: 'Giao hàng', icon: 'car-outline', color: '#10B981', bg: '#ECFDF5' },
    { key: 'CONSULTING', label: 'Tư vấn', icon: 'chatbubbles-outline', color: '#EC4899', bg: '#FDF2F8' },
];

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

export default function EditService() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { userDetail } = useContext(UserDetailContext);

    // Parse existing service from params
    const existingService = params.serviceParam ? JSON.parse(params.serviceParam) : {};
    const serviceId = existingService.id || params.serviceID;

    // ── Form state — pre-filled ───────────────────────────────
    const [serviceType, setServiceType] = useState(existingService.type || 'MAINTENANCE');
    const [customerName, setCustomerName] = useState(existingService.customer || '');
    const [customerPhone, setCustomerPhone] = useState(existingService.phone || '');
    const [address, setAddress] = useState(existingService.address || '');
    const [note, setNote] = useState(existingService.note || '');
    const [submitting, setSubmitting] = useState(false);

    // ── Order picker ──────────────────────────────────────────
    const [selectedOrder, setSelectedOrder] = useState(
        existingService.orderId ? { id: existingService.orderId, items: existingService.orderItems || [], customer: existingService.customer, _phone: existingService.phone, address: existingService.address } : null
    );
    const [showOrderPicker, setShowOrderPicker] = useState(false);
    const [orderList, setOrderList] = useState([]);
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');

    const { customers } = useCustomers();

    useEffect(() => {
        if (customers.length === 0) return;
        const fetchOrders = async () => {
            setOrderLoading(true);
            try {
                const phones = customers.map(c => c.phone).filter(Boolean);
                const allOrders = [];
                await Promise.all(phones.map(async (phone) => {
                    try {
                        const snap = await getDoc(doc(db, 'orders', phone));
                        if (!snap.exists()) return;
                        (snap.data().orders || []).forEach(o => allOrders.push({ ...o, _phone: phone }));
                    } catch (_) { }
                }));
                allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                setOrderList(allOrders);
            } catch (e) { console.error(e); }
            finally { setOrderLoading(false); }
        };
        fetchOrders();
    }, [customers]);

    const filteredOrders = orderSearch.trim() === ''
        ? orderList
        : orderList.filter(o =>
            (o.id || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
            (o.customer || '').toLowerCase().includes(orderSearch.toLowerCase())
        );

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setCustomerName(order.customer || '');
        setCustomerPhone(order._phone || '');
        setAddress(order.address || '');
        setShowOrderPicker(false);
        setOrderSearch('');
    };

    const handleSubmit = async () => {
        if (!customerName.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên khách hàng'); return; }
        if (!customerPhone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }

        setSubmitting(true);
        try {
            const updated = {
                type: serviceType,
                orderId: selectedOrder?.id || null,
                orderItems: selectedOrder?.items || [],
                customer: customerName.trim(),
                phone: customerPhone.trim(),
                address: address.trim(),
                note: note.trim(),
                updatedBy: userDetail?.email || '',
                updatedAt: new Date().toISOString(),
            };
            await updateDoc(doc(db, 'service', serviceId), updated);
            showSuccess('Đã cập nhật dịch vụ!', `Mã dịch vụ: ${serviceId}`,
                () => router.back());
        } catch (e) {
            showAlert('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedType = SERVICE_TYPES.find(t => t.key === serviceType);

    // ── Order Picker Dropdown ─────────────────────────────────
    const OrderPickerDropdown = () => (
        <View style={styles.pickerDropdown}>
            <View style={styles.pickerSearch}>
                <Ionicons name="search-outline" size={14} color="#94A3B8" />
                <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Tìm mã đơn hoặc tên khách..."
                    placeholderTextColor="#94A3B8"
                    value={orderSearch}
                    onChangeText={setOrderSearch}
                    autoFocus
                />
                {orderSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setOrderSearch('')}>
                        <Ionicons name="close-circle" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                {orderLoading ? (
                    <Text style={styles.pickerEmpty}>Đang tải đơn hàng...</Text>
                ) : filteredOrders.length === 0 ? (
                    <Text style={styles.pickerEmpty}>{orderSearch ? 'Không tìm thấy' : 'Chưa có đơn hàng nào'}</Text>
                ) : filteredOrders.map((order, i) => {
                    const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
                    return (
                        <TouchableOpacity
                            key={order.id || i}
                            style={[styles.pickerItem, selectedOrder?.id === order.id && styles.pickerItemActive]}
                            onPress={() => handleSelectOrder(order)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.pickerItemIcon}><Ionicons name="receipt-outline" size={14} color="#2563EB" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pickerItemId}>#{order.id}</Text>
                                <Text style={styles.pickerItemSub}>{order.customer} · {order.items?.length || 0} sản phẩm</Text>
                            </View>
                            <Text style={styles.pickerItemAmount}>{fmt(total)}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // WEB LAYOUT
    // ─────────────────────────────────────────────────────────
    if (isWeb) return (
        <View style={W.root}>
            <BgWatermark />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>
                <View style={W.pageHeader}>
                    <View>
                        <Text style={W.pageTitle}>Sửa dịch vụ</Text>
                        <Text style={W.pageSub}>Mã dịch vụ: {serviceId}</Text>
                    </View>
                    <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()}>
                        <Ionicons name="close" size={16} color="#64748B" />
                        <Text style={W.cancelBtnText}>Huỷ</Text>
                    </TouchableOpacity>
                </View>

                <View style={W.grid}>
                    {/* LEFT */}
                    <View style={W.col}>
                        {/* Service type */}
                        <View style={W.card}>
                            <View style={W.cardHeader}><Ionicons name="construct-outline" size={16} color="#2563EB" /><Text style={W.cardTitle}>Loại hình dịch vụ</Text></View>
                            <View style={W.typeGrid}>
                                {SERVICE_TYPES.map(type => {
                                    const active = serviceType === type.key;
                                    return (
                                        <TouchableOpacity key={type.key}
                                            style={[W.typeCard, { borderColor: active ? type.color : '#E2E8F0' }, active && { backgroundColor: type.bg }]}
                                            onPress={() => setServiceType(type.key)} activeOpacity={0.7}
                                        >
                                            <View style={[W.typeIcon, { backgroundColor: active ? type.color + '22' : '#F1F5F9' }]}>
                                                <Ionicons name={type.icon} size={18} color={active ? type.color : '#94A3B8'} />
                                            </View>
                                            <Text style={[W.typeLabel, active && { color: type.color, fontWeight: '700' }]}>{type.label}</Text>
                                            {active && <View style={[W.typeCheck, { backgroundColor: type.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Order picker */}
                        <View style={W.card}>
                            <View style={W.cardHeader}>
                                <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                                <Text style={W.cardTitle}>Đơn hàng liên quan</Text>
                                <Text style={W.cardOptional}>tuỳ chọn</Text>
                            </View>
                            <TouchableOpacity
                                style={[W.inputBox, showOrderPicker && W.inputBoxFocus]}
                                onPress={() => setShowOrderPicker(p => !p)}
                                activeOpacity={0.8}
                            >
                                {selectedOrder ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                        <Ionicons name="receipt-outline" size={15} color="#2563EB" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={W.selectedOrderId}>#{selectedOrder.id}</Text>
                                            <Text style={W.selectedOrderSub}>{selectedOrder.customer} · {selectedOrder.items?.length || 0} sản phẩm</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedOrder(null); setCustomerName(''); setCustomerPhone(''); }}>
                                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="search-outline" size={15} color="#94A3B8" />
                                        <Text style={W.inputPlaceholder}>Chọn đơn hàng liên quan...</Text>
                                        <Ionicons name={showOrderPicker ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                                    </>
                                )}
                            </TouchableOpacity>
                            {showOrderPicker && <OrderPickerDropdown />}
                            {selectedOrder?.items?.length > 0 && (
                                <View style={W.orderItemsBox}>
                                    <Text style={W.orderItemsTitle}>Sản phẩm trong đơn:</Text>
                                    {selectedOrder.items.map((item, i) => (
                                        <View key={i} style={W.orderItemRow}>
                                            <Ionicons name="water-outline" size={13} color="#64748B" />
                                            <Text style={W.orderItemName}>{item.name}</Text>
                                            <Text style={W.orderItemQty}>x{item.qty}</Text>
                                            <Text style={W.orderItemPrice}>{fmt(item.price)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* RIGHT */}
                    <View style={W.colRight}>
                        <View style={W.card}>
                            <View style={W.cardHeader}><Ionicons name="person-outline" size={16} color="#2563EB" /><Text style={W.cardTitle}>Thông tin khách hàng</Text></View>
                            <View style={W.row2}>
                                <View style={[W.inputGroup, { flex: 1 }]}>
                                    <Text style={W.label}>Tên khách hàng <Text style={W.required}>*</Text></Text>
                                    <View style={W.inputBox}><Ionicons name="person-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={customerName} onChangeText={setCustomerName} /></View>
                                </View>
                                <View style={[W.inputGroup, { flex: 1 }]}>
                                    <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                                    <View style={W.inputBox}><Ionicons name="call-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="090x xxx xxx" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} /></View>
                                </View>
                            </View>
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Địa chỉ</Text>
                                <View style={W.inputBox}><Ionicons name="location-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="Quận/Huyện, TP..." placeholderTextColor="#94A3B8" value={address} onChangeText={setAddress} /></View>
                            </View>
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Ghi chú</Text>
                                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 90 }]}><TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder="Yêu cầu cụ thể..." placeholderTextColor="#94A3B8" multiline value={note} onChangeText={setNote} /></View>
                            </View>
                        </View>

                        {/* Preview */}
                        <View style={W.card}>
                            <View style={W.cardHeader}><Ionicons name="eye-outline" size={16} color="#2563EB" /><Text style={W.cardTitle}>Xem trước</Text></View>
                            <View style={W.previewRow}>
                                <View style={[W.previewIcon, { backgroundColor: selectedType?.bg }]}>
                                    <Ionicons name={selectedType?.icon} size={20} color={selectedType?.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={W.previewId}>{serviceId}</Text>
                                    <Text style={[W.previewType, { color: selectedType?.color }]}>{selectedType?.label}</Text>
                                </View>
                            </View>
                            {(customerName || customerPhone) && (
                                <View style={W.previewCustomer}>
                                    <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                                    <Text style={W.previewCustomerText}>{customerName || '—'}{customerPhone ? ` · ${customerPhone}` : ''}</Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity style={[W.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                            <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                            <Text style={W.submitBtnText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // MOBILE LAYOUT
    // ─────────────────────────────────────────────────────────
    return (
        <View style={[M.container, { paddingTop: insets.top }]}>
            <BgWatermark />
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <View style={M.header}>
                <TouchableOpacity onPress={() => router.back()} style={M.backBtn}><Ionicons name="arrow-back" size={22} color="#0F172A" /></TouchableOpacity>
                <Text style={M.headerTitle}>Sửa dịch vụ</Text>
                <View style={M.headerAvatar}><Ionicons name="create-outline" size={16} color="#2563EB" /></View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={M.scroll}>

                    {/* Banner */}
                    <View style={M.banner}>
                        <View style={[M.bannerIcon, { backgroundColor: selectedType?.color + '22' }]}>
                            <Ionicons name={selectedType?.icon} size={40} color={selectedType?.color} />
                        </View>
                        <Text style={M.bannerText}>Sửa dịch vụ #{serviceId}</Text>
                    </View>

                    {/* Service type */}
                    <View style={M.card}>
                        <Text style={M.sectionTitle}>LOẠI HÌNH DỊCH VỤ</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={M.typeScroll}>
                            {SERVICE_TYPES.map(type => {
                                const active = serviceType === type.key;
                                return (
                                    <TouchableOpacity key={type.key}
                                        style={[M.typeTab, active && M.typeTabActive]}
                                        onPress={() => setServiceType(type.key)} activeOpacity={0.8}
                                    >
                                        <Text style={[M.typeTabText, active && M.typeTabTextActive]}>{type.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Order picker */}
                    <View style={M.card}>
                        <Text style={M.sectionTitle}>ĐƠN HÀNG LIÊN QUAN</Text>
                        <TouchableOpacity
                            style={[M.inputBox, showOrderPicker && { borderColor: '#2563EB' }]}
                            onPress={() => setShowOrderPicker(p => !p)}
                            activeOpacity={0.8}
                        >
                            {selectedOrder ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Ionicons name="receipt-outline" size={15} color="#2563EB" />
                                    <View style={{ flex: 1 }}><Text style={M.selectedOrderText}>#{selectedOrder.id} · {selectedOrder.customer}</Text></View>
                                    <TouchableOpacity onPress={() => { setSelectedOrder(null); setCustomerName(''); setCustomerPhone(''); }}>
                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                                    <Text style={M.inputPlaceholder}>Chọn đơn hàng...</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {showOrderPicker && <OrderPickerDropdown />}
                        {selectedOrder?.items?.length > 0 && (
                            <View style={M.orderItemsBox}>
                                {selectedOrder.items.map((item, i) => (
                                    <View key={i} style={M.orderItemRow}>
                                        <Ionicons name="water-outline" size={12} color="#64748B" />
                                        <Text style={M.orderItemName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={M.orderItemQty}>x{item.qty}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Customer info */}
                    <View style={M.card}>
                        <Text style={M.sectionTitle}>THÔNG TIN KHÁCH HÀNG</Text>
                        <Text style={M.fieldLabel}>TÊN KHÁCH HÀNG</Text>
                        <View style={M.inputBox}><Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} /><TextInput style={M.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={customerName} onChangeText={setCustomerName} /></View>
                        <Text style={M.fieldLabel}>SỐ ĐIỆN THOẠI</Text>
                        <View style={M.inputBox}><Ionicons name="call-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} /><TextInput style={M.input} placeholder="090x xxx xxx" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} /></View>
                        <Text style={M.fieldLabel}>ĐỊA CHỈ</Text>
                        <View style={M.inputBox}><Ionicons name="location-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} /><TextInput style={M.input} placeholder="Quận/Huyện, TP..." placeholderTextColor="#94A3B8" value={address} onChangeText={setAddress} /></View>
                        <Text style={M.fieldLabel}>GHI CHÚ</Text>
                        <View style={[M.inputBox, { alignItems: 'flex-start', minHeight: 100 }]}><TextInput style={[M.input, { textAlignVertical: 'top', paddingTop: 2 }]} placeholder="Yêu cầu cụ thể..." placeholderTextColor="#94A3B8" multiline value={note} onChangeText={setNote} /></View>
                    </View>

                    <View style={{ height: insets.bottom + 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={[M.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={[M.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                    <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={22} color="#fff" />
                    <Text style={M.submitBtnText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ── Shared picker styles ──────────────────────────────────────
const styles = StyleSheet.create({
    pickerDropdown: { backgroundColor: '#FFFFFF', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    pickerSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    pickerItemActive: { backgroundColor: '#EFF6FF' },
    pickerItemIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    pickerItemId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    pickerItemSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
    pickerItemAmount: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
    pickerEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});

// ── Web Styles ────────────────────────────────────────────────
const W = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 40 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
    pageSub: { fontSize: 14, color: '#64748B' },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    grid: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    col: { flex: 3 },
    colRight: { flex: 2, gap: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
    cardOptional: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: { flex: 1, minWidth: 100, flexDirection: 'column', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', position: 'relative', gap: 6 },
    typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    typeLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'center' },
    typeCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    row2: { flexDirection: 'row', gap: 12 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
    required: { color: '#EF4444' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    inputBoxFocus: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
    selectedOrderId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    selectedOrderSub: { fontSize: 11, color: '#64748B' },
    orderItemsBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 10, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    orderItemsTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 },
    orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    orderItemName: { flex: 1, fontSize: 12, color: '#0F172A' },
    orderItemQty: { fontSize: 12, color: '#64748B' },
    orderItemPrice: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    previewId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    previewType: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    previewCustomer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
    previewCustomerText: { fontSize: 12, color: '#64748B' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ── Mobile Styles ─────────────────────────────────────────────
const M = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 16 },
    banner: { backgroundColor: '#0F172A', margin: 16, borderRadius: 18, height: 140, alignItems: 'center', justifyContent: 'center', gap: 10 },
    bannerIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    bannerText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#2563EB', letterSpacing: 0.8, marginBottom: 14 },
    typeScroll: { marginBottom: 4 },
    typeTab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 25, marginRight: 8, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
    typeTabActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    typeTabText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
    typeTabTextActive: { color: '#2563EB' },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 8, marginTop: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
    input: { flex: 1, fontSize: 15, color: '#0F172A' },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
    selectedOrderText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    orderItemsBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 8, gap: 5 },
    orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    orderItemName: { flex: 1, fontSize: 12, color: '#374151' },
    orderItemQty: { fontSize: 12, color: '#64748B' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 17, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
});