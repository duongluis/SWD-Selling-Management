import BgWatermark from '@/components/Main/BgWatermark';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HelpButton from '../../components/Help/HelpButton';
import {
  ORDER_TYPE_TO_CATEGORY,
  SERVICE_TYPE_TO_CATEGORY,
  fetchStatusList,
} from '../../components/Hooks/getStatus';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { useLayout } from '../../components/Main/TabScreenLayout';
import { db } from '../../config/firebaseConfig';


const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

const PRICE_FIELD_TO_LABEL = {
  'price': 'Giá niêm yết',
  'price_a': 'Giá đại lý',
  'price_p': 'Giá đối tác',
  'price_c': 'Giá CTV',
};

// ── Date helpers ─────────────────────────────────────────────
const toDateStr = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const toDisplayStr = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

// ── Role helpers ─────────────────────────────────────────────
const getRole = (u) => {
  const r = (u?.role || u?.member || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
  if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
  if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
  return 'other';
};
const getRolePriceField = (role) => ({ daily: 'price_a', phantan: 'price_p', ctv: 'price_c' }[role] || 'price');
const ROLE_LABEL = { admin: 'Giá niêm yết', daily: 'Giá đại lý', phantan: 'Giá đối tác', ctv: 'Giá CTV', other: 'Giá niêm yết' };

// ── Order type config ─────────────────────────────────────────
const ORDER_TYPES = {
  buon: {
    key: 'buon', label: 'Đơn buôn', desc: 'Giao hàng số lượng lớn', icon: 'car-outline',
    color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0',
    autoSvc: 'DELIVERY', svcLabel: 'Giao hàng', svcIcon: 'car-outline', svcColor: '#10B981', svcBg: '#ECFDF5',
  },
  le: {
    key: 'le', label: 'Đơn lẻ', desc: 'Lắp đặt tại địa điểm', icon: 'build-outline',
    color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',
    autoSvc: 'INSTALLATION', svcLabel: 'Lắp đặt', svcIcon: 'build-outline', svcColor: '#8B5CF6', svcBg: '#F5F3FF',
  },
};

// const ROLE_ORDER_TYPE = { daily: 'buon', phantan: 'le', ctv: 'le', admin: null, other: null };
const ROLE_ORDER_TYPE = { daily: null, phantan: null, ctv: null, admin: null, other: null };


const PAYMENT_OPTIONS = [
  { key: 'customer', label: 'Khách hàng thanh toán', icon: 'person-outline', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'company', label: 'Người bán thanh toán', icon: 'business-outline', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
];

// ── DateField ─────────────────────────────────────────────────
const DateField = React.memo(({ orderDate, setOrderDate, selectedDate, setSelectedDate, showDatePicker, setShowDatePicker }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = today;
  const { isDesktop } = useLayout();
  const onChange = (_, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date && date >= minDate) {
      setSelectedDate(date);
      setOrderDate(toDateStr(date));
    } else if (date && date < minDate) {
      showAlert('Ngày không hợp lệ', 'Không thể chọn ngày trong quá khứ');
    }
  };

  return isDesktop ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
      {/* lang="sv-SE" ép thứ tự nhập yyyy/mm/dd (năm trước) thay vì dd/mm/yyyy theo locale máy,
          tránh lỗi "ngày quá khứ" khi năm mới gõ 1-2 chữ số cuối cùng */}
      <input
        type="date"
        lang="sv-SE"
        value={orderDate || ''}
        min={toDateStr(minDate)}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', fontWeight: '500', cursor: 'pointer', width: '100%' }}
        onChange={e => {
          if (!e.target.value) return;
          const selected = new Date(e.target.value);
          if (selected >= minDate) { setOrderDate(e.target.value); setSelectedDate(selected); }
          else showAlert('Ngày không hợp lệ', 'Không thể chọn ngày trong quá khứ');
        }}
      />
      <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
    </View>
  ) :

    (
      <>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' }} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
          <Text style={{ flex: 1, fontSize: 14, color: orderDate ? '#1A1A2E' : '#B0B0C8' }}>{orderDate ? toDisplayStr(orderDate) : 'Chọn ngày giao hàng...'}</Text>
          <Ionicons name="calendar-outline" size={18} color="#B0B0C8" />
        </TouchableOpacity>
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowDatePicker(false)} />
            <View style={{ backgroundColor: '#fff', padding: 16 }}>
              <DateTimePicker value={selectedDate} mode="date" display="spinner" onChange={onChange} minimumDate={minDate} />
              <Pressable onPress={() => setShowDatePicker(false)} style={{ alignItems: 'center', padding: 12 }}><Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text></Pressable>
            </View>
          </Modal>
        )}
        {showDatePicker && Platform.OS === 'android' && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onChange} minimumDate={minDate} />}
      </>
    );
});
DateField.displayName = 'DateField';

// ── ProductDropdown ───────────────────────────────────────────
const ProductDropdown = React.memo(({ catalog, onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = catalog.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));
  return (
    <View style={PD.wrap}>
      <View style={PD.searchRow}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput style={PD.searchInput} placeholder="Tìm sản phẩm..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} autoFocus />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={14} color="#94A3B8" /></TouchableOpacity>}
      </View>
      <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
        {filtered.length === 0
          ? <Text style={PD.empty}>Không tìm thấy</Text>
          : filtered.map(item => (
            <TouchableOpacity key={String(item.id || item.docId)} style={PD.item} onPress={() => onSelect(item)} activeOpacity={0.7}>
              <View style={PD.icon}><Ionicons name="water-outline" size={13} color="#2563EB" /></View>
              <Text style={PD.name} numberOfLines={1}>{item.name}</Text>
              <Text style={PD.cap}>{item.capacity || ''}</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View >
  );
});
ProductDropdown.displayName = 'ProductDropdown';
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

// ── OrderTypeField ────────────────────────────────────────────
const OrderTypeField = React.memo(({ ws, orderType, lockedType, setOrderType }) => {
  const cfg = ORDER_TYPES[orderType];
  if (lockedType) {
    return (
      <View style={[ws ? W.orderTypeLocked : styles.orderTypeLocked, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
        <Text style={[ws ? W.orderTypeLockedText : styles.orderTypeLockedText, { color: cfg.color }]}>{cfg.label}</Text>
        {/* <Text style={ws ? W.orderTypeLockedDesc : styles.orderTypeLockedDesc}>· {cfg.desc}</Text> */}
        <View style={ws ? W.orderTypeLockIcon : styles.orderTypeLockIcon}>
          <Ionicons name="lock-closed-outline" size={11} color={cfg.color} />
        </View>
      </View>
    );
  }
  return (
    <View style={ws ? W.orderTypeRow : styles.orderTypeRow}>
      {Object.values(ORDER_TYPES).map(t => {
        const active = orderType === t.key;
        return (
          <TouchableOpacity key={t.key}
            style={[ws ? W.orderTypeBtn : styles.orderTypeBtn, { borderColor: active ? t.color : '#E2E8F0' }, active && { backgroundColor: t.bg }]}
            onPress={() => setOrderType(t.key)} activeOpacity={0.8}
          >
            <Ionicons name={t.icon} size={ws ? 16 : 15} color={active ? t.color : '#94A3B8'} />
            <View style={{ flex: 1 }}>
              <Text style={[ws ? W.orderTypeBtnLabel : styles.orderTypeBtnLabel, active && { color: t.color }]}>{t.label}</Text>
              <Text style={ws ? W.orderTypeBtnDesc : styles.orderTypeBtnDesc}>{t.desc}</Text>
            </View>
            {active && <View style={[ws ? W.orderTypeCheck : styles.orderTypeCheck, { backgroundColor: t.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
OrderTypeField.displayName = 'OrderTypeField';

// ── CustomerPickerDropdown ────────────────────────────────────
const CustomerPickerDropdown = React.memo(({ ws, customerList, customerLoading, customerSearch, setCustomerSearch, selectedCustomer, setSelectedCustomer, setDeliveryAddress, setShowCustomerPicker, emptyLabel = 'Chưa có khách hàng' }) => {
  const filteredCustomers = customerSearch.trim() === ''
    ? customerList
    : customerList.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch));

  return (
    <View style={ws ? W.dropdown : styles.dropdown}>
      <View style={ws ? W.dropdownSearch : styles.dropdownSearch}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput
          style={ws ? W.dropdownSearchInput : styles.dropdownSearchInput}
          placeholder="Tìm tên hoặc SĐT..."
          placeholderTextColor="#94A3B8"
          value={customerSearch}
          onChangeText={setCustomerSearch}
        />
        {customerSearch.length > 0 && <TouchableOpacity onPress={() => setCustomerSearch('')}><Ionicons name="close-circle" size={14} color="#94A3B8" /></TouchableOpacity>}
      </View>
      {customerLoading
        ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>Đang tải...</Text>
        : filteredCustomers.length === 0
          ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>{customerSearch ? 'Không tìm thấy' : emptyLabel}</Text>
          : <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
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
    </View >
  );
});
CustomerPickerDropdown.displayName = 'CustomerPickerDropdown';

// ── AssistedPartnerDropdown ───────────────────────────────────
// Danh sách Đối tác (phantan) / Đại lý (daily) để admin chọn "Người được hỗ trợ" khi tạo đơn hộ
const AssistedPartnerDropdown = React.memo(({ ws, partnerList, partnerLoading, partnerSearch, setPartnerSearch, selectedPartner, setSelectedPartner, setShowPartnerPicker }) => {
  const filteredPartners = partnerSearch.trim() === ''
    ? partnerList
    : partnerList.filter(p =>
      (p.name || '').toLowerCase().includes(partnerSearch.toLowerCase()) ||
      (p.phone || '').includes(partnerSearch) ||
      (p.email || '').toLowerCase().includes(partnerSearch.toLowerCase())
    );

  return (
    <View style={ws ? W.dropdown : styles.dropdown}>
      <View style={ws ? W.dropdownSearch : styles.dropdownSearch}>
        <Ionicons name="search-outline" size={14} color="#94A3B8" />
        <TextInput
          style={ws ? W.dropdownSearchInput : styles.dropdownSearchInput}
          placeholder="Tìm tên, SĐT hoặc email..."
          placeholderTextColor="#94A3B8"
          value={partnerSearch}
          onChangeText={setPartnerSearch}
        />
        {partnerSearch.length > 0 && <TouchableOpacity onPress={() => setPartnerSearch('')}><Ionicons name="close-circle" size={14} color="#94A3B8" /></TouchableOpacity>}
      </View>
      {partnerLoading
        ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>Đang tải...</Text>
        : filteredPartners.length === 0
          ? <Text style={ws ? W.dropdownEmpty : styles.dropdownEmpty}>{partnerSearch ? 'Không tìm thấy' : 'Chưa có đối tác/đại lý nào'}</Text>
          : <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
            {filteredPartners.map((p, i) => (
              <TouchableOpacity key={p.docId || i}
                style={[ws ? W.dropdownItem : styles.dropdownItem, selectedPartner?.docId === p.docId && (ws ? W.dropdownItemActive : styles.dropdownItemActive)]}
                onPress={() => { setSelectedPartner(p); setShowPartnerPicker(false); setPartnerSearch(''); }}
              >
                {ws && <View style={W.dropdownAvatar}><Text style={W.dropdownAvatarText}>{(p.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={[ws ? W.dropdownItemText : styles.dropdownItemText, selectedPartner?.docId === p.docId && (ws ? W.dropdownItemTextActive : styles.dropdownItemTextActive)]}>{p.name || p.email}</Text>
                  <Text style={ws ? W.dropdownItemSub : styles.dropdownItemSub}>{p.phone || p.email} · {getRole(p) === 'daily' ? 'Đại lý' : 'Đối tác'}</Text>
                </View>
                {selectedPartner?.docId === p.docId && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
      }
    </View>
  );
});
AssistedPartnerDropdown.displayName = 'AssistedPartnerDropdown';

// ── AddProductForm ────────────────────────────────────────────
const AddProductForm = React.memo(({ ws, orderType, catalog, priceField, priceLabel, newProduct, setNewProduct, showProductDrop, setShowProductDrop, onAdd, onCancel }) => {
  const handleSelectProduct = useCallback((p) => {
    setNewProduct({
      name: p.name,
      qty: '1',
      price: String(p[priceField] || p.price || 0),
      basePrice: p.price || 0,
      price_a: p.price_a || 0,   // ← thêm
      price_p: p.price_p || 0,   // ← thêm
      price_c: p.price_c || 0,   // ← thêm
      productId: String(p.id || p.docId),
    });
    setShowProductDrop(false);
  }, [priceField, setNewProduct, setShowProductDrop]);

  return (
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
        <TextInput
          style={[ws ? W.addInput : styles.addProductInput, { flex: 1, marginRight: 8 }]}
          placeholder="Số lượng"
          placeholderTextColor="#B0B0C8"
          keyboardType="numeric"
          value={newProduct.qty}
          onChangeText={v => setNewProduct(p => ({ ...p, qty: v }))}
        />
        {orderType === 'le' ? (
          <View style={[ws ? W.addInput : styles.addProductInput, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Ionicons name="create-outline" size={13} color="#2563EB" />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' }}
              placeholder={newProduct.basePrice ? fmt(newProduct.basePrice) : priceLabel}
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={newProduct.price}
              onChangeText={v => setNewProduct(p => ({ ...p, price: v.replace(/\D/g, '') }))}
            />
          </View>
        ) : (
          <View style={[ws ? W.addInput : styles.addProductInput, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
            <Text style={{ flex: 1, fontSize: 14, color: newProduct.price ? '#0F172A' : '#94A3B8' }}>{newProduct.price ? fmt(parseInt(newProduct.price)) : priceLabel}</Text>
          </View>
        )}
      </View>
      <View style={ws ? W.addActions : styles.addProductActions}>
        <TouchableOpacity style={ws ? W.addCancel : styles.addProductCancel} onPress={onCancel}>
          <Text style={ws ? W.addCancelText : styles.addProductCancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ws ? W.addConfirm : styles.addProductConfirm} onPress={onAdd}>
          <Text style={ws ? W.addConfirmText : styles.addProductConfirmText}>Thêm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
AddProductForm.displayName = 'AddProductForm';

// ── ServiceList ───────────────────────────────────────────────
const ServiceList = React.memo(({ ws, serviceTypesList = [], selectedServices, setSelectedServices, serviceNote, onServiceNoteChange, orderType, deliveryAddress, onAddressChange }) => {

  // useCallback phải gọi trước mọi return sớm (serviceTypesList rỗng lúc đầu rồi mới có
  // dữ liệu từ Firestore) để không lệch số lượng hook giữa các lần render
  const toggleService = useCallback((svcType) => {
    setSelectedServices(prev =>
      prev.includes(svcType) ? prev.filter(t => t !== svcType) : [...prev, svcType]
    );
  }, [setSelectedServices]);

  if (!serviceTypesList || serviceTypesList.length === 0) return null;

  return (
    <View style={ws ? W.autoSvcCard : styles.autoSvcCard}>
      <Text style={[ws ? W.cardTitle : styles.sectionTitle, { marginBottom: 12 }]}>Dịch vụ tự động tạo</Text>
      {serviceTypesList.map(svc => {
        const isSelected = selectedServices.includes(svc.type);
        const isDelivery = svc.name?.toLowerCase().includes('giao hàng');
        const orderKey = isDelivery ? 'buon'
          : svc.name?.toLowerCase().includes('lắp đặt') ? 'le'
            : null;
        const cfg = orderKey ? ORDER_TYPES[orderKey] : {};
        return (
          <React.Fragment key={svc.type}>
            <TouchableOpacity style={[ws ? W.serviceRow : styles.serviceRow]} onPress={() => toggleService(svc.type)} activeOpacity={0.8}>
              <View style={[ws ? W.serviceIcon : styles.serviceIcon, { backgroundColor: isSelected ? cfg.svcBg || '#EFF6FF' : '#F1F5F9' }]}>
                <Ionicons name={cfg.svcIcon || 'construct-outline'} size={18} color={isSelected ? cfg.svcColor || '#2563EB' : '#94A3B8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ws ? W.serviceName : styles.serviceName]}>{svc.name || svc.type}</Text>
                {svc.description && <Text style={[ws ? W.serviceDesc : styles.serviceDesc]}>{svc.description}</Text>}
              </View>
              <View style={[ws ? W.toggleSwitch : styles.toggleSwitch, isSelected && (ws ? W.toggleOn : styles.toggleOn)]}>
                <View style={[ws ? W.toggleThumb : styles.toggleThumb, isSelected && (ws ? W.toggleThumbOn : styles.toggleThumbOn)]} />
              </View>
            </TouchableOpacity>
            {isDelivery && isSelected && (
              <View style={[ws ? W.inputGroup : styles.inputGroup, { marginTop: -4, marginBottom: 12 }]}>
                <Text style={ws ? W.svcLabel : styles.svcLabel}>Địa chỉ giao hàng</Text>
                <View style={ws ? W.inputBox : styles.inputBox}>
                  <TextInput
                    style={ws ? W.input : styles.input}
                    placeholder="Nhập địa chỉ giao hàng..."
                    placeholderTextColor="#94A3B8"
                    value={deliveryAddress}
                    onChangeText={onAddressChange}
                  />
                </View>
              </View>
            )}
          </React.Fragment>
        );
      })}
      <Text style={[ws ? W.svcLabel : styles.svcLabel, { marginTop: 12 }]}>Ghi chú cho các dịch vụ</Text>
      <View style={[ws ? W.inputBox : styles.svcNoteBox, { alignItems: 'flex-start', minHeight: 60 }]}>
        <TextInput
          style={{ flex: 1, fontSize: 13, color: '#0F172A', textAlignVertical: 'top', ...(ws ? { fontWeight: '500' } : {}) }}
          placeholder="Yêu cầu đặc biệt cho dịch vụ..."
          placeholderTextColor="#94A3B8"
          multiline
          value={serviceNote}
          onChangeText={onServiceNoteChange}
        />
      </View>
    </View>
  );
});
ServiceList.displayName = 'ServiceList';

// ── PaymentMethodField ────────────────────────────────────────
const PaymentMethodField = React.memo(({ ws, orderType, useFixedPrice, fixedPayment, paymentMethod, setPaymentMethod }) => {
  if (useFixedPrice) {
    const cfg = PAYMENT_OPTIONS.find(o => o.key === fixedPayment);
    return (
      <View style={ws ? W.pmCard : styles.pmCard}>
        <View style={ws ? W.pmHeader : styles.pmHeader}>
          <View style={ws ? W.pmHeaderIcon : styles.pmHeaderIcon}><Ionicons name="card-outline" size={14} color="#2563EB" /></View>
          <Text style={ws ? W.pmTitle : styles.pmTitle}>Hình thức thanh toán</Text>
          <View style={styles.pmLockBadge}>
            <Ionicons name="lock-closed-outline" size={10} color="#2563EB" />
            <Text style={styles.pmLockText}>Cố định</Text>
          </View>
        </View>
        <View style={[ws ? W.pmOption : styles.pmOption, { borderColor: cfg.color, backgroundColor: cfg.bg }]}>
          <View style={[ws ? W.pmOptionIcon : styles.pmOptionIcon, { backgroundColor: cfg.color + '22' }]}><Ionicons name={cfg.icon} size={15} color={cfg.color} /></View>
          <View style={{ flex: 1 }}><Text style={[ws ? W.pmOptionLabel : styles.pmOptionLabel, { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text></View>
          <View style={[ws ? W.pmCheck : styles.pmCheck, { backgroundColor: cfg.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>
        </View>
      </View>
    );
  }

  if (orderType === 'buon') {
    const cfg = PAYMENT_OPTIONS.find(o => o.key === 'company');
    return (
      <View style={ws ? W.pmCard : styles.pmCard}>
        <View style={ws ? W.pmHeader : styles.pmHeader}>
          <View style={ws ? W.pmHeaderIcon : styles.pmHeaderIcon}><Ionicons name="card-outline" size={14} color="#8B5CF6" /></View>
          <Text style={ws ? W.pmTitle : styles.pmTitle}>Hình thức thanh toán</Text>
          <View style={styles.pmLockBadge}>
            <Ionicons name="lock-closed-outline" size={10} color="#8B5CF6" />
            <Text style={styles.pmLockText}>Cố định</Text>
          </View>
        </View>
        <View style={[ws ? W.pmOption : styles.pmOption, { borderColor: cfg.color, backgroundColor: cfg.bg }]}>
          <View style={[ws ? W.pmOptionIcon : styles.pmOptionIcon, { backgroundColor: cfg.color + '22' }]}><Ionicons name={cfg.icon} size={15} color={cfg.color} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[ws ? W.pmOptionLabel : styles.pmOptionLabel, { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
          </View>
          <View style={[ws ? W.pmCheck : styles.pmCheck, { backgroundColor: cfg.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>
        </View>
      </View>
    );
  }

  return (
    <View style={ws ? W.pmCard : styles.pmCard}>
      <View style={ws ? W.pmHeader : styles.pmHeader}>
        <View style={ws ? W.pmHeaderIcon : styles.pmHeaderIcon}><Ionicons name="card-outline" size={14} color="#2563EB" /></View>
        <Text style={ws ? W.pmTitle : styles.pmTitle}>Hình thức thanh toán</Text>
      </View>
      <View style={ws ? W.pmOptions : styles.pmOptions}>
        {PAYMENT_OPTIONS.map(opt => {
          const active = paymentMethod === opt.key;
          return (
            <TouchableOpacity key={opt.key}
              style={[ws ? W.pmOption : styles.pmOption, { borderColor: active ? opt.color : '#E2E8F0' }, active && { backgroundColor: opt.bg }]}
              onPress={() => setPaymentMethod(opt.key)} activeOpacity={0.8}
            >
              <View style={[ws ? W.pmOptionIcon : styles.pmOptionIcon, { backgroundColor: active ? opt.color + '22' : '#F1F5F9' }]}><Ionicons name={opt.icon} size={15} color={active ? opt.color : '#94A3B8'} /></View>
              <Text style={[ws ? W.pmOptionLabel : styles.pmOptionLabel, active && { color: opt.color, fontWeight: '700' }]}>{opt.label}</Text>
              {active && <View style={[ws ? W.pmCheck : styles.pmCheck, { backgroundColor: opt.color }]}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});
PaymentMethodField.displayName = 'PaymentMethodField';

// ── Main ─────────────────────────────────────────────────────
export default function AddOrder() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const { isDesktop } = useLayout();

  // --- 1. ĐƯA TẤT CẢ STATE LÊN ĐẦU ĐỂ TRÁNH LỖI INITIALIZATION ---
  const [serviceTypesList, setServiceTypesList] = useState([]); // Chuyển lên đầu
  const [orderType, setOrderType] = useState(ROLE_ORDER_TYPE[role] || 'le');
  const [selectedServices, setSelectedServices] = useState([]);
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
  const [customerList, setCustomerList] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [resolvedPriceField, setResolvedPriceField] = useState(getRolePriceField(role));

  // "Người được hỗ trợ" — chỉ admin dùng để tạo đơn hộ Đối tác (xem handleSubmit)
  const [assistedPartnerList, setAssistedPartnerList] = useState([]);
  const [assistedPartnerLoading, setAssistedPartnerLoading] = useState(false);
  const [selectedAssistedPartner, setSelectedAssistedPartner] = useState(null);
  const [showAssistedPicker, setShowAssistedPicker] = useState(false);
  const [assistedSearch, setAssistedSearch] = useState('');

  // --- 2. CÁC BIẾN TÍNH TOÁN (DÙNG STATE ĐÃ KHAI BÁO) ---
  const [orderId] = useState('ORD-' + Date.now().toString().slice(-6));
  // Admin tạo đơn hộ → toàn bộ quy tắc giá & hình thức thanh toán phải tính theo
  // người được hỗ trợ, không theo admin. Nếu bỏ trống thì giữ nguyên như cũ.
  const assistedUser = (role === 'admin' && selectedAssistedPartner) ? selectedAssistedPartner : null;
  const effectiveUser = assistedUser || userDetail;
  const effectiveRole = assistedUser ? getRole(assistedUser) : role;

  const hasAdvisor = !!effectiveUser?.advisor;
  const isDaily = effectiveRole === 'daily';
  const isLevel1 = !effectiveUser?.advisor;
  const useFixedPrice = isDaily || !isLevel1;
  const fixedPayment = 'company';

  const [paymentMethod, setPaymentMethod] = useState(orderType === 'buon' ? 'company' : 'customer');

  const filteredServiceTypes = React.useMemo(() => {
    return (serviceTypesList || []).filter(svc => {
      if (orderType === 'buon') {
        return svc.name?.toLowerCase().includes('giao hàng');
      }
      return true;
    });
  }, [serviceTypesList, orderType]);

  const effectivePaymentMethod = useFixedPrice ? fixedPayment : paymentMethod;
  // Giá bán chịu 2 yếu tố:
  //  1. Hình thức thanh toán — khách hàng tự thanh toán thì bán theo giá niêm yết
  //     (phần chênh với giá vai trò chính là hoa hồng, xem commissionCalc.calcCommission).
  //  2. Vai trò người tạo đơn / người được hỗ trợ — người bán thanh toán thì lấy
  //     giá vai trò (resolvedPriceField: giá đại lý/đối tác/CTV, hoặc của advisor cấp 1).
  const priceField = effectivePaymentMethod === 'customer' ? 'price' : resolvedPriceField;
  const priceLabel = effectivePaymentMethod === 'customer' ? 'Giá sản phẩm' : 'Giá sản phẩm';
  // ? 'Giá sản phẩm'
  // : PRICE_FIELD_TO_LABEL[resolvedPriceField] ?? 'Giá niêm yết';

  const lockedType = ROLE_ORDER_TYPE[role] !== null;
  const handleSetOrderType = useCallback((type) => {
    const nextPayment = type === 'buon' ? 'company' : 'customer';
    const apply = () => {
      setOrderType(type);
      setPaymentMethod(nextPayment);
      setSelectedServices([]);
    };
    // Đổi loại đơn kéo theo đổi hình thức thanh toán → đổi bảng giá. Sản phẩm đã thêm
    // vẫn giữ giá cũ nên phải thêm lại, nếu không hoa hồng sẽ lệch.
    if (products.length > 0 && nextPayment !== paymentMethod) {
      showAlert(
        'Đổi loại đơn hàng',
        'Hình thức thanh toán và giá sản phẩm sẽ thay đổi. Vui lòng thêm lại sản phẩm.',
        () => { setProducts([]); apply(); }
      );
      return;
    }
    apply();
  }, [products.length, paymentMethod]);

  const calculateHierarchy = async (userEmail, userDetail) => {
    let rootAdvisor = userEmail;
    let level = 1;
    let currentUser = userDetail;

    while (currentUser?.advisor) {
      level++;
      rootAdvisor = currentUser.advisor;
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.advisor));
        if (userSnap.exists()) {
          currentUser = userSnap.data();
        } else {
          break;
        }
      } catch (err) {
        break;
      }
    }
    return { rootAdvisor, level };
  };

  const totalAmount = useMemo(() =>
    products.reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0)
    , [products]);

  // Thêm sản phẩm
  const addProduct = useCallback(() => {
    if (!newProduct.name || !newProduct.price) {
      showAlert('Thông báo', 'Vui lòng chọn sản phẩm và nhập giá');
      return;
    }
    setProducts(prev => [...prev, {
      ...newProduct,
      id: Date.now().toString(),
      qty: parseInt(newProduct.qty) || 1,
      price: parseInt(newProduct.price) || 0,
    }]);
    setShowAddProduct(false);
    setNewProduct({ name: '', qty: '1', price: '', productId: '' });
  }, [newProduct]);

  // Xóa sản phẩm
  const removeProduct = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // Form "Thêm sản phẩm" đang mở mà bảng giá đổi (đổi hình thức thanh toán / người được
  // hỗ trợ / loại đơn) → sản phẩm đang chọn vẫn giữ giá cũ và sẽ được thêm vào với giá sai.
  // Các handler chỉ xoá `products` nên không chạm tới được, phải tự tính lại ở đây.
  useEffect(() => {
    if (!newProduct.productId) return;
    const p = catalog.find(c => String(c.id || c.docId) === newProduct.productId);
    if (!p) return;
    const nextPrice = String(p[priceField] || p.price || 0);
    setNewProduct(prev => (prev.price === nextPrice ? prev : { ...prev, price: nextPrice }));
  }, [priceField, catalog, newProduct.productId]);

  // --- 3. CÁC CƠ CHẾ XỬ LÝ (SUBMIT, FETCH...) ---
  const handleSetCustomerSearch = useCallback((v) => setCustomerSearch(v), []);
  const handleSetDeliveryAddress = useCallback((v) => setDeliveryAddress(v), []);
  const handleSetShowCustomerPicker = useCallback((v) => setShowCustomerPicker(v), []);
  const handleAddressChange = useCallback((v) => setDeliveryAddress(v), []);
  const handleNotesChange = useCallback((v) => setNotes(v), []);
  const handleSetNewProduct = useCallback((v) => setNewProduct(v), []);
  const handleSetShowProductDrop = useCallback((v) => setShowProductDrop(v), []);
  const handleCancelAddProduct = useCallback(() => { setShowAddProduct(false); setNewProduct({ name: '', qty: '1', price: '', productId: '' }); }, []);
  const handleServiceNoteChange = useCallback((v) => setServiceNote(v), []);
  const handleSetAssistedSearch = useCallback((v) => setAssistedSearch(v), []);
  const handleSetShowAssistedPicker = useCallback((v) => setShowAssistedPicker(v), []);

  // Email định danh của 1 user doc — docId của collection 'users' chính là email
  const emailOf = (u) => (u ? (u.email || u.docId || '') : '');
  const assistedEmail = emailOf(selectedAssistedPartner);

  // Đã chọn người được hỗ trợ → chỉ cho chọn khách hàng do chính họ tạo,
  // tránh gán đơn của đối tác này lên khách của đối tác khác.
  const visibleCustomerList = useMemo(() => {
    if (role !== 'admin' || !assistedEmail) return customerList;
    return customerList.filter(c => c.createdBy === assistedEmail);
  }, [customerList, role, assistedEmail]);

  const customerEmptyLabel = assistedEmail
    ? `${selectedAssistedPartner?.name || assistedEmail} chưa có khách hàng nào`
    : 'Chưa có khách hàng';

  // Đổi người được hỗ trợ = đổi bảng giá gốc → sản phẩm đã thêm sẽ giữ giá cũ
  // và làm sai chênh lệch hoa hồng. Buộc thêm lại sản phẩm giống khi đổi thanh toán.
  const handleSetSelectedAssistedPartner = useCallback((p) => {
    // Bỏ trống người được hỗ trợ = đơn thuộc về chính admin
    const nextOwner = emailOf(p) || userDetail?.email || '';
    // Khách đang chọn không thuộc chủ đơn mới → bỏ chọn để chọn lại, nếu không
    // createdBy sẽ trỏ về người này trong khi giá lại tính theo người kia.
    const customerMismatch = !!selectedCustomer && selectedCustomer.createdBy !== nextOwner;

    const apply = () => {
      setSelectedAssistedPartner(p);
      if (customerMismatch) { setSelectedCustomer(null); setDeliveryAddress(''); }
    };

    if (products.length > 0) {
      showAlert(
        'Đổi người được hỗ trợ',
        'Giá sản phẩm sẽ đổi theo bảng giá của người được hỗ trợ. Vui lòng thêm lại sản phẩm.',
        () => { setProducts([]); apply(); }
      );
      return;
    }
    apply();
  }, [products.length, selectedCustomer, userDetail?.email]);

  // Chọn khách hàng trước → tự điền người được hỗ trợ là người đã tạo khách hàng đó
  // (chỉ khi người tạo nằm trong danh sách Đối tác/Đại lý).
  const handleSetSelectedCustomer = useCallback((c) => {
    setSelectedCustomer(c);
    if (role !== 'admin' || !c?.createdBy) return;

    const creator = assistedPartnerList.find(p => emailOf(p) === c.createdBy);
    if (!creator || emailOf(creator) === assistedEmail) return;

    if (products.length > 0) {
      showAlert(
        'Cập nhật người được hỗ trợ',
        `Khách hàng này do ${creator.name || creator.email} tạo. Giá sản phẩm sẽ đổi theo bảng giá của họ, vui lòng thêm lại sản phẩm.`,
        () => { setProducts([]); setSelectedAssistedPartner(creator); }
      );
      return;
    }
    setSelectedAssistedPartner(creator);
  }, [role, assistedPartnerList, assistedEmail, products.length]);

  const handleSetPaymentMethod = useCallback((method) => {
    if (products.length > 0) {
      showAlert(
        'Thay đổi hình thức thanh toán',
        'Giá sản phẩm sẽ thay đổi. Vui lòng thêm lại sản phẩm.',
        () => { setProducts([]); setPaymentMethod(method); }
      );
      return;
    }
    setPaymentMethod(method);
  }, [products.length]);


  // ── Fetch customers ──────────────────────────────────────────
  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomerLoading(true);
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');

        let allCustomers = [];

        if (role === 'admin') {
          // Admin: lấy tất cả
          const snap = await getDocs(collection(db, 'customers'));
          allCustomers = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

        } else {
          // Bước 1: luôn lấy khách hàng của chính mình
          const mySnap = await getDocs(
            query(collection(db, 'customers'), where('createdBy', '==', userDetail.email))
          );
          allCustomers = mySnap.docs.map(d => ({ docId: d.id, ...d.data() }));

          // Bước 2: kiểm tra xem mình có phải advisor của ai không
          const subordinateSnap = await getDocs(
            query(collection(db, 'users'), where('advisor', '==', userDetail.email))
          );

          if (!subordinateSnap.empty) {
            // Có cấp dưới → lấy email của tất cả cấp dưới
            const subordinateEmails = subordinateSnap.docs.map(d => d.data().email).filter(Boolean);

            // Firestore 'in' giới hạn 10 phần tử mỗi query → chia batch
            const BATCH_SIZE = 10;
            for (let i = 0; i < subordinateEmails.length; i += BATCH_SIZE) {
              const batch = subordinateEmails.slice(i, i + BATCH_SIZE);
              const subSnap = await getDocs(
                query(collection(db, 'customers'), where('createdBy', 'in', batch))
              );
              const subCustomers = subSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
              allCustomers = [...allCustomers, ...subCustomers];
            }
          }
        }

        // Dedup theo docId phòng trường hợp trùng
        const seen = new Set();
        const deduped = allCustomers.filter(c => {
          if (seen.has(c.docId)) return false;
          seen.add(c.docId);
          return true;
        });

        setCustomerList(deduped);
      } catch (e) {
        console.error('Fetch customers error:', e);
      } finally {
        setCustomerLoading(false);
      }
    };

    fetchCustomers();
  }, [userDetail?.email, role]);

  // ── Fetch danh sách Đối tác (chỉ admin — dùng cho "Người được hỗ trợ") ──
  useEffect(() => {
    if (role !== 'admin') return;
    const fetchPartners = async () => {
      setAssistedPartnerLoading(true);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'users'));
        const list = snap.docs
          .map(d => ({ docId: d.id, ...d.data() }))
          .filter(u => ['phantan', 'daily'].includes(getRole(u)));
        setAssistedPartnerList(list);
      } catch (e) {
        console.error('Fetch partner list error:', e);
      } finally {
        setAssistedPartnerLoading(false);
      }
    };
    fetchPartners();
  }, [role]);

  useEffect(() => {
    const resolve = async () => {
      // Giá lấy theo effectiveUser/effectiveRole — tức người được hỗ trợ khi admin tạo đơn hộ.
      // Đây phải khớp với basePriceField trong commissionCalc.computeOrderCommission,
      // nếu lệch thì hoa hồng hiển thị sai (chênh lệch giá ảo).
      if (!effectiveUser?.advisor) {
        // Không có advisor → dùng role của chính mình
        setResolvedPriceField(getRolePriceField(effectiveRole));
        return;
      }
      // Có advisor → tìm advisor cấp 1 (người không có advisor trên họ)
      try {
        let currentEmail = effectiveUser.advisor;
        let visited = new Set();
        while (currentEmail) {
          if (visited.has(currentEmail)) break;
          visited.add(currentEmail);
          const snap = await getDoc(doc(db, 'users', currentEmail));
          if (!snap.exists()) break;
          const data = snap.data();
          if (!data.advisor) {
            // Đây là advisor cấp 1 — lấy role của họ
            setResolvedPriceField(getRolePriceField(getRole(data)));
            return;
          }
          currentEmail = data.advisor;
        }
      } catch (e) {
        console.warn('resolve advisor price error:', e);
      }
      setResolvedPriceField(getRolePriceField(effectiveRole)); // fallback
    };
    resolve();
  }, [effectiveUser?.advisor, effectiveRole]);

  // ── Fetch catalog (products) ─────────────────────────────────
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'productPrice'));
        setCatalog(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      } catch (e) {
        console.error('Fetch catalog error:', e);
      }
    };
    fetchCatalog();
  }, []);

  // ── Fetch service types ──────────────────────────────────────
  useEffect(() => {
    const fetchServiceTypes = async () => {
      try {
        const category = ORDER_TYPE_TO_CATEGORY[orderType];

        // Lấy service types từ collection riêng nếu có
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'servicePrice'));
        if (!snap.empty) {
          const data = snap.docs.map(d => ({
            docId: d.id,
            type: d.type || d.name || d.id,
            ...d.data(),
          }));
          setServiceTypesList(data);
        } else {
          // Fallback: tự tạo từ ORDER_TYPES config
          const defaults = orderType === 'buon'
            ? [{ type: 'DELIVERY', name: 'Giao hàng', description: 'Dịch vụ giao hàng tận nơi' }]
            : [
              { type: 'INSTALLATION', name: 'Lắp đặt', description: 'Dịch vụ lắp đặt tại địa điểm' },
              { type: 'DELIVERY', name: 'Giao hàng', description: 'Dịch vụ giao hàng tận nơi' },
            ];
          setServiceTypesList(defaults);
        }
      } catch (e) {
        console.error('Fetch service types error:', e);
      }
    };
    fetchServiceTypes();
  }, [orderType]); // re-fetch khi đổi loại đơn

  const handleSubmit = async () => {
    if (orderType === 'le' && !selectedCustomer) {
      showAlert('Thông báo', 'Vui lòng chọn khách hàng cho đơn lẻ');
      return;
    }
    if (products.length === 0) {
      showAlert('Thông báo', 'Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng');
      return;
    }
    if (!orderDate) {
      showAlert('Thông báo', 'Vui lòng chọn ngày giao hàng');
      return;
    }

    setSubmitting(true);
    try {
      // Logic xác định thông tin khách hàng an toàn
      const finalCustomerName = orderType === 'buon'
        ? (selectedCustomer?.name || userDetail?.name || 'Đơn buôn hệ thống')
        : selectedCustomer.name;

      const finalCustomerPhone = orderType === 'buon'
        ? (selectedCustomer?.phone || userDetail?.phone || userDetail?.email)
        : selectedCustomer.phone;

      const orderCategory = ORDER_TYPE_TO_CATEGORY[orderType];
      const [orderStatuses] = await Promise.all([fetchStatusList(orderCategory)]);
      const initialOrderStatus = orderStatuses[0]?.name || 'Chờ xác nhận';

      let effectiveCreatorEmail = userDetail.email;
      let hierarchyUserDetail = userDetail;

      if (role === 'admin' && selectedAssistedPartner?.email) {
        // Admin tạo đơn hộ — creator là người được hỗ trợ vừa chọn
        effectiveCreatorEmail = selectedAssistedPartner.email;
        hierarchyUserDetail = selectedAssistedPartner;
      } else {
        // Nếu admin tạo đơn cho khách của ctv/partner, ghi nhận creator là người tạo khách
        const customerCreator = selectedCustomer?.createdBy;
        const isAdminCreatingForOther = role === 'admin' && customerCreator && customerCreator !== userDetail.email;
        if (isAdminCreatingForOther) {
          effectiveCreatorEmail = customerCreator;
          try {
            const creatorSnap = await getDoc(doc(db, 'users', customerCreator));
            if (creatorSnap.exists()) hierarchyUserDetail = creatorSnap.data();
          } catch (_) { }
        }
      }
      const { rootAdvisor, level } = await calculateHierarchy(effectiveCreatorEmail, hierarchyUserDetail);

      const newOrder = {
        id: orderId,
        orderType,
        paymentMethod: effectivePaymentMethod,
        customer: finalCustomerName,
        phone: finalCustomerPhone,
        customerId: selectedCustomer?.docId || '',
        items: products,
        createdAt: orderDate,
        address: deliveryAddress || userDetail?.address || '',
        note: notes,
        status: initialOrderStatus,
        createdBy: effectiveCreatorEmail,
        rootAdvisor,
        level,
      };

      await setDoc(doc(db, 'orders', orderId), newOrder);

      // Sửa lỗi Typo và Crash tại đây:
      if (selectedServices.length > 0) {
        const svcStatusMap = {};
        for (const svcType of selectedServices) {
          const svcCategory = SERVICE_TYPE_TO_CATEGORY[svcType]
            || (orderType === 'buon' ? 'DELIVERY' : 'INSTALLATION');
          const statuses = await fetchStatusList(svcCategory);
          svcStatusMap[svcType] = statuses[0]?.name || 'Chờ xử lý';
        }
        await Promise.all(selectedServices.map(async (svcType) => {
          const svcId = `SV-${Date.now().toString().slice(-6)}-${svcType}`;
          return setDoc(doc(db, 'service', svcId), {
            id: svcId,
            type: svcType,
            orderId,
            orderItems: products,
            customer: finalCustomerName, // Dùng biến safe
            phone: finalCustomerPhone,   // Dùng biến safe
            address: deliveryAddress || userDetail?.address || '',
            note: serviceNote,
            status: svcStatusMap[svcType],
            createdBy: userDetail?.email || '',
            createdAt: new Date().toISOString(),
            autoAssigned: true,
            orderType,
          });
        }));
      }

      showSuccess('Đơn hàng đã được tạo!', `Mã đơn: ${orderId}`, () => router.replace('/(tabs)/order'));
    } catch (e) {
      console.error(e);
      showAlert('Lỗi', e.message);
    }
    finally { setSubmitting(false); }
  };



  // ─────────────────────────────────────────────────────────
  // WEB LAYOUT
  // ─────────────────────────────────────────────────────────
  return isDesktop ? (
    <View style={W.root}>
      <BgWatermark />
      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={W.scroll}>
        <View style={W.pageHeader}>
          <View>
            <Text style={W.pageTitle}>Tạo đơn hàng mới</Text>
            <Text style={W.pageSub}>Điền thông tin để tạo đơn hàng cho khách hàng</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HelpButton screenKey="addOrder" />
            <TouchableOpacity style={W.cancelBtn} onPress={() => router.replace('(tabs)/order')}>
              <Ionicons name="close" size={16} color="#64748B" />
              <Text style={W.cancelBtnText}>Huỷ</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={W.grid}>
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

              <View style={W.inputGroup}>
                <Text style={W.label}>Thể loại đơn hàng <Text style={W.req}>*</Text></Text>
                <OrderTypeField ws orderType={orderType} lockedType={lockedType} setOrderType={handleSetOrderType} />
              </View>

              {role === 'admin' && (
                <View style={[W.inputGroup, { zIndex: showAssistedPicker ? 100 : 1 }]}>
                  <Text style={W.label}>Người được hỗ trợ</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[W.inputBox, { flex: 1 }, showAssistedPicker && W.inputBoxFocus]}
                      onPress={() => setShowAssistedPicker(p => !p)}
                      activeOpacity={0.8}
                    >
                      {selectedAssistedPartner ? (
                        <View style={W.selectedCustomer}>
                          <Text style={W.cAvatarText}>
                            {(selectedAssistedPartner.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Text>
                          <View><Text style={W.cName}>{selectedAssistedPartner.name || selectedAssistedPartner.email}</Text></View>
                        </View>
                      ) : <Text style={W.inputPlaceholder}>Bỏ trống nếu tự tạo cho mình...</Text>}
                      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                    {selectedAssistedPartner && (
                      <TouchableOpacity onPress={() => handleSetSelectedAssistedPartner(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {showAssistedPicker && (
                    <AssistedPartnerDropdown
                      ws
                      partnerList={assistedPartnerList}
                      partnerLoading={assistedPartnerLoading}
                      partnerSearch={assistedSearch}
                      setPartnerSearch={handleSetAssistedSearch}
                      selectedPartner={selectedAssistedPartner}
                      setSelectedPartner={handleSetSelectedAssistedPartner}
                      setShowPartnerPicker={handleSetShowAssistedPicker}
                    />
                  )}
                </View>
              )}

              {orderType === 'le' && (
                <View style={[W.inputGroup, { zIndex: showCustomerPicker ? 100 : 1 }]}>
                  <Text style={W.label}>Khách hàng <Text style={W.req}>*</Text></Text>
                  <TouchableOpacity
                    style={[W.inputBox, showCustomerPicker && W.inputBoxFocus]}
                    onPress={() => setShowCustomerPicker(p => !p)}
                    activeOpacity={0.8}
                  >
                    {selectedCustomer ? (
                      <View style={W.selectedCustomer}>
                        <Text style={W.cAvatarText}>
                          {(selectedCustomer?.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                        <View><Text style={W.cName}>{selectedCustomer.name}</Text></View>
                      </View>
                    ) : <Text style={W.inputPlaceholder}>Chọn khách hàng...</Text>}
                    <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  {showCustomerPicker && (
                    <CustomerPickerDropdown
                      ws
                      customerList={visibleCustomerList}
                      customerLoading={customerLoading}
                      customerSearch={customerSearch}
                      setCustomerSearch={handleSetCustomerSearch}
                      selectedCustomer={selectedCustomer}
                      setSelectedCustomer={handleSetSelectedCustomer}
                      setDeliveryAddress={handleSetDeliveryAddress}
                      setShowCustomerPicker={handleSetShowCustomerPicker}
                      emptyLabel={customerEmptyLabel}
                    />
                  )}
                </View>
              )}

              {orderType !== 'buon' && (
                <View style={W.inputGroup}>
                  <Text style={W.label}>Địa chỉ giao hàng</Text>
                  <View style={W.inputBox}>
                    <TextInput style={W.input} placeholder="Nhập địa chỉ..." placeholderTextColor="#94A3B8" value={deliveryAddress} onChangeText={handleAddressChange} />
                  </View>
                </View>
              )}

              <View style={W.inputGroup}>
                <Text style={W.label}>Ghi chú</Text>
                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}>
                  <TextInput
                    style={[W.input, { textAlignVertical: 'top' }]}
                    placeholder="Hướng dẫn đặc biệt..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={notes}
                    onChangeText={handleNotesChange}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={W.colRight}>
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="cube-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Sản phẩm</Text>
                {products.length > 0 && <View style={W.productCount}><Text style={W.productCountText}>{products.length}</Text></View>}
                {/* <View style={W.roleBadge}><Ionicons name="pricetag-outline" size={11} color="#059669" /><Text style={W.roleBadgeText}>{priceLabel}</Text></View> */}
              </View>
              {products.map(p => (
                <View key={p.id} style={W.productRow}>
                  <View style={W.productIcon}><Ionicons name="water-outline" size={14} color="#2563EB" /></View>
                  <View style={{ flex: 1 }}><Text style={W.productName}>{p.name}</Text><Text style={W.productMeta}>x{p.qty} · {fmt(p.price)}</Text></View>
                  <Text style={W.productTotal}>{fmt(p.price * p.qty)}</Text>
                  <TouchableOpacity onPress={() => removeProduct(p.id)} style={W.removeBtn}><Ionicons name="trash-outline" size={14} color="#EF4444" /></TouchableOpacity>
                </View>
              ))}
              {showAddProduct ? (
                <AddProductForm
                  ws
                  orderType={orderType}
                  catalog={catalog}
                  priceField={priceField}
                  priceLabel={priceLabel}
                  newProduct={newProduct}
                  setNewProduct={handleSetNewProduct}
                  showProductDrop={showProductDrop}
                  setShowProductDrop={handleSetShowProductDrop}
                  onAdd={addProduct}
                  onCancel={handleCancelAddProduct}
                />
              ) : (
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

            <ServiceList
              ws={isDesktop}
              serviceTypesList={filteredServiceTypes} // <-- Dùng list đã lọc
              selectedServices={selectedServices}
              setSelectedServices={setSelectedServices}
              serviceNote={serviceNote}
              onServiceNoteChange={handleServiceNoteChange}
              orderType={orderType}
              deliveryAddress={deliveryAddress}
              onAddressChange={handleAddressChange}
            />

            {/* Hình thức thanh toán - Chỉ hiển thị cho người dùng Cấp 1 */}
            {isLevel1 && (
              // {userDetail?.role != "daily" && (
              <PaymentMethodField
                ws={isDesktop}
                orderType={orderType}
                useFixedPrice={useFixedPrice}
                fixedPayment={fixedPayment}
                paymentMethod={paymentMethod}
                setPaymentMethod={handleSetPaymentMethod}
              />
            )}

            <TouchableOpacity style={[W.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
              <Text style={W.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View >
  ) :

    // ─────────────────────────────────────────────────────────
    // MOBILE LAYOUT
    // ─────────────────────────────────────────────────────────
    (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BgWatermark />
        <StatusBar barStyle="light-content" backgroundColor="#0A0F2C" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('(tabs)/order')} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerLabel}>Tạo đơn hàng</Text>
          <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>{userDetail?.name?.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? 'U'}{userDetail?.name?.trim().split(/\s+/)[0]?.[0]?.toUpperCase() ?? ''}</Text></View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Order ID</Text>
                <View style={styles.inputBox}><Text style={styles.inputReadonly}>{orderId}</Text></View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ngày giao hàng <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <DateField orderDate={orderDate} setOrderDate={setOrderDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Thể loại đơn hàng</Text>
                <OrderTypeField ws={false} orderType={orderType} lockedType={lockedType} setOrderType={handleSetOrderType} />
              </View>

              {role === 'admin' && (
                <View style={[W.inputGroup, { zIndex: showAssistedPicker ? 100 : 1 }]}>
                  <Text style={W.label}>Người được hỗ trợ (Đối tác / Đại lý)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={[W.inputBox, { flex: 1 }, showAssistedPicker && W.inputBoxFocus]}
                      onPress={() => setShowAssistedPicker(p => !p)}
                      activeOpacity={0.8}
                    >
                      {selectedAssistedPartner ? (
                        <View style={W.selectedCustomer}>
                          <View style={W.cAvatar}><Text style={W.cAvatarText}>{(selectedAssistedPartner.name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)}</Text></View>
                          <View><Text style={W.cName}>{selectedAssistedPartner.name || selectedAssistedPartner.email}</Text></View>
                        </View>
                      ) : <Text style={W.inputPlaceholder}>Bỏ trống nếu tự tạo cho mình...</Text>}
                      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                    {selectedAssistedPartner && (
                      <TouchableOpacity onPress={() => handleSetSelectedAssistedPartner(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {showAssistedPicker && (
                    <AssistedPartnerDropdown
                      ws={false}
                      partnerList={assistedPartnerList}
                      partnerLoading={assistedPartnerLoading}
                      partnerSearch={assistedSearch}
                      setPartnerSearch={handleSetAssistedSearch}
                      selectedPartner={selectedAssistedPartner}
                      setSelectedPartner={handleSetSelectedAssistedPartner}
                      setShowPartnerPicker={handleSetShowAssistedPicker}
                    />
                  )}
                </View>
              )}

              {orderType === 'le' && (
                <View style={[W.inputGroup, { zIndex: showCustomerPicker ? 100 : 1 }]}>
                  <Text style={W.label}>Khách hàng <Text style={W.req}>*</Text></Text>
                  <TouchableOpacity
                    style={[W.inputBox, showCustomerPicker && W.inputBoxFocus]}
                    onPress={() => setShowCustomerPicker(p => !p)}
                    activeOpacity={0.8}
                  >
                    {selectedCustomer ? (
                      <View style={W.selectedCustomer}>
                        <View style={W.cAvatar}><Text style={W.cAvatarText}>{/* initials */}</Text></View>
                        <View><Text style={W.cName}>{selectedCustomer.name}</Text></View>
                      </View>
                    ) : <Text style={W.inputPlaceholder}>Chọn khách hàng...</Text>}
                    <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  {showCustomerPicker && (
                    <CustomerPickerDropdown
                      ws={false}
                      customerList={visibleCustomerList}
                      customerLoading={customerLoading}
                      customerSearch={customerSearch}
                      setCustomerSearch={handleSetCustomerSearch}
                      selectedCustomer={selectedCustomer}
                      setSelectedCustomer={handleSetSelectedCustomer}
                      setDeliveryAddress={handleSetDeliveryAddress}
                      setShowCustomerPicker={handleSetShowCustomerPicker}
                      emptyLabel={customerEmptyLabel}
                    />
                  )}
                </View>
              )}

              <View style={styles.productSection}>
                <View style={styles.productHeader}>
                  <Ionicons name="cube-outline" size={18} color="#fff" />
                  <Text style={styles.productHeaderText}>Sản phẩm</Text>
                  <View style={styles.rolePill}><Text style={styles.rolePillText}>{priceLabel}</Text></View>
                </View>
                {products.map(p => (
                  <View key={p.id} style={styles.productItem}>
                    <View style={styles.productItemLeft}><Text style={styles.productItemName} numberOfLines={1}>{p.name}</Text><Text style={styles.productItemMeta}>x{p.qty} • {fmt(p.price)}</Text></View>
                    <View style={styles.productItemRight}><Text style={styles.productItemTotal}>{fmt(p.price * p.qty)}</Text><TouchableOpacity onPress={() => removeProduct(p.id)}><Ionicons name="close-circle" size={18} color="#F44336" /></TouchableOpacity></View>
                  </View>
                ))}
                {showAddProduct ? (
                  <AddProductForm
                    ws={false}
                    orderType={orderType}
                    catalog={catalog}
                    priceField={priceField}
                    priceLabel={priceLabel}
                    newProduct={newProduct}
                    setNewProduct={handleSetNewProduct}
                    showProductDrop={showProductDrop}
                    setShowProductDrop={handleSetShowProductDrop}
                    onAdd={addProduct}
                    onCancel={handleCancelAddProduct}
                  />
                ) : (
                  <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowAddProduct(true)} activeOpacity={0.8}>
                    <Ionicons name="add" size={18} color="#2563EB" /><Text style={styles.addProductBtnText}>Thêm sản phẩm</Text>
                  </TouchableOpacity>
                )}
                {products.length > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Tổng cộng</Text><Text style={styles.totalAmount}>{fmt(totalAmount)}</Text></View>}
              </View>

              {orderType !== 'buon' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Địa chỉ giao hàng</Text>
                  <View style={[styles.inputBox, styles.textAreaBox]}>
                    <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Địa chỉ giao hàng..." placeholderTextColor="#B0B0C8" multiline value={deliveryAddress} onChangeText={handleAddressChange} />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ghi chú (tuỳ chọn)</Text>
                <View style={[styles.inputBox, styles.textAreaBox]}>
                  <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#B0B0C8" multiline value={notes} onChangeText={handleNotesChange} />
                </View>
              </View>

              <ServiceList
                ws={isDesktop}
                serviceTypesList={filteredServiceTypes} // <-- Dùng list đã lọc
                selectedServices={selectedServices}
                setSelectedServices={setSelectedServices}
                serviceNote={serviceNote}
                onServiceNoteChange={handleServiceNoteChange}
                orderType={orderType}
                deliveryAddress={deliveryAddress}
                onAddressChange={handleAddressChange}
              />

              {/* Hình thức thanh toán - Chỉ hiển thị cho người dùng Cấp 1 */}
              {/* {isLevel1 && ( */}
              {userDetail?.role !== 'daily' && (
                <PaymentMethodField
                  ws={isDesktop}
                  orderType={orderType}
                  useFixedPrice={useFixedPrice}
                  fixedPayment={fixedPayment}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={handleSetPaymentMethod}
                />
              )}

              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đơn hàng'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: insets.bottom + 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View >
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
  req: { color: '#EF4444' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  inputBoxFocus: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  inputReadonly: { flex: 1, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
  selectedCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  cAvatarText: { color: '#2563EB', fontSize: 10, fontWeight: '800' },
  cName: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
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
  orderTypeRow: { flexDirection: 'row', gap: 10 },
  orderTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF', position: 'relative' },
  orderTypeBtnLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  orderTypeBtnDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  orderTypeCheck: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 6, right: 6 },
  orderTypeLocked: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  orderTypeLockedText: { fontSize: 14, fontWeight: '800' },
  orderTypeLockedDesc: { fontSize: 13, flex: 1 },
  orderTypeLockIcon: { marginLeft: 'auto' },
  autoSvcCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  serviceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  serviceDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  toggleSwitch: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#2563EB' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  svcLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4, marginTop: 4 },
  pmCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  pmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pmHeaderIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  pmTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  pmOptions: { flexDirection: 'row', gap: 10 },
  pmOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 10, padding: 12, backgroundColor: '#FFFFFF', position: 'relative' },
  pmOptionIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pmOptionLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748B' },
  pmCheck: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 6, right: 6 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  submitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  pmLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F3FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 'auto' },
  pmLockText: { fontSize: 10, color: '#8B5CF6', fontWeight: '700' },
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
  orderTypeRow: { flexDirection: 'row', gap: 10 },
  orderTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', position: 'relative' },
  orderTypeBtnLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  orderTypeBtnDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  orderTypeCheck: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 6, right: 6 },
  orderTypeLocked: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  orderTypeLockedText: { fontSize: 14, fontWeight: '800' },
  orderTypeLockedDesc: { fontSize: 12, flex: 1, color: '#64748B' },
  orderTypeLockIcon: { marginLeft: 'auto' },
  autoSvcCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 18, overflow: 'hidden' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', paddingHorizontal: 14, paddingTop: 14 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 10, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  serviceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  serviceDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  toggleSwitch: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#2563EB' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  svcLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3, marginBottom: 4, paddingHorizontal: 14 },
  svcNoteBox: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', marginHorizontal: 14, marginBottom: 14 },
  pmLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F3FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 'auto' },
  pmLockText: { fontSize: 10, color: '#8B5CF6', fontWeight: '700' },
  pmCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 18, padding: 14 },
  pmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pmHeaderIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  pmTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  pmOptions: { flexDirection: 'column', gap: 8 },
  pmOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', position: 'relative' },
  pmOptionIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pmOptionLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#64748B' },
  pmCheck: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 8, right: 10 },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 20, shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});