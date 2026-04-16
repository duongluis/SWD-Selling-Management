import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// ── Role helpers ─────────────────────────────────────────────
const getRole = (userDetail) => {
  const r = (userDetail?.role || userDetail?.member || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
  if (['nhà phân phối', 'phantan', 'distributor'].includes(r)) return 'phantan';
  if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
  return 'other';
};

const getPriceField = (role) => {
  switch (role) {
    case 'daily': return 'price_a';
    case 'phantan': return 'price_p';
    case 'ctv': return 'price_c';
    default: return 'price';
  }
};

const ROLE_LABEL = {
  admin: 'Giá niêm yết', daily: 'Giá đại lý',
  phantan: 'Giá NP phối', ctv: 'Giá CTV', other: 'Giá niêm yết',
};

const formatCurrency = (n) =>
  (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

// ── Product Name Picker ──────────────────────────────────────
// Hiển thị inline dưới ô tên sản phẩm
function ProductDropdown({ catalog, onSelect }) {
  const [search, setSearch] = useState('');
  const filtered = catalog.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={PD.wrap}>
      <View style={PD.searchRow}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput
          style={PD.searchInput}
          placeholder="Tìm sản phẩm..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={14} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={PD.empty}>Không tìm thấy sản phẩm</Text>
        ) : (
          filtered.map(item => (
            <TouchableOpacity
              key={String(item.id || item.docId)}
              style={PD.item}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <View style={PD.icon}>
                <Ionicons name="water-outline" size={13} color="#2563EB" />
              </View>
              <Text style={PD.name} numberOfLines={1}>{item.name}</Text>
              <Text style={PD.capacity}>{item.capacity || ''}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const PD = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6, overflow: 'hidden', zIndex: 99 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  icon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  capacity: { fontSize: 11, color: '#94A3B8' },
  empty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});

// ── Main Component ───────────────────────────────────────────
export default function AddOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userDetail } = useContext(UserDetailContext);
  const customerList = userDetail?.customer || [];

  const role = getRole(userDetail);
  const priceField = getPriceField(role);

  const [catalog, setCatalog] = useState([]);

  const [orderId] = useState('ORD-' + Date.now().toString().slice(-6));
  const [orderDate, setOrderDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [products, setProducts] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add product form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', qty: '1', price: '', productId: '' });

  useEffect(() => {
    getDocs(collection(db, 'price'))
      .then(snap => {
        const data = snap.docs
          .map(d => ({ ...d.data(), docId: d.id }))
          .sort((a, b) => (a.id || 0) - (b.id || 0));
        setCatalog(data);
      })
      .catch(e => console.error('Lỗi fetch catalog:', e));
  }, []);

  // Khi chọn sản phẩm từ dropdown
  const handleSelectProduct = (product) => {
    setNewProduct({
      name: product.name,
      qty: '1',
      price: String(product[priceField] || product.price || 0),
      productId: String(product.id || product.docId),
    });
    setShowProductDrop(false);
  };

  const addProduct = () => {
    if (!newProduct.name) {
      Alert.alert('Thông báo', 'Vui lòng chọn sản phẩm');
      return;
    }
    setProducts(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newProduct.name,
        qty: parseInt(newProduct.qty) || 1,
        price: parseInt(newProduct.price) || 0,
      },
    ]);
    setNewProduct({ name: '', qty: '1', price: '', productId: '' });
    setShowAddProduct(false);
    setShowProductDrop(false);
  };

  const removeProduct = (id) => setProducts(prev => prev.filter(p => p.id !== id));

  const totalAmount = products.reduce((sum, p) => sum + p.price * p.qty, 0);

  const handleSubmit = async () => {
    if (!selectedCustomer) { Alert.alert('Thông báo', 'Vui lòng chọn khách hàng'); return; }
    if (products.length === 0) { Alert.alert('Thông báo', 'Vui lòng thêm ít nhất 1 sản phẩm'); return; }
    setSubmitting(true);
    try {
      const newOrder = {
        id: orderId, customer: selectedCustomer.name,
        items: products, createdAt: orderDate,
        address: deliveryAddress, note: notes, status: 'PENDING',
      };
      await setDoc(
        doc(db, 'orders', selectedCustomer.phone),
        { orders: arrayUnion(newOrder) },
        { merge: true }
      );
      Alert.alert('Thành công', `Đơn hàng ${orderId} đã được tạo!`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/order') },
      ]);
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) { setSelectedDate(date); setOrderDate(date.toISOString()); }
  };

  // ── Shared: Add Product Form ─────────────────────────────
  // Dùng chung cho cả web và mobile
  const AddProductForm = ({ webStyle }) => (
    <View style={webStyle ? W.addForm : styles.addProductForm}>

      {/* Tên sản phẩm — bấm để chọn từ catalog */}
      <View>
        <TouchableOpacity
          style={webStyle ? W.addInput : styles.addProductInput}
          onPress={() => setShowProductDrop(!showProductDrop)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="cube-outline" size={14} color={newProduct.name ? '#0F172A' : '#94A3B8'} />
            <Text style={{ fontSize: 14, color: newProduct.name ? '#0F172A' : '#94A3B8', flex: 1 }} numberOfLines={1}>
              {newProduct.name || 'Bấm để chọn sản phẩm...'}
            </Text>
            <Ionicons name={showProductDrop ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* Dropdown sản phẩm */}
        {showProductDrop && (
          <ProductDropdown
            catalog={catalog}
            onSelect={handleSelectProduct}
          />
        )}
      </View>

      {/* Số lượng + Giá */}
      <View style={webStyle ? W.addRow : styles.addProductRow}>
        <TextInput
          style={[webStyle ? W.addInput : styles.addProductInput, { flex: 1, marginRight: 8 }]}
          placeholder="Số lượng"
          placeholderTextColor="#B0B0C8"
          keyboardType="numeric"
          value={newProduct.qty}
          onChangeText={v => setNewProduct(p => ({ ...p, qty: v }))}
        />

        {/* Giá — readonly, hiển thị đã format */}
        <View style={[
          webStyle ? W.addInput : styles.addProductInput,
          { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9' },
        ]}>
          <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
          <Text style={{ flex: 1, fontSize: 14, color: newProduct.price ? '#0F172A' : '#94A3B8' }}>
            {newProduct.price
              ? formatCurrency(parseInt(newProduct.price))
              : `${ROLE_LABEL[role]}`}
          </Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={webStyle ? W.addActions : styles.addProductActions}>
        <TouchableOpacity
          style={webStyle ? W.addCancel : styles.addProductCancel}
          onPress={() => { setShowAddProduct(false); setShowProductDrop(false); setNewProduct({ name: '', qty: '1', price: '', productId: '' }); }}
        >
          <Text style={webStyle ? W.addCancelText : styles.addProductCancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={webStyle ? W.addConfirm : styles.addProductConfirm}
          onPress={addProduct}
        >
          <Text style={webStyle ? W.addConfirmText : styles.addProductConfirmText}>Thêm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Date field ───────────────────────────────────────────
  const DateField = () => {
    if (isWeb) return (
      <View style={W.inputBox}>
        <input
          type="date"
          min={new Date().toISOString().split('T')[0]}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', fontWeight: '500', cursor: 'pointer', width: '100%' }}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            setSelectedDate(date);
            setOrderDate(date.toISOString());
          }}
        />
        <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
      </View>
    );
    return (
      <>
        <TouchableOpacity style={styles.inputBox} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
          <Text style={orderDate ? styles.input : styles.inputPlaceholder}>
            {orderDate ? new Date(orderDate).toLocaleDateString('vi-VN') : 'Chọn ngày giao hàng...'}
          </Text>
          <Ionicons name="calendar-outline" size={18} color="#B0B0C8" />
        </TouchableOpacity>
        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal transparent animationType="slide">
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowDatePicker(false)} />
              <View style={{ backgroundColor: '#fff', padding: 16 }}>
                <DateTimePicker value={selectedDate} mode="date" display="spinner" minimumDate={new Date()} onChange={handleDateChange} />
                <Pressable onPress={() => setShowDatePicker(false)} style={{ alignItems: 'center', padding: 12 }}>
                  <Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text>
                </Pressable>
              </View>
            </Modal>
          ) : (
            <DateTimePicker value={selectedDate} mode="date" display="default" minimumDate={new Date()} onChange={handleDateChange} />
          )
        )}
      </>
    );
  };

  // ─────────────────────────────────────────────────────────
  // WEB LAYOUT
  // ─────────────────────────────────────────────────────────
  if (isWeb) {
    return (
      <View style={W.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>

          <View style={W.pageHeader}>
            <View>
              <Text style={W.pageTitle}>Tạo đơn hàng mới</Text>
              <Text style={W.pageSub}>Điền thông tin để tạo đơn hàng mới cho khách hàng</Text>
            </View>
            <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={16} color="#64748B" />
              <Text style={W.cancelBtnText}>Huỷ</Text>
            </TouchableOpacity>
          </View>

          <View style={W.grid}>
            {/* LEFT */}
            <View style={W.col}>
              <View style={W.card}>
                <View style={W.cardHeader}>
                  <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                  <Text style={W.cardTitle}>Thông tin đơn hàng</Text>
                </View>

                <View style={W.row2}>
                  <View style={[W.inputGroup, { flex: 1 }]}>
                    <Text style={W.label}>Order ID</Text>
                    <View style={W.inputBox}>
                      <Text style={W.inputReadonly}>{orderId}</Text>
                      <Ionicons name="lock-closed-outline" size={14} color="#CBD5E1" />
                    </View>
                  </View>
                  <View style={[W.inputGroup, { flex: 1 }]}>
                    <Text style={W.label}>Ngày giao hàng <Text style={W.required}>*</Text></Text>
                    <DateField />
                  </View>
                </View>

                <View style={W.inputGroup}>
                  <Text style={W.label}>Khách hàng <Text style={W.required}>*</Text></Text>
                  <TouchableOpacity
                    style={[W.inputBox, showCustomerPicker && W.inputBoxFocus]}
                    onPress={() => setShowCustomerPicker(!showCustomerPicker)}
                    activeOpacity={0.8}
                  >
                    {selectedCustomer ? (
                      <View style={W.selectedCustomer}>
                        <View style={W.customerAvatar}>
                          <Text style={W.customerAvatarText}>
                            {selectedCustomer.name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Text>
                        </View>
                        <View>
                          <Text style={W.customerName}>{selectedCustomer.name}</Text>
                          <Text style={W.customerPhone}>{selectedCustomer.phone}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={W.inputPlaceholder}>Chọn khách hàng...</Text>
                    )}
                    <Ionicons name={showCustomerPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  {showCustomerPicker && (
                    <View style={W.dropdown}>
                      {customerList.length === 0 ? (
                        <Text style={W.dropdownEmpty}>Chưa có khách hàng nào</Text>
                      ) : customerList.map((c, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[W.dropdownItem, selectedCustomer?.name === c.name && W.dropdownItemActive]}
                          onPress={() => { setSelectedCustomer(c); setDeliveryAddress(c.address || ''); setShowCustomerPicker(false); }}
                        >
                          <View style={W.dropdownAvatar}>
                            <Text style={W.dropdownAvatarText}>
                              {c.name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[W.dropdownItemText, selectedCustomer?.name === c.name && W.dropdownItemTextActive]}>{c.name}</Text>
                            <Text style={W.dropdownItemSub}>{c.phone}</Text>
                          </View>
                          {selectedCustomer?.name === c.name && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={W.inputGroup}>
                  <Text style={W.label}>Địa chỉ giao hàng</Text>
                  <View style={W.inputBox}>
                    <TextInput style={W.input} placeholder="Nhập địa chỉ giao hàng..." placeholderTextColor="#94A3B8" value={deliveryAddress} onChangeText={setDeliveryAddress} />
                  </View>
                </View>

                <View style={W.inputGroup}>
                  <Text style={W.label}>Ghi chú (tuỳ chọn)</Text>
                  <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}>
                    <TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#94A3B8" multiline value={notes} onChangeText={setNotes} />
                  </View>
                </View>
              </View>
            </View>

            {/* RIGHT — Sản phẩm */}
            <View style={W.colRight}>
              <View style={W.card}>
                <View style={W.cardHeader}>
                  <Ionicons name="cube-outline" size={16} color="#2563EB" />
                  <Text style={W.cardTitle}>Sản phẩm</Text>
                  {products.length > 0 && (
                    <View style={W.productCount}>
                      <Text style={W.productCountText}>{products.length}</Text>
                    </View>
                  )}
                  <View style={W.roleBadge}>
                    <Ionicons name="pricetag-outline" size={11} color="#059669" />
                    <Text style={W.roleBadgeText}>{ROLE_LABEL[role]}</Text>
                  </View>
                </View>

                {/* Product list */}
                {products.map(p => (
                  <View key={p.id} style={W.productRow}>
                    <View style={W.productIcon}>
                      <Ionicons name="water-outline" size={14} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={W.productName}>{p.name}</Text>
                      <Text style={W.productMeta}>x{p.qty} · {formatCurrency(p.price)}</Text>
                    </View>
                    <Text style={W.productTotal}>{formatCurrency(p.price * p.qty)}</Text>
                    <TouchableOpacity onPress={() => removeProduct(p.id)} style={W.removeBtn}>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add product form */}
                {showAddProduct
                  ? <AddProductForm webStyle />
                  : (
                    <TouchableOpacity style={W.addProductBtn} onPress={() => setShowAddProduct(true)}>
                      <Ionicons name="add" size={16} color="#2563EB" />
                      <Text style={W.addProductBtnText}>Thêm sản phẩm</Text>
                    </TouchableOpacity>
                  )
                }

                {/* Total */}
                {products.length > 0 && (
                  <View style={W.totalBox}>
                    <View style={W.totalRow}>
                      <Text style={W.totalLabel}>Số lượng mặt hàng</Text>
                      <Text style={W.totalValue}>{products.length} loại</Text>
                    </View>
                    <View style={W.totalDivider} />
                    <View style={W.totalRow}>
                      <Text style={W.totalLabelBig}>Tổng cộng</Text>
                      <Text style={W.totalAmountBig}>{formatCurrency(totalAmount)}</Text>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[W.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                <Text style={W.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F2C" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Tạo đơn hàng</Text>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {userDetail?.name?.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? 'U'}
            {userDetail?.name?.trim().split(/\s+/)[0]?.[0]?.toUpperCase() ?? ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.formCard}>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Order ID</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputReadonly}>{orderId}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ngày giao hàng</Text>
              <DateField />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Khách hàng</Text>
              <TouchableOpacity style={styles.inputBox} onPress={() => setShowCustomerPicker(!showCustomerPicker)} activeOpacity={0.8}>
                <Text style={selectedCustomer ? styles.input : styles.inputPlaceholder}>
                  {selectedCustomer ? selectedCustomer.name : 'Chọn khách hàng...'}
                </Text>
                <Ionicons name={showCustomerPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#B0B0C8" />
              </TouchableOpacity>
              {showCustomerPicker && (
                <View style={styles.dropdown}>
                  {customerList.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>Chưa có khách hàng nào</Text>
                  ) : customerList.map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dropdownItem, selectedCustomer?.name === c.name && styles.dropdownItemActive]}
                      onPress={() => { setSelectedCustomer(c); setDeliveryAddress(c.address || ''); setShowCustomerPicker(false); }}
                    >
                      <Text style={[styles.dropdownItemText, selectedCustomer?.name === c.name && styles.dropdownItemTextActive]}>{c.name}</Text>
                      {selectedCustomer?.name === c.name && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Products */}
            <View style={styles.productSection}>
              <View style={styles.productHeader}>
                <Ionicons name="cube-outline" size={18} color="#fff" />
                <Text style={styles.productHeaderText}>Sản phẩm</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{ROLE_LABEL[role]}</Text>
                </View>
              </View>

              {products.map(p => (
                <View key={p.id} style={styles.productItem}>
                  <View style={styles.productItemLeft}>
                    <Text style={styles.productItemName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.productItemMeta}>x{p.qty} • {formatCurrency(p.price)}</Text>
                  </View>
                  <View style={styles.productItemRight}>
                    <Text style={styles.productItemTotal}>{formatCurrency(p.price * p.qty)}</Text>
                    <TouchableOpacity onPress={() => removeProduct(p.id)}>
                      <Ionicons name="close-circle" size={18} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {showAddProduct
                ? <AddProductForm webStyle={false} />
                : (
                  <TouchableOpacity
                    style={styles.addProductBtn}
                    onPress={() => setShowAddProduct(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={18} color="#2563EB" />
                    <Text style={styles.addProductBtnText}>Thêm sản phẩm</Text>
                  </TouchableOpacity>
                )
              }

              {products.length > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tổng cộng</Text>
                  <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Địa chỉ giao hàng</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Full shipping address..." placeholderTextColor="#B0B0C8" multiline value={deliveryAddress} onChangeText={setDeliveryAddress} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ghi chú (tuỳ chọn)</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Special handling instructions..." placeholderTextColor="#B0B0C8" multiline value={notes} onChangeText={setNotes} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
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

// ── Web Styles ───────────────────────────────────────────────
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
  required: { color: '#EF4444' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  inputBoxFocus: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  inputReadonly: { flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
  selectedCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  customerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  customerName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  customerPhone: { fontSize: 11, color: '#64748B' },
  dropdown: { backgroundColor: '#FFFFFF', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
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
  addInput: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  addRow: { flexDirection: 'row', gap: 8 },
  addActions: { flexDirection: 'row', gap: 8 },
  addCancel: { flex: 1, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
  addCancelText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  addConfirm: { flex: 1, padding: 9, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  addConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 9, backgroundColor: '#EFF6FF' },
  addProductBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  totalBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, marginTop: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalDivider: { height: 1, backgroundColor: '#E2E8F0' },
  totalLabel: { fontSize: 12, color: '#64748B' },
  totalValue: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  totalLabelBig: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalAmountBig: { fontSize: 18, fontWeight: '800', color: '#2563EB', letterSpacing: -0.5 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ── Mobile Styles ────────────────────────────────────────────
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
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownItemTextActive: { color: '#2563EB', fontWeight: '700' },
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
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});