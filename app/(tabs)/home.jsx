// app/(tabs)/home.jsx

import { useScreenData } from '@/components/Hooks/useScreenData';
import NotificationPanel from '@/components/Main/notificationPanel';
import TabScreenLayout, { useLayout } from '@/components/Main/TabScreenLayout';
import StatBar from '@/components/UI/StatBar';
import { exportCSV, exportExcel, exportImagesZip, fetchExportData } from '@/components/Utils/exportData';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { canAdd, getRole, isGD } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal,
  ScrollView,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// ── Export Modal ──────────────────────────────────────────────
function ExportModal({ visible, onClose }) {
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);

  const run = async (fn) => {
    setRunning(true); setStatus('Đang tải dữ liệu...');
    try {
      const data = await fetchExportData(setStatus);
      await fn(data);
      setStatus('✅ Xuất thành công!');
    } catch (e) { setStatus(`❌ Lỗi: ${e.message}`); }
    finally { setRunning(false); }
  };

  const runZip = async () => {
    setRunning(true); setStatus('Đang tải dữ liệu...');
    try {
      const data = await fetchExportData(setStatus);
      const count = await exportImagesZip(data.news, setStatus);
      setStatus(count === 0 ? '⚠️ Không có ảnh nào để xuất' : `✅ Đã xuất ${count} ảnh vào ZIP`);
    } catch (e) { setStatus(`❌ Lỗi: ${e.message}`); }
    finally { setRunning(false); }
  };

  const handleClose = () => { setStatus(''); setRunning(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={EX.overlay}>
        <View style={EX.modal}>
          <View style={EX.header}>
            <View style={EX.headerIcon}><Ionicons name="download-outline" size={18} color="#2563EB" /></View>
            <Text style={EX.headerTitle}>Xuất dữ liệu</Text>
            <TouchableOpacity onPress={handleClose} style={EX.closeBtn} disabled={running}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={EX.desc}>Xuất toàn bộ dữ liệu về máy. Chỉ hỗ trợ trên Web.</Text>
          <View style={EX.options}>
            <TouchableOpacity style={EX.optBtn} onPress={() => run(exportExcel)} disabled={running}>
              <View style={[EX.optIcon, { backgroundColor: '#ECFDF5' }]}><Ionicons name="document-outline" size={22} color="#059669" /></View>
              <View style={EX.optText}><Text style={EX.optTitle}>Excel (.xlsx)</Text><Text style={EX.optSub}>Tất cả bảng dữ liệu trong 1 file</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
            <View style={EX.optDivider} />
            <TouchableOpacity style={EX.optBtn} onPress={() => run(exportCSV)} disabled={running}>
              <View style={[EX.optIcon, { backgroundColor: '#EFF6FF' }]}><Ionicons name="grid-outline" size={22} color="#2563EB" /></View>
              <View style={EX.optText}><Text style={EX.optTitle}>CSV (nhiều file)</Text><Text style={EX.optSub}>Mỗi bảng tải xuống riêng lẻ</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
            <View style={EX.optDivider} />
            <TouchableOpacity style={EX.optBtn} onPress={runZip} disabled={running}>
              <View style={[EX.optIcon, { backgroundColor: '#FFF7ED' }]}><Ionicons name="images-outline" size={22} color="#EA580C" /></View>
              <View style={EX.optText}><Text style={EX.optTitle}>Ảnh (.zip)</Text><Text style={EX.optSub}>Toàn bộ ảnh trong tin tức</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          {(running || status) ? (
            <View style={EX.statusRow}>
              {running && <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 8 }} />}
              <Text style={[EX.statusText, status.startsWith('❌') && { color: '#EF4444' }]}>{status}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const EX = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 13, color: '#64748B', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, lineHeight: 20 },
  options: { paddingHorizontal: 20, paddingBottom: 4 },
  optBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optText: { flex: 1 },
  optTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  optSub: { fontSize: 12, color: '#64748B' },
  optDivider: { height: 1, backgroundColor: '#F1F5F9' },
  statusRow: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  statusText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
});

// ── Status config ─────────────────────────────────────────────
const STATUS_CFG = {
  'Chờ xác nhận': { color: '#D97706', bg: '#FFFBEB', label: 'Chờ xác nhận' },
  'Chờ lắp đặt': { color: '#2563EB', bg: '#EFF6FF', label: 'Chờ lắp đặt' },
  'Đang lắp đặt': { color: '#7C3AED', bg: '#F5F3FF', label: 'Đang lắp đặt' },
  'Đã lắp đặt': { color: '#059669', bg: '#ECFDF5', label: 'Đã lắp đặt' },
  'Chờ thanh toán': { color: '#EA580C', bg: '#FFF7ED', label: 'Chờ thanh toán' },
  'Đã thanh toán': { color: '#16A34A', bg: '#DCFCE7', label: 'Đã thanh toán' },
  'Đã hủy': { color: '#DC2626', bg: '#FEF2F2', label: 'Đã hủy' },
  'Chờ giao hàng': { color: '#0284C7', bg: '#E0F2FE', label: 'Chờ giao hàng' },
  'Đang giao hàng': { color: '#0369A1', bg: '#BAE6FD', label: 'Đang giao hàng' },
  'Đã giao hàng': { color: '#065F46', bg: '#ECFDF5', label: 'Đã giao hàng' },
};

// ── Web Quick Action (chỉ dùng trên web) ─────────────────────
function QuickAction({ name, icon, action, color, bg }) {
  return (
    <TouchableOpacity style={H.quickItem} onPress={action} activeOpacity={0.7}>
      <View style={[H.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={H.quickLabel}>{name}</Text>
    </TouchableOpacity>
  );
}

// ── Mobile stat card (dọc, full width) ───────────────────────
function MobileStatCard({ icon, label, value, color, bg, sub }) {
  return (
    <View style={MB.statCard}>
      <View style={[MB.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={MB.statLabel}>{label}</Text>
        <Text style={MB.statValue}>{value}</Text>
        {sub && <Text style={[MB.statSub, { color }]}>{sub}</Text>}
      </View>
    </View>
  );
}

// ── Mobile greeting banner ────────────────────────────────────
function MobileGreeting({ userDetail, role, onExport, onNotif }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[MB.greetingCard, { paddingTop: insets.top + 16 }]}>
      <View style={MB.greetingTop}>
        <View>
          <Text style={MB.greetingSmall}>Xin chào, {userDetail?.role || role}</Text>
          <Text style={MB.greetingName}>{userDetail?.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(role === 'admin' || isGD(role)) && (
            <TouchableOpacity style={MB.topIconBtn} onPress={onExport}>
              <Ionicons name="download-outline" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          {role !== 'giamdoc' &&
            (<NotificationPanel bellColor="#fff" bellSize={18} />
            )}
        </View>
      </View>
    </View>
  );
}

// ── Mobile order row ──────────────────────────────────────────
function MobileOrderRow({ order }) {
  const cfg = STATUS_CFG[order.status] || { color: '#64748B', bg: '#F1F5F9', label: order.status || '—' };
  const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
  return (
    <View style={MB.orderRow}>
      <View style={[MB.orderDot, { backgroundColor: cfg.color + '22' }]}>
        <Ionicons name="receipt-outline" size={14} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={MB.orderId}>#{order.id}</Text>
        <Text style={MB.orderCustomer}>{order.customer}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={MB.orderAmt}>{fmtCurrency(total)}</Text>
        <View style={[MB.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[MB.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function HomeView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const { isMobile } = useLayout();
  const { data: customerList, loading: customerLoading } = useScreenData('customers');

  const [exportOpen, setExportOpen] = useState(false);



  // Trong component, thay thế các state và useEffect liên quan đến orders
  const { data: orders, loading: ordersLoading, stats } = useScreenData('orders');

  // Tính toán từ data đã có sẵn
  const totalOrders = stats.total || 0;
  const totalRevenue = stats.revenue || 0;
  const recentOrders = useMemo(() =>
    [...orders]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
    , [orders])

  // ── Web-only data ─────────────────────────────────────────
  const quickActions = [
    ...(canAdd(role) ? [
      { name: 'Đơn hàng mới', icon: 'add-circle-outline', action: () => router.push('/addOrder'), color: '#3B82F6', bg: '#EFF6FF' },
      { name: 'Thêm khách', icon: 'person-add-outline', action: () => router.push('/addCustomer'), color: '#8B5CF6', bg: '#F5F3FF' },
    ] : []),
    { name: 'Phòng chat', icon: 'chatbubbles-outline', action: () => router.push('/chatList'), color: '#059669', bg: '#ECFDF5' },
    { name: 'Hợp đồng', icon: 'document-text-outline', action: () => router.push('/orderContract?mode=template'), color: '#0C447C', bg: '#EFF6FF' },
  ];

  const statCards = [
    { icon: 'cash-outline', label: 'Doanh Thu', value: fmtCurrency(totalRevenue), color: '#10B981', bg: '#ECFDF5' },
    { icon: 'receipt-outline', label: 'Tổng Đơn Hàng', value: String(totalOrders), color: '#3B82F6', bg: '#EFF6FF' },
    { icon: 'people-outline', label: 'Khách Hàng', value: String(customerList.length), color: '#8B5CF6', bg: '#F5F3FF' },
    { icon: 'trending-up-outline', label: 'Doanh Thu TB/Đơn', value: totalOrders > 0 ? fmtCurrency(totalRevenue / totalOrders) : '0đ', color: '#F59E0B', bg: '#FFFBEB' },
  ];

  return isMobile ? (
    <View style={MB.root}>
      {/* Greeting header với safe area */}
      <MobileGreeting
        userDetail={userDetail}
        role={role}
        onExport={() => setExportOpen(true)}
      />

      <ScrollView
        showsVerticalScrollIndicator={true}
        contentContainerStyle={MB.scroll}
      >
        {/* Stat cards — dọc */}
        <View style={MB.statsSection}>
          <MobileStatCard
            icon="cash-outline"
            label="Doanh thu tháng"
            value={fmtCurrency(totalRevenue)}
            color="#10B981"
            bg="#ECFDF5"
          />
          <MobileStatCard
            icon="receipt-outline"
            label="Đơn hàng mới"
            value={String(totalOrders)}
            color="#3B82F6"
            bg="#EFF6FF"
          />
          <MobileStatCard
            icon="people-outline"
            label="Khách hàng"
            value={String(customerList.length)}
            color="#8B5CF6"
            bg="#F5F3FF"
          />
          <MobileStatCard
            icon="trending-up-outline"
            label="Doanh thu TB/đơn"
            value={totalOrders > 0 ? fmtCurrency(totalRevenue / totalOrders) : '0đ'}
            color="#F59E0B"
            bg="#FFFBEB"
          />
        </View>

        {/* Đơn hàng gần đây */}
        <View style={MB.section}>
          <View style={MB.sectionHeader}>
            <Text style={MB.sectionTitle}>Đơn hàng gần đây</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/order')}>
              <Text style={MB.sectionLink}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          <View style={MB.orderCard}>
            {recentOrders.length === 0 ? (
              <View style={MB.emptyBox}>
                <Ionicons name="receipt-outline" size={28} color="#CBD5E1" />
                <Text style={MB.emptyText}>Chưa có đơn hàng</Text>
              </View>
            ) : (
              recentOrders.map(order => (
                <MobileOrderRow key={order.id} order={order} />
              ))
            )}
          </View>
        </View>

        {/* Khách hàng gần đây */}
        <View style={MB.section}>
          <View style={MB.sectionHeader}>
            <Text style={MB.sectionTitle}>Khách hàng gần đây</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/customer')}>
              <Text style={MB.sectionLink}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          <View style={MB.orderCard}>
            {customerLoading ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ padding: 16 }} />
            ) : customerList.length === 0 ? (
              <View style={MB.emptyBox}>
                <Ionicons name="people-outline" size={28} color="#CBD5E1" />
                <Text style={MB.emptyText}>Chưa có khách hàng</Text>
              </View>
            ) : (
              customerList.slice(0, 4).map((c, i) => (
                <View key={c.docId || i} style={MB.custRow}>
                  <View style={[MB.custAvatar, { backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'][i % 4] }]}>
                    <Text style={MB.custAvatarText}>{getInitials(c.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={MB.custName}>{c.name}</Text>
                    <Text style={MB.custPhone}>{c.phone || 'Chưa có SĐT'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB — nút thêm đơn hàng */}
      {
        role !== 'ctv' && (
          <TouchableOpacity
            style={MB.fab}
            onPress={() => router.push('/addOrder')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )
      }

      {
        (role === 'admin') && (
          <ExportModal visible={exportOpen} onClose={() => setExportOpen(false)} />
        )
      }
    </View >
  ) : (
    <TabScreenLayout>
      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={H.scroll}>
        <View style={H.webBanner}>
          <View>
            <Text style={H.webTitle}>
              Xin chào <Text style={{ color: '#10B981' }}>{userDetail?.role}</Text> {userDetail?.name} 👋
            </Text>
            <Text style={H.webSub}>Tổng quan hoạt động kinh doanh của bạn hôm nay.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {role !== 'giamdoc' &&
              (<NotificationPanel bellColor="#fff" bellSize={22} />
              )}
            {(role === 'admin') && (
              <TouchableOpacity style={H.webBtnSecondary} onPress={() => setExportOpen(true)}>
                <Ionicons name="download-outline" size={15} color="#2563EB" />
                <Text style={H.webBtnSecondaryText}>Xuất dữ liệu</Text>
              </TouchableOpacity>
            )}
            {canAdd(role) && (
              <TouchableOpacity style={H.webBtn} onPress={() => router.push('/addOrder')}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={H.webBtnText}>Đơn hàng mới</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <StatBar stats={statCards} />

        <View style={[H.contentGrid, H.contentGridWeb]}>
          <View style={[H.card, { flex: 1 }]}>
            <Text style={H.cardTitle}>Thao tác nhanh</Text>
            <View style={H.quickGrid}>
              {quickActions.map(a => <QuickAction key={a.name} {...a} />)}
            </View>
            <View style={H.divider} />
            <Text style={H.cardSub}>Khách hàng gần đây</Text>
            {customerLoading ? <Text style={H.emptyText}>Đang tải...</Text>
              : customerList.length === 0 ? <Text style={H.emptyText}>Chưa có khách hàng</Text>
                : customerList.slice(0, 3).map((c, i) => (
                  <View key={c.docId || i} style={H.custRow}>
                    <View style={[H.custAvatar, { backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981'][i % 3] }]}>
                      <Text style={H.custAvatarText}>{getInitials(c.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={H.custName}>{c.name}</Text>
                      <Text style={H.custPhone}>{c.phone || 'Chưa có SĐT'}</Text>
                    </View>
                  </View>
                ))
            }
          </View>

          <View style={[H.card, { flex: 2 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={H.cardTitle}>Đơn Hàng Gần Đây</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/order')}>
                <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '500' }}>Xem tất cả →</Text>
              </TouchableOpacity>
            </View>
            {recentOrders.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                <Ionicons name="receipt-outline" size={28} color="#CBD5E1" />
                <Text style={H.emptyText}>Chưa có đơn hàng</Text>
              </View>
            ) : recentOrders.map(order => {
              const cfg = STATUS_CFG[order.status] || { color: '#64748B', bg: '#F1F5F9', label: order.status || '—' };
              const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
              return (
                <View key={order.id} style={H.orderRow}>
                  <View style={[H.orderDot, { backgroundColor: cfg.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={H.orderId}>#{order.id}</Text>
                    <Text style={H.orderCustomer}>{order.customer}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={H.orderAmt}>{fmtCurrency(total)}</Text>
                    <View style={[H.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[H.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {
        (role === 'admin') && (
          <ExportModal visible={exportOpen} onClose={() => setExportOpen(false)} />
        )
      }
    </TabScreenLayout >
  );
}

// ── Mobile Styles ─────────────────────────────────────────────
const MB = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },

  // Greeting
  greetingCard: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greetingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingSmall: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  greetingName: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  topIconBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Scroll
  scroll: { paddingHorizontal: 14, paddingTop: 14 },

  // Stats
  statsSection: { gap: 8, marginBottom: 20 },
  statCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  statIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  statSub: { fontSize: 10, marginTop: 2 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionLink: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  // Orders card
  orderCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 0.5, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9',
  },
  orderDot: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  orderId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  orderCustomer: { fontSize: 11, color: '#64748B', marginTop: 1 },
  orderAmt: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Customers
  custRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9',
  },
  custAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  custName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  custPhone: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 18,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

// ── Web Styles ────────────────────────────────────────────────
const H = StyleSheet.create({
  scroll: { paddingHorizontal: 32, paddingTop: 28 },
  webBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  webTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
  webSub: { fontSize: 14, color: '#64748B' },
  webBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  webBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  webBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  webBtnSecondaryText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  contentGrid: { flexDirection: 'column', gap: 16 },
  contentGridWeb: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  card: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  cardSub: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { width: '47%', alignItems: 'center', padding: 14, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  quickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  custRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  custAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  custName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  custPhone: { fontSize: 11, color: '#94A3B8' },
  orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: 10 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  orderCustomer: { fontSize: 12, color: '#64748B', marginTop: 1 },
  orderAmt: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});