import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from "react-native";
import { showAlert } from '../../components/Main/showAlert';
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png')

const getRole = (u) => {
  const r = (u?.role || u?.member || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
  if (['Đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
  if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
  return 'other';
};

const STATUS_CONFIG = {
  PENDING: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Chờ lắp đặt', icon: 'time-outline' },
  SHIPPED: { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Đang giao hàng', icon: 'car-outline' },
  CONFIRMED: { color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', label: 'Đã thanh toán', icon: 'card-outline' },
  COMPLETED: { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', label: 'Hoàn thành', icon: 'checkmark-circle' },
};

const SVC_TYPE_CONFIG = {
  INSTALLATION: { label: 'Lắp đặt', icon: 'build-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  MAINTENANCE: { label: 'Bảo dưỡng', icon: 'construct-outline', color: '#F59E0B', bg: '#FFFBEB' },
  DELIVERY: { label: 'Giao hàng', icon: 'car-outline', color: '#10B981', bg: '#ECFDF5' },
  CONSULTING: { label: 'Tư vấn', icon: 'chatbubbles-outline', color: '#EC4899', bg: '#FDF2F8' },
  SALT: { label: 'Đổ muối', icon: 'water-outline', color: '#3B82F6', bg: '#EFF6FF' },
};

const SVC_STATUS = {
  PENDING: { color: '#F59E0B', bg: '#FFFBEB', label: 'Chờ xử lý' },
  PROCESSING: { color: '#3B82F6', bg: '#EFF6FF', label: 'Đang xử lý' },
  COMPLETED: { color: '#10B981', bg: '#ECFDF5', label: 'Hoàn thành' },
  CANCELLED: { color: '#EF4444', bg: '#FEF2F2', label: 'Đã hủy' },
};

const ORDER_TYPE_CONFIG = {
  buon: { label: 'Đơn buôn', color: '#2563EB', bg: '#EFF6FF', icon: 'cube-outline' },
  le: { label: 'Đơn lẻ', color: '#8B5CF6', bg: '#F5F3FF', icon: 'home-outline' },
};

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

const TABS = ['All', 'PENDING', 'SHIPPED', 'CONFIRMED', 'COMPLETED'];
const TAB_LABELS = { All: 'Tất cả', PENDING: 'Chờ lắp đặt', SHIPPED: 'Đang giao hàng', CONFIRMED: 'Đã thanh toán', COMPLETED: 'Hoàn thành' };

// ── Order Detail Panel (web) ──────────────────────────────────
function OrderDetailPanel({ order: initialOrder, onClose, router, userDetail }) {
  const [order, setOrder] = useState(initialOrder);
  const [services, setServices] = useState([]);
  const [svcLoading, setSvcLoading] = useState(true);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isAdmin = (userDetail?.role || userDetail?.member || '').toLowerCase() === 'admin';

  useEffect(() => { setOrder(initialOrder); }, [initialOrder?.id]);

  useEffect(() => {
    if (!order?.id) return;
    const fetchServices = async () => {
      setSvcLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'service'), where('orderId', '==', order.id)));
        setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })));
      } catch (e) { console.error(e); }
      finally { setSvcLoading(false); }
    };
    fetchServices();
  }, [order?.id]);

  // ── Cập nhật trạng thái đơn hàng ─────────────────────────
  // Orders lưu dạng array trong doc, cần đọc → sửa → ghi lại
  const handleUpdateStatus = (newStatus) => {
    setShowStatusPicker(false);
    if (newStatus === order.status) return;
    showAlert(
      'Đổi trạng thái',
      `Cập nhật sang "${STATUS_CONFIG[newStatus]?.label}"?`,
      async () => {
        setUpdatingStatus(true);
        try {
          // Dùng _phone được gán lúc fetch — nhanh và chính xác
          const phone = order._phone;
          if (!phone) throw new Error('Không xác định được số điện thoại khách hàng');

          const orderDoc = await getDoc(doc(db, 'orders', phone));
          if (!orderDoc.exists()) throw new Error('Không tìm thấy đơn hàng');

          const orders = orderDoc.data().orders || [];
          const updated = orders.map(o =>
            o.id === order.id ? { ...o, status: newStatus } : o
          );
          await updateDoc(doc(db, 'orders', phone), { orders: updated });
          setOrder(prev => ({ ...prev, status: newStatus }));
        } catch (e) {
          showAlert('Lỗi', e.message);
        } finally {
          setUpdatingStatus(false);
        }
      }
    );
  };

  if (!order) return null;
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const typeCfg = ORDER_TYPE_CONFIG[order.orderType];
  const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);

  // ── Status picker modal ───────────────────────────────────
  const StatusPickerModal = () => (
    <Modal transparent animationType="fade" visible={showStatusPicker} onRequestClose={() => setShowStatusPicker(false)}>
      <Pressable style={PM.overlay} onPress={() => setShowStatusPicker(false)}>
        <View style={PM.sheet} onStartShouldSetResponder={() => true}>
          <View style={PM.header}>
            <Text style={PM.title}>Chọn trạng thái</Text>
            <TouchableOpacity onPress={() => setShowStatusPicker(false)} style={PM.closeBtn}>
              <Ionicons name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const active = order.status === key;
            return (
              <TouchableOpacity key={key}
                style={[PM.item, active && PM.itemActive]}
                onPress={() => handleUpdateStatus(key)} activeOpacity={0.7}
              >
                <View style={[PM.itemIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                </View>
                <Text style={[PM.itemText, active && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={cfg.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={P.root}>

      {/* ✅ Watermark — cố định chính giữa, mờ nhạt */}

      <StatusPickerModal />

      {/* Header */}
      <View style={P.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={P.orderId}>Order #{order.id}</Text>
            {typeCfg && (
              <View style={[P.typeBadge, { backgroundColor: typeCfg.bg }]}>
                <Ionicons name={typeCfg.icon} size={11} color={typeCfg.color} />
                <Text style={[P.typeBadgeText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
              </View>
            )}
          </View>
          <Text style={P.orderDate}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>
        </View>
        {/* ✅ Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* Sửa — tất cả đều thấy */}
          <TouchableOpacity
            style={P.editBtn}
            onPress={() => router.push({ pathname: '/editOrder/[orderID]', params: { orderID: order.id, orderParam: JSON.stringify(order) } })}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={14} color="#2563EB" />
            <Text style={P.editBtnText}>Sửa</Text>
          </TouchableOpacity>
          {/* Đổi trạng thái — chỉ admin */}
          {isAdmin && (
            <TouchableOpacity
              style={[P.statusBtn, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }, updatingStatus && { opacity: 0.6 }]}
              onPress={() => setShowStatusPicker(true)}
              disabled={updatingStatus}
              activeOpacity={0.8}
            >
              <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusCfg.color }]} />
              <Text style={[P.statusBtnText, { color: statusCfg.color }]}>
                {updatingStatus ? 'Đang cập nhật...' : statusCfg.label}
              </Text>
              <Ionicons name="chevron-down" size={12} color={statusCfg.color} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={P.closeBtn}>
            <Ionicons name="close" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Two-column body */}
        <View style={P.body}>
          {/* LEFT column */}
          <View style={P.leftCol}>
            {/* Customer info */}
            <View style={P.section}>
              <View style={P.sectionHeader}>
                <Ionicons name="person-circle-outline" size={14} color="#2563EB" />
                <Text style={P.sectionTitle}>Khách hàng</Text>
              </View>
              <View style={P.infoRow}>
                <View style={P.infoIcon}><Ionicons name="person-outline" size={12} color="#64748B" /></View>
                <Text style={P.infoText}>{order.customer}</Text>
              </View>
              {order.address && (
                <View style={P.infoRow}>
                  <View style={P.infoIcon}><Ionicons name="location-outline" size={12} color="#64748B" /></View>
                  <Text style={P.infoText} numberOfLines={2}>{order.address}</Text>
                </View>
              )}
            </View>

            {/* Products */}
            <View style={P.section}>
              <View style={P.sectionHeader}>
                <Ionicons name="cube-outline" size={14} color="#2563EB" />
                <Text style={P.sectionTitle}>Sản phẩm</Text>
                <View style={P.countBadge}><Text style={P.countText}>{order.items?.length || 0}</Text></View>
              </View>
              {(order.items || []).map((item, i) => (
                <View key={i} style={P.productRow}>
                  <View style={P.productIcon}><Ionicons name="water-outline" size={12} color="#2563EB" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={P.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={P.productMeta}>x{item.qty} · {fmt(item.price)}</Text>
                  </View>
                  <Text style={P.productTotal}>{fmt(item.price * item.qty)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* RIGHT column — Services */}
          <View style={P.rightCol}>
            <View style={P.section}>
              <View style={P.sectionHeader}>
                <Ionicons name="construct-outline" size={14} color="#8B5CF6" />
                <Text style={[P.sectionTitle, { color: '#8B5CF6' }]}>Dịch vụ</Text>
                {services.length > 0 && (
                  <View style={[P.countBadge, { backgroundColor: '#F5F3FF' }]}>
                    <Text style={[P.countText, { color: '#8B5CF6' }]}>{services.length}</Text>
                  </View>
                )}
              </View>

              {svcLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color="#8B5CF6" />
                </View>
              ) : services.length === 0 ? (
                <View style={P.svcEmpty}>
                  <Ionicons name="construct-outline" size={24} color="#E2E8F0" />
                  <Text style={P.svcEmptyText}>Chưa có dịch vụ</Text>
                </View>
              ) : services.map((svc, i) => {
                const svcType = SVC_TYPE_CONFIG[svc.type] || SVC_TYPE_CONFIG.MAINTENANCE;
                const svcStatus = SVC_STATUS[svc.status] || SVC_STATUS.PENDING;
                return (
                  <View key={svc.id || i} style={P.svcCard}>
                    <View style={P.svcCardTop}>
                      <View style={[P.svcIcon, { backgroundColor: svcType.bg }]}>
                        <Ionicons name={svcType.icon} size={13} color={svcType.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={P.svcId}>#{svc.id}</Text>
                        <Text style={[P.svcType, { color: svcType.color }]}>{svcType.label}</Text>
                      </View>
                      <View style={[P.svcStatusBadge, { backgroundColor: svcStatus.bg }]}>
                        <Text style={[P.svcStatusText, { color: svcStatus.color }]}>{svcStatus.label}</Text>
                      </View>
                    </View>
                    {/* Machine */}
                    {svc.machineItem && (
                      <View style={P.svcMachineRow}>
                        <Ionicons name="settings-outline" size={11} color={svcType.color} />
                        <Text style={[P.svcMachineText, { color: svcType.color }]} numberOfLines={1}>{svc.machineItem.name}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Xem tất cả */}
              {services.length > 0 && (
                <TouchableOpacity
                  style={P.svcViewAllBtn}
                  onPress={() => router.push({ pathname: '/(tabs)/service', params: { filterOrderId: order.id } })}
                  activeOpacity={0.8}
                >
                  <Text style={P.svcViewAllText}>Xem tất cả dịch vụ →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Total bar */}
        <View style={P.totalBox}>
          <View style={{ flex: 1 }}>
            <Text style={P.totalLabel}>Tổng cộng</Text>
            {order.note && <Text style={P.noteText} numberOfLines={1}>Ghi chú: {order.note}</Text>}
          </View>
          <Text style={P.totalValue}>{fmt(total)}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const P = StyleSheet.create({
  root: { width: 680, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', flexShrink: 0 },
  watermark: {
    position: "absolute",
    width: "80%",           // ← to nhỏ tuỳ ý
    height: "60%",          // ← cao thấp tuỳ ý
    top: "20%",             // ← căn giữa dọc
    left: "10%",            // ← căn giữa ngang
    opacity: 0.05,          // ← 0.05 rất mờ / 0.15 rõ hơn
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  orderId: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  orderDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, marginBottom: 4, padding: 10, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  body: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  leftCol: { flex: 1 },
  rightCol: { flex: 1 },
  section: { backgroundColor: '#transparent', borderRadius: 10, padding: 12, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1 },
  countBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  countText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  infoIcon: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoText: { flex: 1, fontSize: 12, color: '#374151' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  productIcon: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  productMeta: { fontSize: 10, color: '#64748B' },
  productTotal: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  // Services
  svcEmpty: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  svcEmptyText: { fontSize: 12, color: '#94A3B8' },
  svcCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, marginBottom: 7, borderWidth: 1, borderColor: '#E2E8F0' },
  svcCardTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  svcIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  svcId: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  svcType: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  svcStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  svcStatusText: { fontSize: 10, fontWeight: '700' },
  svcMachineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  svcMachineText: { fontSize: 10, fontWeight: '600', flex: 1 },
  svcViewAllBtn: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
  svcViewAllText: { fontSize: 12, color: '#8B5CF6', fontWeight: '700' },
  // Total
  totalBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, backgroundColor: '#1E3A8A', borderRadius: 12, padding: 16 },
  totalLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  noteText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  // Buttons
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  editBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusBtnText: { fontSize: 11, fontWeight: '700' },
});

// ── Status Picker Modal Styles ────────────────────────────────
const PM = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 340, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  closeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  itemActive: { backgroundColor: '#F8FAFC' },
  itemIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
});

// ── Main ─────────────────────────────────────────────────────
export default function OrderView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!userDetail?.email) return;
    const myEmail = userDetail.email;
    const customerMap = new Map();
    try {
      if (role === 'admin') {
        (await getDocs(collection(db, 'customers'))).docs.forEach(d => { const c = d.data(); if (c.phone) customerMap.set(c.phone, c); });
      } else if (role === 'ctv') {
        (await getDocs(query(collection(db, 'customers'), where('addBy', '==', myEmail)))).docs.forEach(d => { const c = d.data(); if (c.phone) customerMap.set(c.phone, c); });
      } else if (role === 'daily' || role === 'phantan') {
        (await getDocs(query(collection(db, 'customers'), where('addBy', '==', myEmail)))).docs.forEach(d => { const c = d.data(); if (c.phone) customerMap.set(c.phone, c); });
        const subs = (await getDocs(query(collection(db, 'users'), where('advisor', '==', myEmail)))).docs.map(d => d.data().email).filter(Boolean);
        for (let i = 0; i < subs.length; i += 30) {
          (await getDocs(query(collection(db, 'customers'), where('addBy', 'in', subs.slice(i, i + 30))))).docs.forEach(d => { const c = d.data(); if (c.phone) customerMap.set(c.phone, c); });
        }
      }
      const phones = [...customerMap.keys()];
      const allOrders = [];
      await Promise.all(phones.map(async (phone) => {
        try {
          const snap = await getDoc(doc(db, 'orders', phone));
          if (!snap.exists()) return;
          (snap.data().orders || []).forEach(o => allOrders.push({ ...o, _phone: phone }));
        } catch (_) { }
      }));
      allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setOrders(allOrders);
    } catch (e) { console.error('Lỗi fetch orders:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [userDetail?.email, role]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter(o => {
    const matchFilter = filter === 'All' || o.status === filter;
    const matchSearch = (o.customer || '').toLowerCase().includes(search.toLowerCase()) || (o.id || '').includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    All: orders.length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
  };
  const totalRevenue = orders.reduce((sum, o) => sum + (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0), 0);

  const handlePressOrder = (item) => {
    if (isWeb) setSelected(prev => prev?.id === item.id ? null : item);
    else router.push({ pathname: '/OrderView/[orderID]', params: { orderID: item?.id, orderParam: JSON.stringify(item) } });
  };

  const renderOrder = ({ item, index }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const typeCfg = ORDER_TYPE_CONFIG[item.orderType];
    const isActive = selected?.id === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={[styles.orderRow, isActive && styles.orderRowActive]}
        onPress={() => handlePressOrder(item)}
      >
        <View style={[styles.orderAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
          <Text style={styles.orderAvatarText}>{getInitials(item.customer)}</Text>
        </View>
        <View style={[styles.orderInfo, isWeb && { flex: 2 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.orderIdText}>Đơn hàng #{item.id}</Text>
            {typeCfg && (
              <View style={[styles.orderTypePill, { backgroundColor: typeCfg.bg }]}>
                <Text style={[styles.orderTypePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.orderCustomer}>{item.customer}</Text>
        </View>
        {isWeb && <Text style={styles.orderDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>}
        {isWeb && <Text style={styles.orderItems}>{item.items?.length || 0} sản phẩm</Text>}
        <Text style={[styles.orderAmount, isWeb && { flex: 1 }]}>
          {(item.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>

      {/* ✅ Watermark — cố định chính giữa, mờ nhạt */}
      <Image
        source={BG_IMAGE}
        style={styles.watermark}
        resizeMode="contain"
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            {!isWeb && <View style={styles.headerLeft}><Ionicons name="receipt-outline" size={22} color={Colors.Primary} /></View>}
            <Text style={styles.title}>Đơn hàng</Text>
            <Text style={styles.headerCount}>{orders.length} đơn hàng</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/addOrder')} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={Colors.White} />
            {isWeb && <Text style={styles.addBtnText}>Tạo đơn hàng</Text>}
          </TouchableOpacity>
        </View>

        {isWeb && (
          <View style={styles.statsRow}>
            {[
              { icon: 'receipt-outline', color: '#3B82F6', bg: '#EFF6FF', value: orders.length, label: 'Tổng đơn hàng' },
              { icon: 'time-outline', color: '#F59E0B', bg: '#FFFBEB', value: counts.PENDING, label: 'Chờ lắp đặt' },
              { icon: 'car-outline', color: '#3B82F6', bg: '#EFF6FF', value: counts.SHIPPED, label: 'Đang giao' },
              { icon: 'cash-outline', color: '#10B981', bg: '#ECFDF5', value: fmt(totalRevenue), label: 'Doanh thu' },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: s.bg }]}><Ionicons name={s.icon} size={16} color={s.color} /></View>
                <View><Text style={styles.statValue}>{s.value}</Text><Text style={styles.statLabel}>{s.label}</Text></View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput style={styles.searchBar} placeholder="Tìm kiếm đơn hàng..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#94A3B8" /></TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            {TABS.map(tab => (
              <TouchableOpacity key={tab} style={[styles.tabItem, filter === tab && styles.activeTabItem]} onPress={() => setFilter(tab)}>
                <Text style={[styles.tabText, filter === tab && styles.activeTabText]}>
                  {TAB_LABELS[tab]}
                  {counts[tab] > 0 && filter !== tab && <Text style={styles.tabCount}> {counts[tab]}</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Main area */}
        <View style={styles.mainArea}>
          <View style={[styles.listArea, isWeb && selected && { marginRight: 16 }]}>
            {isWeb && filteredOrders.length > 0 && (
              <View style={styles.tableHeader}>
                <View style={{ width: 36 }} />
                <Text style={[styles.thCell, { flex: 2 }]}>Đơn hàng</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Ngày</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Sản phẩm</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Tổng tiền</Text>
                <Text style={[styles.thCell, { width: 130 }]}>Trạng thái</Text>
                <View style={{ width: 20 }} />
              </View>
            )}
            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.emptyText}>Đang tải đơn hàng...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredOrders}
                renderItem={renderOrder}
                keyExtractor={(item, i) => item.id?.toString() ?? String(i)}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
                contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100, gap: 6 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconWrap}><Ionicons name="receipt-outline" size={32} color="#94A3B8" /></View>
                    <Text style={styles.emptyTitle}>{orders.length === 0 ? 'Chưa có đơn hàng nào' : 'Không tìm thấy đơn hàng'}</Text>
                    <Text style={styles.emptySubtitle}>Tạo đơn hàng mới để bắt đầu</Text>
                  </View>
                }
              />
            )}
          </View>

          {/* Detail panel */}
          {isWeb && selected && (
            <OrderDetailPanel order={selected} onClose={() => setSelected(null)} router={router} userDetail={userDetail} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  watermark: {
    position: "absolute",
    width: "80%",           // ← to nhỏ tuỳ ý
    height: "60%",          // ← cao thấp tuỳ ý
    top: "20%",             // ← căn giữa dọc
    left: "10%",            // ← căn giữa ngang
    opacity: 0.05,          // ← 0.05 rất mờ / 0.15 rõ hơn
  },
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isWeb ? 24 : 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: isWeb ? 28 : 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: '#64748B', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  toolbar: { gap: 10, marginBottom: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  searchBar: { flex: 1, fontSize: 14, color: '#0F172A' },
  tabsScroll: { flexGrow: 0 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, backgroundColor: '#FFFFFF', marginRight: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  activeTabItem: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  tabCount: { fontSize: 11, color: '#94A3B8' },
  mainArea: { flex: 1, flexDirection: 'row', gap: 0 },
  listArea: { flex: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, marginBottom: 4 },
  thCell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  orderRowActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  orderAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  orderAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  orderInfo: { flex: 1 },
  orderIdText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  orderTypePill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  orderTypePillText: { fontSize: 9, fontWeight: '700' },
  orderCustomer: { fontSize: 12, color: '#64748B', marginTop: 2 },
  orderDate: { flex: 1, fontSize: 12, color: '#64748B' },
  orderItems: { flex: 1, fontSize: 12, color: '#94A3B8' },
  orderAmount: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#94A3B8' },
  emptyText: { fontSize: 14, color: Colors.LightGray, fontWeight: '500', marginTop: 8 },
});