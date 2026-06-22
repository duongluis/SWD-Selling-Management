// app/addService.jsx
import BgWatermark from '@/components/Main/BgWatermark';
import { useLayout } from '@/components/Main/TabScreenLayout';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { memo, useContext, useEffect, useState } from 'react';
import {
    KeyboardAvoidingView, Platform, ScrollView, StatusBar,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    SERVICE_TYPE_TO_CATEGORY,
    fetchStatusList,
} from '../../components/Hooks/getStatus';
import { useCustomers } from '../../components/Hooks/useCustomers';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { db } from '../../config/firebaseConfig';

// ── Memo components để tránh mất focus khi typing ───────────
const NotesInput = memo(({ value, onChange, label }) => (
    <View style={W.inputGroup}>
        <Text style={W.label}>{label}</Text>
        <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 90 }]}>
            <TextInput
                style={[W.input, { textAlignVertical: 'top' }]}
                placeholder="Yêu cầu cụ thể..."
                placeholderTextColor="#94A3B8"
                multiline
                value={value}
                onChangeText={onChange}
            />
        </View>
    </View>
));

const NotesInputMobile = memo(({ value, onChange }) => (
    <>
        <Text style={M.fieldLabel}>GHI CHÚ</Text>
        <View style={[M.inputBox, { alignItems: 'flex-start', minHeight: 100 }]}>
            <TextInput
                style={[M.input, { textAlignVertical: 'top', paddingTop: 2 }]}
                placeholder="Yêu cầu cụ thể..."
                placeholderTextColor="#94A3B8"
                multiline
                value={value}
                onChangeText={onChange}
            />
        </View>
    </>
));

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const getIconByName = (name = '') => {
    if (name.includes('Lắp đặt')) return 'build-outline';
    if (name.includes('Bảo dưỡng')) return 'construct-outline';
    if (name.includes('Giao hàng')) return 'car-outline';
    return 'flash-outline';
};

// Đặt NGOÀI AddService component
const OrderPickerDropdown = memo(({
    orderSearch, setOrderSearch, orderLoading,
    filteredOrders, selectedOrder, handleSelectOrder
}) => (
    <View style={S.pickerDropdown}>
        <View style={S.pickerSearch}>
            <Ionicons name="search-outline" size={14} color="#94A3B8" />
            <TextInput
                style={S.pickerSearchInput}
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
            {orderLoading
                ? <Text style={S.pickerEmpty}>Đang tải đơn hàng...</Text>
                : filteredOrders.length === 0
                    ? <Text style={S.pickerEmpty}>{orderSearch ? 'Không tìm thấy' : 'Chưa có đơn hàng nào'}</Text>
                    : filteredOrders.map((order, i) => {
                        const total = (order.items || []).reduce(
                            (s, p) => s + ((p.price || 0) * (p.qty || 1)), 0
                        );
                        return (
                            <TouchableOpacity key={order.id || i}
                                style={[S.pickerItem, selectedOrder?.id === order.id && S.pickerItemActive]}
                                onPress={() => handleSelectOrder(order)} activeOpacity={0.7}
                            >
                                <View style={S.pickerItemIcon}>
                                    <Ionicons name="receipt-outline" size={14} color="#2563EB" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.pickerItemId}>#{order.id}</Text>
                                    <Text style={S.pickerItemSub}>{order.customer} · {order.items?.length || 0} sản phẩm</Text>
                                </View>
                                <Text style={S.pickerItemAmount}>{fmt(total)}</Text>
                            </TouchableOpacity>
                        );
                    })
            }
        </ScrollView>
    </View>
));

// Đặt NGOÀI AddService
const MachinePickerSection = memo(({
    ws, showMachineSection, selectedOrder,
    selectedMachine, setSelectedMachine, currentTypeCfg
}) => {
    if (!showMachineSection) return null;
    const machines = selectedOrder?.items || [];
    return (
        <View style={ws ? W.machineSection : M.machineSection}>
            <View style={ws ? W.machineHeader : M.machineHeader}>
                <Ionicons name="settings-outline" size={14} color={currentTypeCfg?.color || '#2563EB'} />
                <Text style={[ws ? W.machineHeaderText : M.machineHeaderText, { color: currentTypeCfg?.color }]}>
                    Chọn máy cần {currentTypeCfg?.label?.toLowerCase()} <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
            </View>
            <View style={ws ? W.machineGrid : M.machineGrid}>
                {machines.map((item, i) => {
                    const active = selectedMachine?.id === (item.id || String(i));
                    return (
                        <TouchableOpacity
                            key={item.id || i}
                            style={[
                                ws ? W.machineCard : M.machineCard,
                                active && { borderColor: currentTypeCfg?.color, backgroundColor: currentTypeCfg?.bg },
                            ]}
                            onPress={() => setSelectedMachine(active ? null : { ...item, id: item.id || String(i) })}
                            activeOpacity={0.8}
                        >
                            <View style={[ws ? W.machineIcon : M.machineIcon, { backgroundColor: active ? currentTypeCfg?.color + '22' : '#F1F5F9' }]}>
                                <Ionicons name="water-outline" size={16} color={active ? currentTypeCfg?.color : '#94A3B8'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[ws ? W.machineName : M.machineName, active && { color: currentTypeCfg?.color }]} numberOfLines={2}>
                                    {item.name}
                                </Text>
                                <Text style={ws ? W.machineMeta : M.machineMeta}>
                                    x{item.qty} · {fmt(item.price)}
                                </Text>
                            </View>
                            {active && (
                                <View style={[ws ? W.machineCheck : M.machineCheck, { backgroundColor: currentTypeCfg?.color }]}>
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
});

// ── Single export default ────────────────────────────────────
export default function AddService() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);

    // ✅ useLayout gọi BÊN TRONG component
    const { isDesktop } = useLayout();
    const isAdmin = userDetail?.role === 'admin';

    // ── State ────────────────────────────────────────────────
    const [serviceTypes, setServiceTypes] = useState([]);
    const [serviceType, setServiceType] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [address, setAddress] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderPicker, setShowOrderPicker] = useState(false);
    const [orderList, setOrderList] = useState([]);
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');

    const [selectedMachine, setSelectedMachine] = useState(null);

    const { customers } = useCustomers();
    const currentTypeCfg = serviceTypes.find(t => t.key === serviceType);
    const showMachineSection = currentTypeCfg?.hasMachine && selectedOrder?.items?.length > 0;
    const [serviceId] = useState('SV-' + Date.now().toString().slice(-6));
    // Sau dòng const [updating, setUpdating] = useState(false);
    const [saveAsCustomer, setSaveAsCustomer] = useState(false);
    const [savingCustomer, setSavingCustomer] = useState(false);
    const [customerSaved, setCustomerSaved] = useState(false);
    const [wantSaveCustomer, setWantSaveCustomer] = useState(false);

    const normalizePhone = (phone) => (phone || '').replace(/\s+/g, '').trim();


    // ── Effects ──────────────────────────────────────────────
    useEffect(() => {
        const fetchServiceTypes = async () => {
            try {
                const snap = await getDocs(collection(db, 'servicePrice'));
                const types = snap.docs.map(d => ({ ...d.data(), key: d.id }));
                setServiceTypes(types);
                if (types.length > 0) setServiceType(types[0].key);
            } catch (err) { console.warn('Lỗi tải dịch vụ:', err); }
        };
        fetchServiceTypes();
    }, []);

    useEffect(() => {
        if (!currentTypeCfg?.hasMachine) setSelectedMachine(null);
    }, [serviceType]);

    useEffect(() => {
        if (customers.length === 0) return;

        const fetchOrders = async () => {
            setOrderLoading(true);
            try {
                let allOrders = [];

                if (isAdmin) {
                    // Admin: lấy toàn bộ đơn hàng
                    const ordersSnap = await getDocs(collection(db, 'orders'));
                    ordersSnap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
                } else {
                    // 1. Email bản thân + cấp dưới (từ customers)
                    const subordinateEmails = customers.map(c => c.email).filter(Boolean);

                    // 2. Leo ngược cây advisor lấy email cấp trên
                    const superiorEmails = [];
                    let currentEmail = userDetail?.advisor;
                    while (currentEmail) {
                        const userSnap = await getDocs(
                            query(collection(db, 'users'), where('email', '==', currentEmail))
                        );
                        if (userSnap.empty) break;
                        superiorEmails.push(currentEmail);
                        const userData = userSnap.docs[0].data();
                        currentEmail = userData.advisor || null;
                    }

                    // 3. Gộp + loại trùng
                    const uniqueEmails = [...new Set([
                        userDetail?.email,
                        ...subordinateEmails,
                        // ...superiorEmails, // bỏ comment nếu muốn thêm cấp trên
                    ].filter(Boolean))];

                    if (uniqueEmails.length === 0) {
                        setOrderList([]);
                        return;
                    }

                    // 4. Query theo createdBy, chunk 30
                    const CHUNK_SIZE = 30;
                    for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
                        const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE);
                        const ordersSnap = await getDocs(
                            query(collection(db, 'orders'), where('createdBy', 'in', chunk))
                        );
                        ordersSnap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
                    }
                }

                allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                setOrderList(allOrders);

            } catch (e) {
                console.error('Lỗi fetch orders:', e);
            } finally {
                setOrderLoading(false);
            }
        };

        fetchOrders();
    }, [customers, userDetail]);

    // ── Handlers ─────────────────────────────────────────────
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
        setSelectedMachine(null);
        setShowOrderPicker(false);
        setOrderSearch('');
    };

    const handleSubmit = async () => {
        if (currentTypeCfg?.hasMachine && !selectedOrder) {
            showAlert('Thông báo', 'Loại dịch vụ này yêu cầu chọn đơn hàng liên quan');
            return;
        }
        if (!customerName.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên khách hàng'); return; }
        if (!customerPhone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }
        if (showMachineSection && !selectedMachine) {
            showAlert('Thông báo', `Vui lòng chọn máy cần ${currentTypeCfg.label?.toLowerCase()}`);
            return;
        }
        setSubmitting(true);
        try {
            // ── Lưu khách hàng nếu được tick ─────────────────────
            if (wantSaveCustomer) {
                const phone = customerPhone.replace(/\s+/g, '').trim();
                const dup = await getDocs(
                    query(collection(db, 'customers'), where('phone', '==', phone))
                );
                if (dup.empty) {
                    let rootAdvisor = userDetail.email, level = 1, cur = userDetail;
                    while (cur?.advisor) {
                        level++; rootAdvisor = cur.advisor;
                        try {
                            const snap = await getDoc(doc(db, 'users', cur.advisor));
                            cur = snap.exists() ? snap.data() : null;
                        } catch { break; }
                    }
                    await setDoc(doc(db, 'customers', phone), {
                        id: Date.now().toString(),
                        createdAt: new Date().toISOString(),
                        name: customerName.trim(),
                        phone,
                        email: '',
                        address: address.trim(),
                        note: note.trim(),
                        rootAdvisor, level,
                        createdBy: userDetail?.email || '',
                    }, { merge: true });
                }
                // Nếu đã tồn tại thì bỏ qua, vẫn tiếp tục tạo dịch vụ
            }

            // ── Tạo dịch vụ (giữ nguyên logic cũ) ───────────────
            const category = SERVICE_TYPE_TO_CATEGORY[serviceType] || 'other';
            const statusList = await fetchStatusList(category);
            const initialStatus = statusList[0]?.name || 'Chờ xử lý';
            const newService = {
                id: serviceId,
                type: serviceType,
                orderId: selectedOrder?.id || null,
                orderItems: selectedOrder?.items || [],
                machineItem: selectedMachine || null,
                customer: customerName.trim(),
                phone: customerPhone.replace(/\s+/g, '').trim(),
                address: address.trim(),
                note: note.trim(),
                status: initialStatus,
                createdBy: userDetail?.email || '',
                createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'service', serviceId), newService);
            showSuccess('Dịch vụ đã được tạo!', `Mã dịch vụ: ${serviceId}`, () => router.replace('/(tabs)/service'));
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSubmitting(false); }
    };

    // ── Render ───────────────────────────────────────────────
    // ✅ isDesktop điều kiện chọn layout

    return isDesktop ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>
            <View style={W.pageHeader}>
                <View>
                    <Text style={W.pageTitle}>Tạo dịch vụ mới</Text>
                    <Text style={W.pageSub}>Điền thông tin để tạo yêu cầu dịch vụ mới</Text>
                </View>
                <TouchableOpacity style={W.cancelBtn} onPress={() => router.replace('/(tabs)/service')}>
                    <Ionicons name="close" size={16} color="#64748B" />
                    <Text style={W.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
            </View>

            <View style={W.grid}>
                {/* LEFT */}
                <View style={W.col}>
                    {/* Service type */}
                    <View style={W.card}>
                        <View style={W.cardHeader}>
                            <Ionicons name="construct-outline" size={16} color="#2563EB" />
                            <Text style={W.cardTitle}>Loại hình dịch vụ</Text>
                        </View>
                        <View style={W.typeGrid}>
                            {serviceTypes.map(type => {
                                const active = serviceType === type.key;
                                return (
                                    <TouchableOpacity key={type.key}
                                        style={[W.typeCard, { borderColor: active ? type.color : '#E2E8F0' }, active && { backgroundColor: type.bg }]}
                                        onPress={() => setServiceType(type.key)} activeOpacity={0.7}
                                    >
                                        <View style={[W.typeIcon, { backgroundColor: active ? type.color + '22' : '#F1F5F9' }]}>
                                            <Ionicons name={getIconByName(type.name)} size={18} color={active ? type.color : '#94A3B8'} />
                                        </View>
                                        <Text style={[W.typeLabel, active && { color: type.color, fontWeight: '700' }]}>{type.name}</Text>
                                        {type.hasMachine && <View style={W.machineBadge}><Ionicons name="settings-outline" size={9} color="#94A3B8" /></View>}
                                        {active && <View style={[W.typeCheck, { backgroundColor: type.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Order picker */}
                    <View style={[W.card, { zIndex: showOrderPicker ? 100 : 1 }, currentTypeCfg?.hasMachine && !selectedOrder && { borderColor: '#FCA5A5', borderWidth: 1.5 }]} >
                        <View style={W.cardHeader}>
                            <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                            <Text style={W.cardTitle}>Đơn hàng liên quan</Text>
                            <Text style={currentTypeCfg?.hasMachine ? W.cardRequired : W.cardOptional}>
                                {currentTypeCfg?.hasMachine ? 'bắt buộc *' : 'tuỳ chọn'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[W.inputBox, showOrderPicker && W.inputBoxFocus]}
                            onPress={() => setShowOrderPicker(!showOrderPicker)} activeOpacity={0.8}
                        >
                            {selectedOrder ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <Ionicons name="receipt-outline" size={15} color="#2563EB" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={W.selectedOrderId}>#{selectedOrder.id}</Text>
                                        <Text style={W.selectedOrderSub}>{selectedOrder.customer} · {selectedOrder.items?.length || 0} sản phẩm</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setSelectedOrder(null); setCustomerName(''); setCustomerPhone(''); setSelectedMachine(null); }}>
                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Ionicons name="search-outline" size={15} color="#94A3B8" />
                                    <Text style={W.inputPlaceholder}>Chọn đơn hàng liên quan...</Text>
                                    {currentTypeCfg?.hasMachine && (
                                        <Text style={{ fontSize: 11, color: '#EF4444', marginBottom: 6 }}>
                                            * Bắt buộc với loại dịch vụ này
                                        </Text>
                                    )}
                                    <Ionicons name={showOrderPicker ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                                </>
                            )}
                        </TouchableOpacity>
                        {showOrderPicker && (
                            <OrderPickerDropdown
                                orderSearch={orderSearch}
                                setOrderSearch={setOrderSearch}
                                orderLoading={orderLoading}
                                filteredOrders={filteredOrders}
                                selectedOrder={selectedOrder}
                                handleSelectOrder={handleSelectOrder}
                            />
                        )}
                        <MachinePickerSection
                            ws={true} // hoặc false cho mobile
                            showMachineSection={showMachineSection}
                            selectedOrder={selectedOrder}
                            selectedMachine={selectedMachine}
                            setSelectedMachine={setSelectedMachine}
                            currentTypeCfg={currentTypeCfg}
                        />
                        {selectedOrder?.items?.length > 0 && !showMachineSection && (
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
                        <View style={W.cardHeader}>
                            <Ionicons name="person-outline" size={16} color="#2563EB" />
                            <Text style={W.cardTitle}>Thông tin khách hàng</Text>
                        </View>
                        <View style={W.row2}>
                            <View style={[W.inputGroup, { flex: 1 }]}>
                                <Text style={W.label}>Tên khách hàng <Text style={W.required}>*</Text></Text>
                                <View style={W.inputBox}>
                                    <Ionicons name="person-outline" size={15} color="#94A3B8" />
                                    <TextInput style={W.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={customerName} onChangeText={setCustomerName} />
                                </View>
                            </View>
                            <View style={[W.inputGroup, { flex: 1 }]}>
                                <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                                <View style={W.inputBox}>
                                    <Ionicons name="call-outline" size={15} color="#94A3B8" />
                                    <TextInput style={W.input} placeholder="090x xxx xxx" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
                                </View>
                            </View>
                        </View>
                        <View style={W.inputGroup}>
                            <Text style={W.label}>Địa chỉ</Text>
                            <View style={W.inputBox}>
                                <Ionicons name="location-outline" size={15} color="#94A3B8" />
                                <TextInput style={W.input} placeholder="Quận/Huyện, TP..." placeholderTextColor="#94A3B8" value={address} onChangeText={setAddress} />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[W.inputGroup, W.toggleRow]}
                            onPress={() => setWantSaveCustomer(v => !v)}
                            activeOpacity={0.7}
                        >
                            <View style={[W.toggleBox, wantSaveCustomer && W.toggleBoxOn]}>
                                {wantSaveCustomer && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={W.toggleLabel}>Lưu làm khách hàng</Text>
                                {/* <Text style={W.toggleSub}>Tự động thêm vào danh sách khách hàng khi tạo dịch vụ</Text> */}
                            </View>
                        </TouchableOpacity>

                        <NotesInput value={note} onChange={setNote} label="Ghi chú" />


                    </View>

                    {/* Preview */}
                    <View style={W.card}>
                        <View style={W.cardHeader}>
                            <Ionicons name="eye-outline" size={16} color="#2563EB" />
                            <Text style={W.cardTitle}>Xem trước</Text>
                        </View>
                        <View style={W.previewRow}>
                            <View style={[W.previewIcon, { backgroundColor: (currentTypeCfg?.color || '#2563EB') + '22' }]}>
                                <Ionicons name={getIconByName(currentTypeCfg?.name || '')} size={20} color={currentTypeCfg?.color || '#2563EB'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={W.previewId}>{serviceId}</Text>
                                <Text style={[W.previewType, { color: currentTypeCfg?.color }]}>{currentTypeCfg?.name}</Text>
                            </View>
                            <View style={[W.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                                <View style={[W.statusDot, { backgroundColor: '#F59E0B' }]} />
                                <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600' }}>Chờ xử lý</Text>
                            </View>
                        </View>
                        {selectedMachine && (
                            <View style={W.previewMachine}>
                                <Ionicons name="settings-outline" size={14} color={currentTypeCfg?.color} />
                                <Text style={[W.previewMachineText, { color: currentTypeCfg?.color }]} numberOfLines={1}>Máy: {selectedMachine.name}</Text>
                            </View>
                        )}
                        {selectedOrder && (
                            <View style={W.previewCustomer}>
                                <Ionicons name="receipt-outline" size={14} color="#2563EB" />
                                <Text style={[W.previewCustomerText, { color: '#2563EB' }]}>Đơn #{selectedOrder.id}</Text>
                            </View>
                        )}
                        {(customerName || customerPhone) && (
                            <View style={W.previewCustomer}>
                                <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                                <Text style={W.previewCustomerText}>{customerName || '—'}{customerPhone ? ` · ${customerPhone}` : ''}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={[W.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                        <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                        <Text style={W.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo dịch vụ'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView >
    )


        // ── MOBILE LAYOUT ────────────────────────────────────────
        : (
            <View style={[M.container, { paddingTop: insets.top }]}>
                <BgWatermark />
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <View style={M.header}>
                    <TouchableOpacity onPress={() => router.replace('(tabs)/service')} style={M.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={M.headerTitle}>Thêm dịch vụ</Text>
                    <View style={M.headerAvatar}>
                        <Ionicons name="person" size={16} color="#64748B" />
                    </View>
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={M.scroll}>
                        <View style={M.banner}>
                            <View style={[M.bannerIcon, { backgroundColor: (currentTypeCfg?.color || '#2563EB') + '22' }]}>
                                <Ionicons name={getIconByName(currentTypeCfg?.name || '')} size={40} color={currentTypeCfg?.color || '#2563EB'} />
                            </View>
                            <Text style={M.bannerText}>Chi tiết thông tin dịch vụ mới</Text>
                        </View>

                        {/* Loại dịch vụ */}
                        <View style={M.card}>
                            <Text style={M.sectionTitle}>LOẠI HÌNH DỊCH VỤ</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={M.typeScroll}>
                                {serviceTypes.map(type => {
                                    const active = serviceType === type.key;
                                    return (
                                        <TouchableOpacity key={type.key}
                                            style={[M.typeTab, active && M.typeTabActive, active && { borderColor: type.color }]}
                                            onPress={() => setServiceType(type.key)} activeOpacity={0.8}
                                        >
                                            <Text style={[M.typeTabText, active && { color: type.color, fontWeight: '700' }]}>{type.name}</Text>
                                            {type.hasMachine && <Ionicons name="settings-outline" size={10} color={active ? type.color : '#94A3B8'} />}
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
                                onPress={() => setShowOrderPicker(!showOrderPicker)} activeOpacity={0.8}
                            >
                                {selectedOrder ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <Ionicons name="receipt-outline" size={15} color="#2563EB" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={M.selectedOrderText}>#{selectedOrder.id} · {selectedOrder.customer}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedOrder(null); setCustomerName(''); setCustomerPhone(''); setSelectedMachine(null); }}>
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
                            {showOrderPicker && (
                                <OrderPickerDropdown
                                    orderSearch={orderSearch}
                                    setOrderSearch={setOrderSearch}
                                    orderLoading={orderLoading}
                                    filteredOrders={filteredOrders}
                                    selectedOrder={selectedOrder}
                                    handleSelectOrder={handleSelectOrder}
                                />
                            )}
                            <MachinePickerSection
                                ws={false} // hoặc false cho mobile
                                showMachineSection={showMachineSection}
                                selectedOrder={selectedOrder}
                                selectedMachine={selectedMachine}
                                setSelectedMachine={setSelectedMachine}
                                currentTypeCfg={currentTypeCfg}
                            />
                            {selectedOrder?.items?.length > 0 && !showMachineSection && (
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

                        {/* Customer */}
                        <View style={M.card}>
                            <Text style={M.sectionTitle}>THÔNG TIN KHÁCH HÀNG</Text>
                            <Text style={M.fieldLabel}>TÊN KHÁCH HÀNG <Text style={{ color: '#EF4444' }}>*</Text></Text>
                            <View style={M.inputBox}>
                                <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                                <TextInput style={M.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={customerName} onChangeText={setCustomerName} />
                            </View>
                            <Text style={M.fieldLabel}>SỐ ĐIỆN THOẠI <Text style={{ color: '#EF4444' }}>*</Text></Text>
                            <View style={M.inputBox}>
                                <Ionicons name="call-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                                <TextInput style={M.input} placeholder="090x xxx xxx" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
                            </View>
                            <Text style={M.fieldLabel}>ĐỊA CHỈ</Text>
                            <View style={M.inputBox}>
                                <Ionicons name="location-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                                <TextInput style={M.input} placeholder="Quận/Huyện, TP..." placeholderTextColor="#94A3B8" value={address} onChangeText={setAddress} />
                            </View>
                            <NotesInputMobile value={note} onChange={setNote} />

                            <TouchableOpacity
                                style={M.toggleRow}
                                onPress={() => setWantSaveCustomer(v => !v)}
                                activeOpacity={0.7}
                            >
                                <View style={[M.toggleBox, wantSaveCustomer && M.toggleBoxOn]}>
                                    {wantSaveCustomer && <Ionicons name="checkmark" size={11} color="#fff" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={M.toggleLabel}>Lưu làm khách hàng</Text>
                                    <Text style={M.toggleSub}>Tự động thêm vào danh sách khi tạo dịch vụ</Text>
                                </View>
                            </TouchableOpacity>

                        </View>



                        <View style={{ height: insets.bottom + 100 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                <View style={[M.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                    <TouchableOpacity style={[M.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                        <Ionicons name={submitting ? 'hourglass-outline' : 'add-circle-outline'} size={22} color="#fff" />
                        <Text style={M.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo dịch vụ'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
}

// ── Styles ───────────────────────────────────────────────────
const S = StyleSheet.create({
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

const W = StyleSheet.create({
    scroll: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 40 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 4 },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    cancelBtnText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
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
    machineBadge: { position: 'absolute', bottom: 6, right: 6 },
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
    machineSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    machineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    machineHeaderText: { fontSize: 13, fontWeight: '700' },
    machineGrid: { gap: 8 },
    machineCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    machineIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    machineName: { fontSize: 13, fontWeight: '600', color: '#374151' },
    machineMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    machineCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    previewId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    previewType: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    previewMachine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
    previewMachineText: { fontSize: 12, fontWeight: '600' },
    previewCustomer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
    previewCustomerText: { fontSize: 12, color: '#64748B' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', marginBottom: 14 },
    toggleBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    toggleBoxOn: { backgroundColor: '#059669', borderColor: '#059669' },
    toggleLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    toggleSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});

const M = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    scroll: { paddingBottom: 16 },
    banner: { backgroundColor: '#0F172A', margin: 16, borderRadius: 18, height: 140, alignItems: 'center', justifyContent: 'center', gap: 10 },
    bannerIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    bannerText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#2563EB', letterSpacing: 0.8, marginBottom: 14 },
    typeScroll: { marginBottom: 4 },
    typeTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 25, marginRight: 8, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
    typeTabActive: { backgroundColor: '#EFF6FF' },
    typeTabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 8, marginTop: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
    input: { flex: 1, fontSize: 15, color: '#0F172A' },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
    selectedOrderText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    orderItemsBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 8, gap: 5 },
    orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    orderItemName: { flex: 1, fontSize: 12, color: '#374151' },
    orderItemQty: { fontSize: 12, color: '#64748B' },
    machineSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    machineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    machineHeaderText: { fontSize: 13, fontWeight: '700' },
    machineGrid: { gap: 8 },
    machineCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    machineIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    machineName: { fontSize: 13, fontWeight: '600', color: '#374151' },
    machineMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    machineCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 17, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', marginBottom: 8, marginTop: 4 },
    toggleBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    toggleBoxOn: { backgroundColor: '#059669', borderColor: '#059669' },
    toggleLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    toggleSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
});