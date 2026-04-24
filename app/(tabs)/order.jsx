import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { showAlert } from '../../components/Main/showAlert';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png');

const getRole = (u) => {
  const r = (u?.role || u?.member || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
  if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
  if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
  return 'other';
};

// ── Fallback STATUS_CONFIG (dùng khi chưa load từ DB) ────────
const STATUS_CONFIG_FALLBACK = {
  PENDING: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Chờ lắp đặt', icon: 'time-outline', changeable: true },
  SHIPPED: { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Đang giao hàng', icon: 'car-outline', changeable: true },
  CONFIRMED: { color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', label: 'Đã thanh toán', icon: 'card-outline', changeable: true },
  COMPLETED: { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', label: 'Hoàn thành', icon: 'checkmark-circle', changeable: true },
  CANCELLED: { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Đã hủy', icon: 'close-circle-outline', changeable: true },
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
const TABS = ['All', 'PENDING', 'SHIPPED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const TAB_LABELS = { All: 'Tất cả', PENDING: 'Chờ lắp đặt', SHIPPED: 'Đang giao hàng', CONFIRMED: 'Đã thanh toán', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };

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
  lockedTag: { backgroundColor: '#FEF2F2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  lockedText: { fontSize: 10, color: '#EF4444', fontWeight: '600' },
  cancelItem: { borderTopWidth: 2, borderTopColor: '#FEE2E2' },
  cancelIcon: { backgroundColor: '#FEF2F2', width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ── Order Detail Panel ────────────────────────────────────────
function OrderDetailPanel({ order: initialOrder, onClose, router, userDetail }) {
  const [order, setOrder] = useState(initialOrder);
  const [services, setServices] = useState([]);
  const [svcLoading, setSvcLoading] = useState(true);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // db/status config for this order type
  const [statusConfig, setStatusConfig] = useState(STATUS_CONFIG_FALLBACK);

  const isAdmin = (userDetail?.role || userDetail?.member || '').toLowerCase() === 'admin';

  useEffect(() => { setOrder(initialOrder); }, [initialOrder?.id]);

  // Fetch services
  useEffect(() => {
    if (!order?.id) return;
    const fetch = async () => {
      setSvcLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'service'), where('orderId', '==', order.id)));
        setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })));
      } catch (e) { console.error(e); }
      finally { setSvcLoading(false); }
    };
    fetch();
  }, [order?.id]);

  // Fetch status config từ db/status/{orderType}
  // Cấu trúc: db/status/{buon|le} collection → docs với fields: id, status, service, changeable, type
  useEffect(() => {
    if (!order?.orderType) return;
    const fetchStatusConfig = async () => {
      try {
        const snap = await getDocs(collection(db, 'status', order.orderType, 'statuses'));
        if (snap.empty) return; // giữ fallback
        const cfg = { ...STATUS_CONFIG_FALLBACK };
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.status && cfg[data.status]) {
            cfg[data.status] = { ...cfg[data.status], ...data };
          }
        });
        setStatusConfig(cfg);
      } catch (e) {
        // silently fallback
      }
    };
    fetchStatusConfig();
  }, [order?.orderType]);

  // ── Hủy tất cả dịch vụ đính kèm ─────────────────────────
  const cancelLinkedServices = async (orderId) => {
    try {
      const snap = await getDocs(query(collection(db, 'service'), where('orderId', '==', orderId)));
      await Promise.all(snap.docs.map(d => updateDoc(doc(db, 'service', d.id), { status: 'CANCELLED' })));
      setServices(prev => prev.map(s => ({ ...s, status: 'CANCELLED' })));
    } catch (e) { console.error('Lỗi hủy dịch vụ:', e); }
  };

  // ── Cập nhật trạng thái ───────────────────────────────────
  const handleUpdateStatus = (newStatus) => {
    setShowStatusPicker(false);
    if (newStatus === order.status) return;

    // Kiểm tra changeable của trạng thái HIỆN TẠI
    const currentCfg = statusConfig[order.status];
    if (currentCfg?.changeable === false) {
      showAlert('Không thể thay đổi', 'Trạng thái hiện tại không cho phép chuyển đổi thủ công.');
      return;
    }

    const isCancelling = newStatus === 'CANCELLED';
    const newCfg = statusConfig[newStatus] || STATUS_CONFIG_FALLBACK[newStatus];

    showAlert(
      isCancelling ? '⚠️ Hủy đơn hàng' : 'Đổi trạng thái',
      isCancelling
        ? `Hủy đơn hàng #${order.id}? Tất cả dịch vụ đính kèm cũng sẽ bị hủy.`
        : `Cập nhật sang "${newCfg?.label}"?`,
      async () => {
        setUpdatingStatus(true);
        try {
          const phone = order._phone;
          if (!phone) throw new Error('Không xác định được số điện thoại khách hàng');
          const orderDoc = await getDoc(doc(db, 'orders', phone));
          if (!orderDoc.exists()) throw new Error('Không tìm thấy đơn hàng');
          const orders = orderDoc.data().orders || [];
          const updated = orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o);
          await updateDoc(doc(db, 'orders', phone), { orders: updated });
          setOrder(prev => ({ ...prev, status: newStatus }));

          // ✅ Auto-hủy dịch vụ khi đơn bị hủy
          if (isCancelling) await cancelLinkedServices(order.id);
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setUpdatingStatus(false); }
      }
    );
  };

  if (!order) return null;
  const statusCfg = statusConfig[order.status] || STATUS_CONFIG_FALLBACK.PENDING;
  const typeCfg = ORDER_TYPE_CONFIG[order.orderType];
  const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
  const isCancelled = order.status === 'CANCELLED';

  // Current status changeable?
  const currentChangeable = statusConfig[order.status]?.changeable !== false;

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
          {!currentChangeable && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FECACA' }}>
              <Ionicons name="lock-closed-outline" size={14} color="#EF4444" />
              <Text style={{ fontSize: 12, color: '#EF4444', flex: 1 }}>Trạng thái hiện tại không cho phép chuyển đổi thủ công</Text>
            </View>
          )}
          {Object.entries(statusConfig).filter(([k]) => k !== 'CANCELLED').map(([key, cfg]) => {
            const active = order.status === key;
            const locked = !currentChangeable;
            return (
              <TouchableOpacity key={key}
                style={[PM.item, active && PM.itemActive, locked && { opacity: 0.4 }]}
                onPress={() => !locked && handleUpdateStatus(key)} activeOpacity={locked ? 1 : 0.7}
              >
                <View style={[PM.itemIcon, { backgroundColor: cfg.bg || '#F1F5F9' }]}>
                  <Ionicons name={cfg.icon || 'ellipse-outline'} size={16} color={cfg.color || '#94A3B8'} />
                </View>
                <Text style={[PM.itemText, active && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={cfg.color} />}
              </TouchableOpacity>
            );
          })}
          {/* CANCELLED — luôn ở cuối, nổi bật */}
          {!isCancelled && (
            <TouchableOpacity
              style={[PM.item, PM.cancelItem, !currentChangeable && { opacity: 0.4 }]}
              onPress={() => currentChangeable && handleUpdateStatus('CANCELLED')}
              activeOpacity={currentChangeable ? 0.7 : 1}
            >
              <View style={PM.cancelIcon}><Ionicons name="close-circle-outline" size={16} color="#EF4444" /></View>
              <Text style={[PM.itemText, { color: '#EF4444' }]}>Hủy đơn hàng</Text>
              <View style={PM.lockedTag}><Text style={PM.lockedText}>Hủy + dịch vụ</Text></View>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={[P.root, isCancelled && P.rootCancelled]}>
      <StatusPickerModal />

      {/* Header */}
      <View style={P.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={P.orderId}>Order #{order.id}</Text>
            {typeCfg && (
              <View style={[P.typeBadge, { backgroundColor: typeCfg.bg }]}>
                <Ionicons name={typeCfg.icon} size={11} color={typeCfg.color} />
                <Text style={[P.typeBadgeText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
              </View>
            )}
            {/* Cancelled banner */}
            {isCancelled && (
              <View style={P.cancelledBadge}>
                <Ionicons name="close-circle" size={12} color="#EF4444" />
                <Text style={P.cancelledBadgeText}>Đã hủy</Text>
              </View>
            )}
          </View>
          <Text style={P.orderDate}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {!isCancelled && (
            <TouchableOpacity style={P.editBtn}
              onPress={() => router.push({ pathname: '/editOrder/[orderID]', params: { orderID: order.id, orderParam: JSON.stringify(order) } })}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={14} color="#2563EB" />
              <Text style={P.editBtnText}>Sửa</Text>
            </TouchableOpacity>
          )}
          {isAdmin && !isCancelled && (
            <TouchableOpacity
              style={[P.statusBtn, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }, updatingStatus && { opacity: 0.6 }]}
              onPress={() => setShowStatusPicker(true)} disabled={updatingStatus} activeOpacity={0.8}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusCfg.color }} />
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
        <View style={P.body}>
          {/* LEFT */}
          <View style={P.leftCol}>
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

          {/* RIGHT — Services */}
          <View style={P.rightCol}>
            <View style={P.section}>
              <View style={P.sectionHeader}>
                <Ionicons name="construct-outline" size={14} color="#8B5CF6" />
                <Text style={[P.sectionTitle, { color: '#8B5CF6' }]}>Dịch vụ</Text>
                {services.length > 0 && <View style={[P.countBadge, { backgroundColor: '#F5F3FF' }]}><Text style={[P.countText, { color: '#8B5CF6' }]}>{services.length}</Text></View>}
              </View>
              {svcLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}><ActivityIndicator size="small" color="#8B5CF6" /></View>
              ) : services.length === 0 ? (
                <View style={P.svcEmpty}><Ionicons name="construct-outline" size={24} color="#E2E8F0" /><Text style={P.svcEmptyText}>Chưa có dịch vụ</Text></View>
              ) : services.map((svc, i) => {
                const svcType = SVC_TYPE_CONFIG[svc.type] || SVC_TYPE_CONFIG.MAINTENANCE;
                const svcStatus = SVC_STATUS[svc.status] || SVC_STATUS.PENDING;
                return (
                  <View key={svc.id || i} style={[P.svcCard, svc.status === 'CANCELLED' && { opacity: 0.6 }]}>
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
                    {svc.machineItem && (
                      <View style={P.svcMachineRow}>
                        <Ionicons name="settings-outline" size={11} color={svcType.color} />
                        <Text style={[P.svcMachineText, { color: svcType.color }]} numberOfLines={1}>{svc.machineItem.name}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {services.length > 0 && (
                <TouchableOpacity style={P.svcViewAllBtn}
                  onPress={() => router.push({ pathname: '/(tabs)/service', params: { filterOrderId: order.id } })}
                  activeOpacity={0.8}
                >
                  <Text style={P.svcViewAllText}>Xem tất cả dịch vụ →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Total */}
        <View style={[P.totalBox, isCancelled && { backgroundColor: '#6B7280' }]}>
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
  rootCancelled: { borderColor: '#FECACA', backgroundColor: '#FFFAFA' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  orderId: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  cancelledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  cancelledBadgeText: { fontSize: 10, fontWeight: '800', color: '#EF4444' },
  orderDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  body: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  leftCol: { flex: 1 },
  rightCol: { flex: 1 },
  section: { borderRadius: 10, padding: 12, marginBottom: 10 },
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
  totalBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, backgroundColor: '#1E3A8A', borderRadius: 12, padding: 16 },
  totalLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  noteText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  editBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusBtnText: { fontSize: 11, fontWeight: '700' },
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
    CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
  };
  const totalRevenue = orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0), 0);

  const handlePressOrder = (item) => {
    if (isWeb) setSelected(prev => prev?.id === item.id ? null : item);
    else router.push({ pathname: '/OrderView/[orderID]', params: { orderID: item?.id, orderParam: JSON.stringify(item) } });
  };

  const renderOrder = ({ item, index }) => {
    const cfg = STATUS_CONFIG_FALLBACK[item.status] || STATUS_CONFIG_FALLBACK.PENDING;
    const typeCfg = ORDER_TYPE_CONFIG[item.orderType];
    const isActive = selected?.id === item.id;
    const isCancelled = item.status === 'CANCELLED';
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={[styles.orderRow, isActive && styles.orderRowActive, isCancelled && styles.orderRowCancelled]}
        onPress={() => handlePressOrder(item)}
      >
        <View style={[styles.orderAvatar, { backgroundColor: isCancelled ? '#9CA3AF' : AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
          <Text style={styles.orderAvatarText}>{getInitials(item.customer)}</Text>
        </View>
        <View style={[styles.orderInfo, isWeb && { flex: 2 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[styles.orderIdText, isCancelled && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>Đơn hàng #{item.id}</Text>
            {typeCfg && <View style={[styles.orderTypePill, { backgroundColor: typeCfg.bg }]}><Text style={[styles.orderTypePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text></View>}
          </View>
          <Text style={styles.orderCustomer}>{item.customer}</Text>
        </View>
        {isWeb && <Text style={styles.orderDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>}
        {isWeb && <Text style={styles.orderItems}>{item.items?.length || 0} sản phẩm</Text>}
        <Text style={[styles.orderAmount, isWeb && { flex: 1 }, isCancelled && { color: '#9CA3AF' }]}>
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
      <Image source={BG_IMAGE} style={styles.watermark} resizeMode="contain" />
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
              { icon: 'receipt-outline', color: '#3B82F6', bg: '#EFF6FF', value: orders.filter(o => o.status !== 'CANCELLED').length, label: 'Đơn hàng' },
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
              <TouchableOpacity key={tab} style={[styles.tabItem, filter === tab && styles.activeTabItem, tab === 'CANCELLED' && filter === tab && { backgroundColor: '#EF4444', borderColor: '#EF4444' }]} onPress={() => setFilter(tab)}>
                <Text style={[styles.tabText, filter === tab && styles.activeTabText]}>
                  {TAB_LABELS[tab]}
                  {counts[tab] > 0 && filter !== tab && <Text style={styles.tabCount}> {counts[tab]}</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

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
              <View style={styles.emptyState}><ActivityIndicator size="large" color="#2563EB" /><Text style={styles.emptyText}>Đang tải đơn hàng...</Text></View>
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
          {isWeb && selected && (
            <OrderDetailPanel order={selected} onClose={() => setSelected(null)} router={router} userDetail={userDetail} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.05 },
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
  orderRowCancelled: { borderColor: '#FECACA', backgroundColor: '#FFFAFA', opacity: 0.8 },
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