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

// ── Order types ───────────────────────────────────────────────
const ORDER_TYPES = {
  buon: {
    key: 'buon', label: 'Đơn buôn',
    desc: 'Đại lý — giao hàng số lượng lớn',
    icon: 'cube-outline', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
    autoService: 'DELIVERY', autoSvcLabel: 'Giao hàng', autoSvcIcon: 'car-outline',
  },
  le: {
    key: 'le', label: 'Đơn lẻ',
    desc: 'NPP / CTV — lắp đặt tại nhà khách',
    icon: 'home-outline', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
    autoService: 'INSTALLATION', autoSvcLabel: 'Lắp đặt', autoSvcIcon: 'build-outline',
  },
};

// Role → locked order type (null = admin có thể chọn)
const ROLE_ORDER_TYPE = {
  daily: 'buon',   // đại lý → chỉ đơn buôn
  ctv: 'le',     // cộng tác viên → chỉ đơn lẻ
  phantan: 'le',     // nhà phân phối → chỉ đơn lẻ
  admin: null,     // admin → chọn cả hai
  other: 'le',
};

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

  // ── Locked order type theo role ───────────────────────────
  const lockedType = ROLE_ORDER_TYPE[role];
  const orderType = lockedType || 'le';  // admin defaults to 'le', can change
  const [selectedOrderType, setSelectedOrderType] = useState(lockedType || 'le');
  const activeType = lockedType ?? selectedOrderType;
  const typeCfg = ORDER_TYPES[activeType];

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
        (await getDocs(query(collection(db, 'customers'), where('addBy', '==', myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
      } else if (role === 'daily' || role === 'phantan') {
        (await getDocs(query(collection(db, 'customers'), where('addBy', '==', myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        const subs = (await getDocs(query(collection(db, 'users'), where('advisor', '==', myEmail)))).docs.map(d => d.data().email).filter(Boolean);
        for (let i = 0; i < subs.length; i += 30) {
          (await getDocs(query(collection(db, 'customers'), where('addBy', 'in', subs.slice(i, i + 30))))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
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
      const newOrder = {
        id: orderId, customer: selectedCustomer.name,
        items: products, createdAt: orderDate,
        address: deliveryAddress, note: notes,
        status: 'PENDING', orderType: activeType,
      };
      await setDoc(doc(db, 'orders', selectedCustomer.phone), { orders: arrayUnion(newOrder) }, { merge: true });

      // ✅ Tự động tạo dịch vụ — không có toggle
      const svcId = 'SV-' + Date.now().toString().slice(-6);
      await setDoc(doc(db, 'service', svcId), {
        id: svcId, type: typeCfg.autoService,
        orderId, orderItems: products,
        customer: selectedCustomer.name, phone: selectedCustomer.phone,
        address: deliveryAddress, note: serviceNote,
        status: 'PENDING', createdBy: userDetail?.email || '',
        createdAt: new Date().toISOString(),
        autoAssigned: true, orderType: activeType,
      });

      showSuccess(
        'Đơn hàng đã được tạo!',
        `Mã đơn: ${orderId} (${typeCfg.label})\nDịch vụ ${typeCfg.autoSvcLabel} đã được tự động tạo kèm.`,
        () => router.replace('/(tabs)/order')
      );
    } catch (e) { showAlert('Lỗi', e.message); }
    finally { setSubmitting(false); }
  };

  // ── Customer Picker ───────────────────────────────────────
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

  // ── Order type badge / selector ───────────────────────────
  // Nếu locked → chỉ hiện badge thông báo, không cho chọn
  // Nếu admin → hiện 2 lựa chọn
  const OrderTypeBadge = ({ ws }) => {
    if (lockedType) {
      // Locked — chỉ hiện badge
      return (
        <View style={[ws ? W.lockedBadge : styles.lockedBadge, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
          <Ionicons name={typeCfg.icon} size={16} color={typeCfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[ws ? W.lockedBadgeLabel : styles.lockedBadgeLabel, { color: typeCfg.color }]}>{typeCfg.label}</Text>
            <Text style={ws ? W.lockedBadgeDesc : styles.lockedBadgeDesc}>{typeCfg.desc}</Text>
          </View>
          <Ionicons name="lock-closed" size={13} color={typeCfg.color} />
        </View>
      );
    }
    // Admin — 2 lựa chọn
    return (
      <View style={ws ? W.typeRow : styles.typeRow}>
        {Object.values(ORDER_TYPES).map(t => {
          const active = selectedOrderType === t.key;
          return (
            <TouchableOpacity key={t.key}
              style={[ws ? W.typeCard : styles.typeCard, active && { borderColor: t.color, backgroundColor: t.bg }]}
              onPress={() => setSelectedOrderType(t.key)} activeOpacity={0.8}
            >
              <View style={[ws ? W.typeCardIcon : styles.typeCardIcon, { backgroundColor: active ? t.color + '22' : '#F1F5F9' }]}>
                <Ionicons name={t.icon} size={18} color={active ? t.color : '#94A3B8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ws ? W.typeCardLabel : styles.typeCardLabel, active && { color: t.color }]}>{t.label}</Text>
                <Text style={ws ? W.typeCardDesc : styles.typeCardDesc}>{t.desc}</Text>
              </View>
              {active && <View style={[ws ? W.typeCheckDot : styles.typeCheckDot, { backgroundColor: t.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Auto service info banner ──────────────────────────────
  const AutoServiceBanner = ({ ws }) => (
    <View style={[ws ? W.svcBanner : styles.svcBanner, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
      <View style={[ws ? W.svcBannerIcon : styles.svcBannerIcon, { backgroundColor: typeCfg.color + '22' }]}>
        <Ionicons name={typeCfg.autoSvcIcon} size={18} color={typeCfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[ws ? W.svcBannerTitle : styles.svcBannerTitle, { color: typeCfg.color }]}>
            Dịch vụ {typeCfg.autoSvcLabel} tự động
          </Text>
          <View style={[ws ? W.autoBadge : styles.autoBadge, { backgroundColor: typeCfg.color + '22', borderColor: typeCfg.color + '44' }]}>
            <Ionicons name="flash" size={9} color={typeCfg.color} />
            <Text style={[ws ? W.autoBadgeText : styles.autoBadgeText, { color: typeCfg.color }]}>Tự động</Text>
          </View>
        </View>
        <Text style={ws ? W.svcBannerSub : styles.svcBannerSub}>
          Khi tạo đơn hàng này, dịch vụ {typeCfg.autoSvcLabel.toLowerCase()} sẽ tự động được tạo kèm.
        </Text>
      </View>
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
          <TouchableOpacity style={W.cancelBtn} onPress={() => router.replace('/(tabs)/order')}>
            <Ionicons name="close" size={16} color="#64748B" />
            <Text style={W.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
        </View>

        <View style={W.grid}>
          {/* ── LEFT ── */}
          <View style={W.col}>
            {/* Thể loại */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="layers-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Thể loại đơn hàng</Text>
                {lockedType && (
                  <View style={W.roleLockBadge}>
                    <Ionicons name="lock-closed" size={10} color="#64748B" />
                    <Text style={W.roleLockText}>Theo role</Text>
                  </View>
                )}
              </View>
              <OrderTypeBadge ws />
            </View>

            {/* Thông tin đơn hàng */}
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
                <Text style={W.label}>Ghi chú đơn hàng</Text>
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

            {/* ✅ Auto service banner (luôn hiện, không có toggle) */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name={typeCfg.autoSvcIcon} size={16} color={typeCfg.color} />
                <Text style={W.cardTitle}>Dịch vụ kèm đơn</Text>
              </View>
              <AutoServiceBanner ws />
              <View style={[W.inputGroup, { marginTop: 12 }]}>
                <Text style={W.label}>Ghi chú dịch vụ</Text>
                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 64 }]}>
                  <TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder={`Yêu cầu ${typeCfg.autoSvcLabel.toLowerCase()}...`} placeholderTextColor="#94A3B8" multiline value={serviceNote} onChangeText={setServiceNote} />
                </View>
              </View>
            </View>

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
        <TouchableOpacity onPress={() => router.replace('/(tabs)/order')} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerLabel}>Tạo đơn hàng</Text>
        <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{userDetail?.name?.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? 'U'}{userDetail?.name?.trim().split(/\s+/)[0]?.[0]?.toUpperCase() ?? ''}</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.formCard}>

            {/* Thể loại */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thể loại đơn hàng</Text>
              <OrderTypeBadge ws={false} />
            </View>

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

            {/* Auto service banner */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dịch vụ kèm đơn</Text>
              <AutoServiceBanner ws={false} />
              <View style={[styles.inputBox, styles.textAreaBox, { marginTop: 8 }]}>
                <TextInput style={[styles.input, { minHeight: 56, textAlignVertical: 'top' }]} placeholder={`Ghi chú ${typeCfg.autoSvcLabel.toLowerCase()}...`} placeholderTextColor="#B0B0C8" multiline value={serviceNote} onChangeText={setServiceNote} />
              </View>
            </View>

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
  roleLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  roleLockText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
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
  addInput: { backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', minHeight: 42, justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
  // Order type
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  lockedBadgeLabel: { fontSize: 14, fontWeight: '700' },
  lockedBadgeDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeCard: { flex: 1, flexDirection: 'column', gap: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', position: 'relative' },
  typeCardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeCardLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  typeCardDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  typeCheckDot: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  // Service banner
  svcBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1 },
  svcBannerIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  svcBannerTitle: { fontSize: 13, fontWeight: '700' },
  svcBannerSub: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  autoBadgeText: { fontSize: 9, fontWeight: '700' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  submitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

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
  addProductInput: { backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB', minHeight: 42, justifyContent: 'center' },
  addProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  // Order type mobile
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  lockedBadgeLabel: { fontSize: 14, fontWeight: '700' },
  lockedBadgeDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, gap: 6, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', position: 'relative' },
  typeCardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeCardLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  typeCardDesc: { fontSize: 10, color: '#94A3B8' },
  typeCheckDot: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  svcBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  svcBannerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  svcBannerTitle: { fontSize: 13, fontWeight: '700' },
  svcBannerSub: { fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 16 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  autoBadgeText: { fontSize: 9, fontWeight: '700' },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});