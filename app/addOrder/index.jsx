import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// ── Date helpers ─────────────────────────────────────────────
const toDateStr = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const toDisplayStr = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

function DateField({ orderDate, setOrderDate, selectedDate, setSelectedDate, showDatePicker, setShowDatePicker }) {
  const onChange = (_, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) { setSelectedDate(date); setOrderDate(toDateStr(date)); }
  };
  if (isWeb) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
      <input type="date" value={orderDate || ''} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', fontWeight: '500', cursor: 'pointer', width: '100%' }}
        onChange={e => { if (!e.target.value) return; setOrderDate(e.target.value); const [y, m, d] = e.target.value.split('-').map(Number); setSelectedDate(new Date(y, m - 1, d, 12)); }} />
      <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
    </View>
  );
  return (
    <>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' }} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Text style={{ flex: 1, fontSize: 14, color: orderDate ? '#1A1A2E' : '#B0B0C8' }}>{orderDate ? toDisplayStr(orderDate) : 'Chọn ngày giao hàng...'}</Text>
        <Ionicons name="calendar-outline" size={18} color="#B0B0C8" />
      </TouchableOpacity>
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowDatePicker(false)} />
          <View style={{ backgroundColor: '#fff', padding: 16 }}>
            <DateTimePicker value={selectedDate} mode="date" display="spinner" onChange={onChange} />
            <Pressable onPress={() => setShowDatePicker(false)} style={{ alignItems: 'center', padding: 12 }}>
              <Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text>
            </Pressable>
          </View>
        </Modal>
      )}
      {showDatePicker && Platform.OS === 'android' && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onChange} />}
    </>
  );
}

// ── Role helpers ─────────────────────────────────────────────
const getRole = (u) => {
  const r = (u?.role || u?.member || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
  if (['nhà phân phối', 'phantan', 'distributor'].includes(r)) return 'phantan';
  if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
  return 'other';
};
const getPriceField = (role) => ({ daily: 'price_a', phantan: 'price_p', ctv: 'price_c' }[role] || 'price');
const ROLE_LABEL = { admin: 'Giá niêm yết', daily: 'Giá đại lý', phantan: 'Giá NP', ctv: 'Giá CTV', other: 'Giá niêm yết' };
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const SERVICE_TYPES = [
  { key: 'INSTALLATION', label: 'Lắp đặt', icon: 'build-outline', color: '#8B5CF6' },
  { key: 'MAINTENANCE', label: 'Bảo dưỡng', icon: 'construct-outline', color: '#F59E0B' },
  { key: 'DELIVERY', label: 'Giao hàng', icon: 'car-outline', color: '#10B981' },
  { key: 'CONSULTING', label: 'Tư vấn', icon: 'chatbubbles-outline', color: '#EC4899' },
];

// ── Product Dropdown ─────────────────────────────────────────
function ProductDropdown({ catalog, onSelect }) {
  const [search, setSearch] = useState('');
  const filtered = catalog.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <View style={PD.wrap}>
      <View style={PD.searchRow}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput style={PD.searchInput} placeholder="Tìm sản phẩm..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} autoFocus />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={14} color="#94A3B8" /></TouchableOpacity>}
      </View>
      <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? <Text style={PD.empty}>Không tìm thấy</Text>
          : filtered.map(item => (
            <TouchableOpacity key={String(item.id || item.docId)} style={PD.item} onPress={() => onSelect(item)} activeOpacity={0.7}>
              <View style={PD.icon}><Ionicons name="water-outline" size={13} color="#2563EB" /></View>
              <Text style={PD.name} numberOfLines={1}>{item.name}</Text>
              <Text style={PD.cap}>{item.capacity || ''}</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
const PD = StyleSheet.create({
  wrap: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6, overflow: 'hidden', zIndex: 99 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  icon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cap: { fontSize: 11, color: '#94A3B8' },
  empty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});

// ── Main ─────────────────────────────────────────────────────
export default function AddOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const priceField = getPriceField(role);

  // ── Customers ─────────────────────────────────────────────
  const [customerList, setCustomerList] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!userDetail?.email) return;
    const myEmail = userDetail.email;
    const all = [];
    try {
      if (role === 'admin') {
        (await getDocs(collection(db, 'customers'))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
      } else if (role === 'ctv') {
        (await getDocs(query(collection(db, 'customers'), where('createdBy', '==', myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
      } else if (role === 'daily' || role === 'phantan') {
        (await getDocs(query(collection(db, 'customers'), where('createdBy', '==', myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        const subs = (await getDocs(query(collection(db, 'users'), where('advisor', '==', myEmail)))).docs.map(d => d.data().email).filter(Boolean);
        for (let i = 0; i < subs.length; i += 30) {
          (await getDocs(query(collection(db, 'customers'), where('createdBy', 'in', subs.slice(i, i + 30))))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        }
      }
      const map = new Map(); all.forEach(c => map.set(c.docId, c));
      setCustomerList([...map.values()]);
    } catch (e) { console.error(e); } finally { setCustomerLoading(false); }
  }, [userDetail?.email, role]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ── Catalog ───────────────────────────────────────────────
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    getDocs(collection(db, 'productPrice')).then(snap => setCatalog(snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort((a, b) => (a.id || 0) - (b.id || 0)))).catch(console.error);
  }, []);

  // ── Form state ────────────────────────────────────────────
  const [orderId] = useState('ORD-' + Date.now().toString().slice(-6));
  const [orderDate, setOrderDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', qty: '1', price: '', productId: '' });

  // ── Service state ─────────────────────────────────────────
  const [includeService, setIncludeService] = useState(false);
  const [serviceType, setServiceType] = useState('INSTALLATION');
  const [serviceNote, setServiceNote] = useState('');

  const filteredCustomers = customerSearch.trim() === '' ? customerList
    : customerList.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch));

  const handleSelectProduct = (p) => {
    setNewProduct({ name: p.name, qty: '1', price: String(p[priceField] || p.price || 0), productId: String(p.id || p.docId) });
    setShowProductDrop(false);
  };

  const addProduct = () => {
    if (!newProduct.name) { showAlert('Thông báo', 'Vui lòng chọn sản phẩm'); return; }
    setProducts(prev => [...prev, { id: Date.now().toString(), name: newProduct.name, qty: parseInt(newProduct.qty) || 1, price: parseInt(newProduct.price) || 0 }]);
    setNewProduct({ name: '', qty: '1', price: '', productId: '' });
    setShowAddProduct(false); setShowProductDrop(false);
  };

  const removeProduct = (id) => setProducts(prev => prev.filter(p => p.id !== id));
  const totalAmount = products.reduce((s, p) => s + p.price * p.qty, 0);

  const handleSubmit = async () => {
    if (!selectedCustomer) { showAlert('Thông báo', 'Vui lòng chọn khách hàng'); return; }
    if (products.length === 0) { showAlert('Thông báo', 'Vui lòng thêm ít nhất 1 sản phẩm'); return; }
    setSubmitting(true);
    try {
      // Lưu đơn hàng
      const newOrder = { id: orderId, customer: selectedCustomer.name, items: products, createdAt: orderDate, address: deliveryAddress, note: notes, status: 'PENDING' };
      await setDoc(doc(db, 'orders', selectedCustomer.phone), { orders: arrayUnion(newOrder) }, { merge: true });

      // Lưu dịch vụ kèm (nếu bật)
      if (includeService) {
        const svcId = 'SV-' + Date.now().toString().slice(-6);
        await setDoc(doc(db, 'services', svcId), {
          id: svcId, type: serviceType,
          orderId, orderItems: products,
          customer: selectedCustomer.name, phone: selectedCustomer.phone,
          address: deliveryAddress, note: serviceNote,
          status: 'PENDING', createdBy: userDetail?.email || '',
          createdAt: new Date().toISOString(),
        });
      }

      showSuccess(
        'Đơn hàng đã được tạo!',
        `Mã đơn: ${orderId}${includeService ? '\nDịch vụ đã được tạo kèm.' : ''}`,
        () => router.replace('/(tabs)/order')
      );
    } catch (e) { showAlert('Lỗi', e.message); }
    finally { setSubmitting(false); }
  };

  // ── Customer Picker Dropdown ──────────────────────────────
  const CustomerPickerDropdown = ({ ws }) => (
    <View style={ws ? W.dropdown : styles.dropdown}>
      <View style={ws ? W.dropdownSearch : styles.dropdownSearch}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput style={ws ? W.dropdownSearchInput : styles.dropdownSearchInput} placeholder="Tìm tên hoặc SĐT..." placeholderTextColor="#94A3B8" value={customerSearch} onChangeText={setCustomerSearch} />
        {customerSearch.length > 0 && <TouchableOpacity onPress={() => setCustomerSearch('')}><Ionicons name="close-circle" size={14} color="#94A3B8" /></TouchableOpacity>}
      </View>
      {customerLoading
        ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>Đang tải...</Text>
        : filteredCustomers.length === 0
          ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>{customerSearch ? 'Không tìm thấy' : 'Chưa có khách hàng'}</Text>
          : <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {filteredCustomers.map((c, i) => (
              <TouchableOpacity key={c.docId || i}
                style={[ws ? W.dropdownItem : styles.dropdownItem, selectedCustomer?.docId === c.docId && (ws ? W.dropdownItemActive : styles.dropdownItemActive)]}
                onPress={() => { setSelectedCustomer(c); setDeliveryAddress(c.address || ''); setShowCustomerPicker(false); setCustomerSearch(''); }}
              >
                {ws && <View style={W.dropdownAvatar}><Text style={W.dropdownAvatarText}>{(c.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={[ws ? W.dropdownItemText : styles.dropdownItemText, selectedCustomer?.docId === c.docId && (ws ? W.dropdownItemTextActive : styles.dropdownItemTextActive)]}>{c.name}</Text>
                  <Text style={ws ? W.dropdownItemSub : styles.dropdownItemSub}>{c.phone}</Text>
                </View>
                {selectedCustomer?.docId === c.docId && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
      }
    </View>
  );

  // ── Add Product Form ──────────────────────────────────────
  const AddProductForm = ({ ws }) => (
    <View style={ws ? W.addForm : styles.addProductForm}>
      <View>
        <TouchableOpacity style={ws ? W.addInput : styles.addProductInput} onPress={() => setShowProductDrop(!showProductDrop)} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cube-outline" size={14} color={newProduct.name ? '#0F172A' : '#94A3B8'} />
            <Text style={{ fontSize: 14, color: newProduct.name ? '#0F172A' : '#94A3B8', flex: 1 }} numberOfLines={1}>{newProduct.name || 'Bấm để chọn sản phẩm...'}</Text>
            <Ionicons name={showProductDrop ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
          </View>
        </TouchableOpacity>
        {showProductDrop && <ProductDropdown catalog={catalog} onSelect={handleSelectProduct} />}
      </View>
      <View style={ws ? W.addRow : styles.addProductRow}>
        <TextInput style={[ws ? W.addInput : styles.addProductInput, { flex: 1, marginRight: 8 }]} placeholder="Số lượng" placeholderTextColor="#B0B0C8" keyboardType="numeric" value={newProduct.qty} onChangeText={v => setNewProduct(p => ({ ...p, qty: v }))} />
        <View style={[ws ? W.addInput : styles.addProductInput, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9' }]}>
          <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
          <Text style={{ flex: 1, fontSize: 14, color: newProduct.price ? '#0F172A' : '#94A3B8' }}>{newProduct.price ? fmt(parseInt(newProduct.price)) : ROLE_LABEL[role]}</Text>
        </View>
      </View>
      <View style={ws ? W.addActions : styles.addProductActions}>
        <TouchableOpacity style={ws ? W.addCancel : styles.addProductCancel} onPress={() => { setShowAddProduct(false); setShowProductDrop(false); setNewProduct({ name: '', qty: '1', price: '', productId: '' }); }}>
          <Text style={ws ? W.addCancelText : styles.addProductCancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ws ? W.addConfirm : styles.addProductConfirm} onPress={addProduct}>
          <Text style={ws ? W.addConfirmText : styles.addProductConfirmText}>Thêm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Service Section ───────────────────────────────────────
  const ServiceSection = ({ ws }) => (
    <View style={ws ? W.serviceCard : styles.serviceCard}>
      {/* Toggle header */}
      <TouchableOpacity style={ws ? W.serviceToggleRow : styles.serviceToggleRow} onPress={() => setIncludeService(p => !p)} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={[ws ? W.serviceIcon : styles.serviceIcon, { backgroundColor: includeService ? '#EFF6FF' : '#F1F5F9' }]}>
            <Ionicons name="construct-outline" size={16} color={includeService ? '#2563EB' : '#94A3B8'} />
          </View>
          <View>
            <Text style={[ws ? W.serviceToggleLabel : styles.serviceToggleLabel, includeService && { color: '#2563EB' }]}>Tạo dịch vụ kèm đơn hàng</Text>
            <Text style={ws ? W.serviceToggleSub : styles.serviceToggleSub}>{includeService ? 'Dịch vụ sẽ được lưu cùng đơn' : 'Tuỳ chọn'}</Text>
          </View>
        </View>
        {/* Toggle switch */}
        <View style={[ws ? W.toggleSwitch : styles.toggleSwitch, includeService && (ws ? W.toggleOn : styles.toggleOn)]}>
          <View style={[ws ? W.toggleThumb : styles.toggleThumb, includeService && (ws ? W.toggleThumbOn : styles.toggleThumbOn)]} />
        </View>
      </TouchableOpacity>

      {/* Body — hiện khi bật */}
      {includeService && (
        <View style={ws ? W.serviceBody : styles.serviceBody}>
          {/* Service type */}
          <Text style={ws ? W.svcLabel : styles.svcLabel}>Loại dịch vụ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SERVICE_TYPES.map(t => {
              const active = serviceType === t.key;
              return (
                <TouchableOpacity key={t.key}
                  style={[ws ? W.svcTypeTab : styles.svcTypeTab, active && { borderColor: t.color, backgroundColor: t.color + '18' }]}
                  onPress={() => setServiceType(t.key)} activeOpacity={0.8}
                >
                  <Ionicons name={t.icon} size={13} color={active ? t.color : '#94A3B8'} />
                  <Text style={[ws ? W.svcTypeText : styles.svcTypeText, active && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sản phẩm sẽ được đính kèm */}
          {products.length > 0 && (
            <View style={ws ? W.svcItemsBox : styles.svcItemsBox}>
              <Text style={ws ? W.svcItemsTitle : styles.svcItemsTitle}>Sản phẩm đính kèm:</Text>
              {products.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                  <Ionicons name="water-outline" size={12} color="#64748B" />
                  <Text style={{ flex: 1, fontSize: 12, color: '#374151' }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>x{p.qty}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB' }}>{fmt(p.price)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ghi chú */}
          <Text style={ws ? W.svcLabel : styles.svcLabel}>Ghi chú dịch vụ</Text>
          <View style={[ws ? W.inputBox : styles.svcNoteBox, { alignItems: 'flex-start', minHeight: 64 }]}>
            <TextInput style={[{ flex: 1, fontSize: 13, color: '#0F172A', textAlignVertical: 'top' }, { ...(ws ? { fontWeight: '500' } : {}) }]} placeholder="Yêu cầu lắp đặt, bảo dưỡng..." placeholderTextColor="#94A3B8" multiline value={serviceNote} onChangeText={setServiceNote} />
          </View>

          {/* Info */}
          <View style={ws ? W.svcInfo : styles.svcInfo}>
            <Ionicons name="information-circle-outline" size={14} color="#2563EB" />
            <Text style={ws ? W.svcInfoText : styles.svcInfoText}>Dịch vụ sẽ được lưu vào db/service với orderId đính kèm.</Text>
          </View>
        </View>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // WEB LAYOUT
  // ─────────────────────────────────────────────────────────
  if (isWeb) return (
    <View style={W.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>
        <View style={W.pageHeader}>
          <View>
            <Text style={W.pageTitle}>Tạo đơn hàng mới</Text>
            <Text style={W.pageSub}>Điền thông tin để tạo đơn hàng cho khách hàng</Text>
          </View>
          <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={16} color="#64748B" />
            <Text style={W.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
        </View>

        <View style={W.grid}>
          {/* ── LEFT ── */}
          <View style={W.col}>
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Thông tin đơn hàng</Text>
              </View>
              <View style={W.row2}>
                <View style={[W.inputGroup, { flex: 1 }]}>
                  <Text style={W.label}>Order ID</Text>
                  <View style={W.inputBox}><Text style={W.inputReadonly}>{orderId}</Text><Ionicons name="lock-closed-outline" size={14} color="#CBD5E1" /></View>
                </View>
                <View style={[W.inputGroup, { flex: 1 }]}>
                  <Text style={W.label}>Ngày giao hàng <Text style={W.req}>*</Text></Text>
                  <DateField orderDate={orderDate} setOrderDate={setOrderDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
                </View>
              </View>

              {/* Customer */}
              <View style={W.inputGroup}>
                <Text style={W.label}>Khách hàng <Text style={W.req}>*</Text></Text>
                <TouchableOpacity style={[W.inputBox, showCustomerPicker && W.inputBoxFocus]} onPress={() => setShowCustomerPicker(p => !p)} activeOpacity={0.8}>
                  {selectedCustomer ? (
                    <View style={W.selectedCustomer}>
                      <View style={W.cAvatar}><Text style={W.cAvatarText}>{(selectedCustomer.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}</Text></View>
                      <View><Text style={W.cName}>{selectedCustomer.name}</Text><Text style={W.cPhone}>{selectedCustomer.phone}</Text></View>
                    </View>
                  ) : <Text style={W.inputPlaceholder}>{customerLoading ? 'Đang tải...' : 'Chọn khách hàng...'}</Text>}
                  <Ionicons name={showCustomerPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                </TouchableOpacity>
                {showCustomerPicker && <CustomerPickerDropdown ws />}
              </View>

              <View style={W.inputGroup}>
                <Text style={W.label}>Địa chỉ giao hàng</Text>
                <View style={W.inputBox}><TextInput style={W.input} placeholder="Nhập địa chỉ..." placeholderTextColor="#94A3B8" value={deliveryAddress} onChangeText={setDeliveryAddress} /></View>
              </View>
              <View style={W.inputGroup}>
                <Text style={W.label}>Ghi chú</Text>
                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}><TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#94A3B8" multiline value={notes} onChangeText={setNotes} /></View>
              </View>
            </View>
          </View>

          {/* ── RIGHT ── */}
          <View style={W.colRight}>
            {/* Sản phẩm */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="cube-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Sản phẩm</Text>
                {products.length > 0 && <View style={W.productCount}><Text style={W.productCountText}>{products.length}</Text></View>}
                <View style={W.roleBadge}><Ionicons name="pricetag-outline" size={11} color="#059669" /><Text style={W.roleBadgeText}>{ROLE_LABEL[role]}</Text></View>
              </View>
              {products.map(p => (
                <View key={p.id} style={W.productRow}>
                  <View style={W.productIcon}><Ionicons name="water-outline" size={14} color="#2563EB" /></View>
                  <View style={{ flex: 1 }}><Text style={W.productName}>{p.name}</Text><Text style={W.productMeta}>x{p.qty} · {fmt(p.price)}</Text></View>
                  <Text style={W.productTotal}>{fmt(p.price * p.qty)}</Text>
                  <TouchableOpacity onPress={() => removeProduct(p.id)} style={W.removeBtn}><Ionicons name="trash-outline" size={14} color="#EF4444" /></TouchableOpacity>
                </View>
              ))}
              {showAddProduct ? <AddProductForm ws /> : (
                <TouchableOpacity style={W.addProductBtn} onPress={() => setShowAddProduct(true)}>
                  <Ionicons name="add" size={16} color="#2563EB" />
                  <Text style={W.addProductBtnText}>Thêm sản phẩm</Text>
                </TouchableOpacity>
              )}
              {products.length > 0 && (
                <View style={W.totalBox}>
                  <View style={W.totalRow}><Text style={W.totalLabel}>Số mặt hàng</Text><Text style={W.totalValue}>{products.length} loại</Text></View>
                  <View style={W.totalDivider} />
                  <View style={W.totalRow}><Text style={W.totalLabelBig}>Tổng cộng</Text><Text style={W.totalAmountBig}>{fmt(totalAmount)}</Text></View>
                </View>
              )}
            </View>

            {/* ✅ Dịch vụ đính kèm */}
            <ServiceSection ws />

            <TouchableOpacity style={[W.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
              <Text style={W.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}</Text>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F2C" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerLabel}>Tạo đơn hàng</Text>
        <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{userDetail?.name?.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? 'U'}{userDetail?.name?.trim().split(/\s+/)[0]?.[0]?.toUpperCase() ?? ''}</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.formCard}>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Order ID</Text>
              <View style={styles.inputBox}><Text style={styles.inputReadonly}>{orderId}</Text></View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ngày giao hàng</Text>
              <DateField orderDate={orderDate} setOrderDate={setOrderDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Khách hàng</Text>
              <TouchableOpacity style={styles.inputBox} onPress={() => setShowCustomerPicker(p => !p)} activeOpacity={0.8}>
                <Text style={selectedCustomer ? styles.input : styles.inputPlaceholder}>{selectedCustomer ? selectedCustomer.name : customerLoading ? 'Đang tải...' : 'Chọn khách hàng...'}</Text>
                <Ionicons name={showCustomerPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#B0B0C8" />
              </TouchableOpacity>
              {showCustomerPicker && <CustomerPickerDropdown ws={false} />}
            </View>

            {/* Sản phẩm */}
            <View style={styles.productSection}>
              <View style={styles.productHeader}>
                <Ionicons name="cube-outline" size={18} color="#fff" />
                <Text style={styles.productHeaderText}>Sản phẩm</Text>
                <View style={styles.rolePill}><Text style={styles.rolePillText}>{ROLE_LABEL[role]}</Text></View>
              </View>
              {products.map(p => (
                <View key={p.id} style={styles.productItem}>
                  <View style={styles.productItemLeft}><Text style={styles.productItemName} numberOfLines={1}>{p.name}</Text><Text style={styles.productItemMeta}>x{p.qty} • {fmt(p.price)}</Text></View>
                  <View style={styles.productItemRight}><Text style={styles.productItemTotal}>{fmt(p.price * p.qty)}</Text><TouchableOpacity onPress={() => removeProduct(p.id)}><Ionicons name="close-circle" size={18} color="#F44336" /></TouchableOpacity></View>
                </View>
              ))}
              {showAddProduct ? <AddProductForm ws={false} /> : (
                <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowAddProduct(true)} activeOpacity={0.8}>
                  <Ionicons name="add" size={18} color="#2563EB" /><Text style={styles.addProductBtnText}>Thêm sản phẩm</Text>
                </TouchableOpacity>
              )}
              {products.length > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Tổng cộng</Text><Text style={styles.totalAmount}>{fmt(totalAmount)}</Text></View>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Địa chỉ giao hàng</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}><TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Địa chỉ giao hàng..." placeholderTextColor="#B0B0C8" multiline value={deliveryAddress} onChangeText={setDeliveryAddress} /></View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ghi chú (tuỳ chọn)</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}><TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#B0B0C8" multiline value={notes} onChangeText={setNotes} /></View>
            </View>

            {/* ✅ Dịch vụ đính kèm */}
            <ServiceSection ws={false} />

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: insets.bottom + 24 }} />
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
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
  pageSub: { fontSize: 14, color: '#64748B' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  grid: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  col: { flex: 3 },
  colRight: { flex: 2, gap: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
  productCount: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  productCountText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  roleBadgeText: { fontSize: 10, color: '#059669', fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
  req: { color: '#EF4444' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  inputBoxFocus: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  inputReadonly: { flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
  selectedCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  cAvatarText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  cName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cPhone: { fontSize: 11, color: '#64748B' },
  dropdown: { backgroundColor: '#FFF', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  dropdownAvatarText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  dropdownItemText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dropdownItemTextActive: { color: '#2563EB' },
  dropdownItemSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  dropdownEmpty: { padding: 16, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: 10 },
  productIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  productMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
  productTotal: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  removeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  addForm: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  addInput: { backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  addRow: { flexDirection: 'row', gap: 8 },
  addActions: { flexDirection: 'row', gap: 8 },
  addCancel: { flex: 1, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFF' },
  addCancelText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  addConfirm: { flex: 1, padding: 9, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  addConfirmText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 9, backgroundColor: '#EFF6FF' },
  addProductBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  totalBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, marginTop: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalDivider: { height: 1, backgroundColor: '#E2E8F0' },
  totalLabel: { fontSize: 12, color: '#64748B' },
  totalValue: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  totalLabelBig: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalAmountBig: { fontSize: 18, fontWeight: '800', color: '#2563EB', letterSpacing: -0.5 },
  // Service
  serviceCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  serviceToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  serviceToggleLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  serviceToggleSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  toggleSwitch: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#2563EB' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  serviceBody: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
  svcLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  svcTypeTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 6, backgroundColor: '#F8FAFC' },
  svcTypeText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  svcItemsBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 2 },
  svcItemsTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  svcInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  svcInfoText: { flex: 1, fontSize: 12, color: '#2563EB' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  submitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

// ── Mobile Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F2C' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerLabel: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  scroll: { paddingBottom: 24 },
  formCard: { backgroundColor: '#F8F9FF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 8 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3, marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  textAreaBox: { alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  inputReadonly: { flex: 1, fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  inputPlaceholder: { flex: 1, fontSize: 14, color: '#B0B0C8' },
  dropdown: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownSearchInput: { flex: 1, fontSize: 13, color: '#1A1A2E' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  dropdownItemTextActive: { color: '#2563EB', fontWeight: '700' },
  dropdownItemSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  dropdownEmpty: { padding: 14, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  productSection: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 18, borderWidth: 1, borderColor: '#E5E7EB' },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E3A8A', paddingHorizontal: 14, paddingVertical: 12 },
  productHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  rolePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  rolePillText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  productItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  productItemLeft: { flex: 1, marginRight: 8 },
  productItemName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  productItemMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  productItemRight: { alignItems: 'flex-end', gap: 4 },
  productItemTotal: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  addProductForm: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  addProductInput: { backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB' },
  addProductRow: { flexDirection: 'row' },
  addProductActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addProductCancel: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  addProductCancelText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  addProductConfirm: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  addProductConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#BFDBFE', margin: 12, borderRadius: 10, backgroundColor: '#EFF6FF' },
  addProductBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#EFF6FF', borderTopWidth: 1, borderTopColor: '#BFDBFE' },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },
  totalAmount: { fontSize: 16, fontWeight: '900', color: '#1E3A8A' },
  // Service
  serviceCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 18, overflow: 'hidden' },
  serviceToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  serviceIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  serviceToggleLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  serviceToggleSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  toggleSwitch: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#2563EB' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  serviceBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, gap: 8 },
  svcLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3, marginBottom: 4 },
  svcTypeTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 8, backgroundColor: '#F8FAFC' },
  svcTypeText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  svcNoteBox: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  svcItemsBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 2 },
  svcItemsTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  svcInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  svcInfoText: { flex: 1, fontSize: 12, color: '#2563EB' },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});