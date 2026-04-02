import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const { width } = Dimensions.get('window');

export default function addOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userDetail } = useContext(UserDetailContext);

  const customerList = userDetail?.customer || [];

  const [orderId] = useState('ORD-' + Date.now().toString().slice(-6));
  const [orderDate, setOrderDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [products, setProducts] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', qty: '1', price: '' });

  const addProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên và giá sản phẩm');
      return;
    }
    setProducts(prev => [...prev, {
      id: Date.now().toString(),
      name: newProduct.name,
      qty: parseInt(newProduct.qty) || 1,
      price: parseInt(newProduct.price.replace(/\D/g, '')) || 0,
    }]);
    setNewProduct({ name: '', qty: '1', price: '' });
    setShowAddProduct(false);
  };


  const removeProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const totalAmount = products.reduce((sum, p) => sum + p.price * p.qty, 0);

  const formatCurrency = (n) =>
    n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  const handleSubmit =  async () => {
    if (!selectedCustomer) { Alert.alert('Thông báo', 'Vui lòng chọn khách hàng'); return; }
    if (products.length === 0) { Alert.alert('Thông báo', 'Vui lòng thêm ít nhất 1 sản phẩm'); return; }

    const newOrder = {
        id: orderId,
        customer:selectedCustomer.name,
        items:products,
        createdAt:orderDate,
        address:deliveryAddress,
        note:notes,
        status:'PENDING'
    }

    await setDoc(doc(db,'orders',selectedCustomer.name),
    arrayUnion(newOrder))

    Alert.alert('Thành công', `Đơn hàng ${orderId} đã được tạo!`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F2C" />

      {/* Header */}
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
              <Text style={styles.inputLabel}>Order Date</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="#B0B0C8"
                  value={orderDate}
                  onChangeText={setOrderDate}
                  keyboardType="numbers-and-punctuation"
                />
                <Ionicons name="calendar-outline" size={18} color="#B0B0C8" />
              </View>
            </View>

            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Customer Name</Text>
              <TouchableOpacity
                style={styles.inputBox}
                onPress={() => setShowCustomerPicker(!showCustomerPicker)}
                activeOpacity={0.8}
              >
                <Text style={selectedCustomer ? styles.input : styles.inputPlaceholder}>
                  {selectedCustomer ? selectedCustomer.name : 'Select an existing customer'}
                </Text>
                <Ionicons
                  name={showCustomerPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#B0B0C8"
                />
              </TouchableOpacity>

              {showCustomerPicker && (
                <View style={styles.dropdown}>
                  {customerList.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>Chưa có khách hàng nào</Text>
                  ) : (
                    customerList.map((c, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.dropdownItem, selectedCustomer?.name === c.name && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedCustomer(c);
                          setDeliveryAddress(c.address || '');
                          setShowCustomerPicker(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, selectedCustomer?.name === c.name && styles.dropdownItemTextActive]}>
                          {c.name}
                        </Text>
                        {selectedCustomer?.name === c.name && (
                          <Ionicons name="checkmark" size={16} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

           
            <View style={styles.productSection}>
              <View style={styles.productHeader}>
                <Ionicons name="cube-outline" size={18} color="#fff" />
                <Text style={styles.productHeaderText}>Product Information</Text>
              </View>

             
              {products.map((p) => (
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

             
              {showAddProduct && (
                <View style={styles.addProductForm}>
                  <TextInput
                    style={styles.addProductInput}
                    placeholder="Tên sản phẩm"
                    placeholderTextColor="#B0B0C8"
                    value={newProduct.name}
                    onChangeText={v => setNewProduct(p => ({ ...p, name: v }))}
                  />
                  <View style={styles.addProductRow}>
                    <TextInput
                      style={[styles.addProductInput, { flex: 1, marginRight: 8 }]}
                      placeholder="Số lượng"
                      placeholderTextColor="#B0B0C8"
                      keyboardType="numeric"
                      value={newProduct.qty}
                      onChangeText={v => setNewProduct(p => ({ ...p, qty: v }))}
                    />
                    <TextInput
                      style={[styles.addProductInput, { flex: 2 }]}
                      placeholder="Đơn giá (VND)"
                      placeholderTextColor="#B0B0C8"
                      keyboardType="numeric"
                      value={newProduct.price}
                      onChangeText={v => setNewProduct(p => ({ ...p, price: v }))}
                    />
                  </View>
                  <View style={styles.addProductActions}>
                    <TouchableOpacity style={styles.addProductCancel} onPress={() => setShowAddProduct(false)}>
                      <Text style={styles.addProductCancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addProductConfirm} onPress={addProduct}>
                      <Text style={styles.addProductConfirmText}>Thêm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

          
              <TouchableOpacity
                style={styles.addProductBtn}
                onPress={() => setShowAddProduct(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#2563EB" />
                <Text style={styles.addProductBtnText}>Thêm sản phẩm</Text>
              </TouchableOpacity>

            
              {products.length > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tổng cộng</Text>
                  <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
                </View>
              )}
            </View>

      
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Full shipping address..."
                  placeholderTextColor="#B0B0C8"
                  multiline
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                />
              </View>
            </View>

        
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Internal Notes (Optional)</Text>
              <View style={[styles.inputBox, styles.textAreaBox]}>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Special handling instructions..."
                  placeholderTextColor="#B0B0C8"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>

      
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Tạo đơn hàng</Text>
            </TouchableOpacity>

          </View>


          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F2C',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  scroll: {
    paddingBottom: 24,
  },

  // Hero
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroLabel: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -0.5,
  },

  // Form Card
  formCard: {
    backgroundColor: '#F8F9FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },

  // Input
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  textAreaBox: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  inputReadonly: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#B0B0C8',
  },

  // Dropdown
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dropdownEmpty: {
    padding: 14,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Product Section
  productSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  productHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  productItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  productItemMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  productItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  productItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  addProductForm: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  addProductInput: {
    backgroundColor: '#F8F9FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addProductRow: {
    flexDirection: 'row',
  },
  addProductActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addProductCancel: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  addProductCancelText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 13,
  },
  addProductConfirm: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  addProductConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    margin: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  addProductBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E3A8A',
  },

  // Submit
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Footer Banner
  footerBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#1E3A8A',
    padding: 20,
    overflow: 'hidden',
    alignItems: 'center',
  },
  footerBannerOverlay: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  footerBannerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});