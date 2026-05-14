// app/(tabs)/home.jsx — refactored với TabScreenLayout

import { useScreenData } from '@/components/Hooks/useScreenData';
import NotificationPanel from '@/components/Main/NotificationPanel';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import StatBar from '@/components/UI/StatBar';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// ── Quick action ──────────────────────────────────────────────
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

// ── Order status badge ────────────────────────────────────────
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

export default function HomeView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const { data: customerList, loading: customerLoading } = useScreenData('customers');

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  useEffect(() => {
    if (!userDetail || customerLoading || !customerList.length) return;
    const fetchOrders = async () => {
      try {
        const phones = customerList.map(c => c.phone).filter(Boolean);
        const all = [];
        await Promise.all(phones.map(async (phone) => {
          try {
            const snap = await getDoc(doc(db, 'orders', phone));
            if (!snap.exists()) return;
            (snap.data().orders || []).forEach(o => all.push(o));
          } catch (_) { }
        }));
        const revenue = all.reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
        all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setTotalOrders(all.length);
        setTotalRevenue(revenue);
        setRecentOrders(all.slice(0, 5));
      } catch (e) { console.error(e); }
    };
    fetchOrders();
  }, [userDetail, customerList, customerLoading]);

  const quickActions = [
    ...(role !== 'ctv' ? [
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

  return (
    <TabScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={H.scroll}>

        {/* Mobile greeting */}
        {!isWeb && (
          <View style={H.mobileHeader}>
            <View>
              <Text style={H.greeting}>👋 Xin chào {userDetail?.role}</Text>
              <Text style={H.userName}>{userDetail?.name}</Text>
            </View>
            <NotificationPanel bellColor="#0F172A" bellSize={22} />
          </View>
        )}

        {/* Web banner */}
        {isWeb && (
          <View style={H.webBanner}>
            <View>
              <Text style={H.webTitle}>
                Xin chào <Text style={{ color: '#10B981' }}>{userDetail?.role}</Text> {userDetail?.name} 👋
              </Text>
              <Text style={H.webSub}>Tổng quan hoạt động kinh doanh của bạn hôm nay.</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <NotificationPanel bellColor="#0F172A" bellSize={22} />
              {role !== 'ctv' && (
                <TouchableOpacity style={H.webBtn} onPress={() => router.push('/addOrder')}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={H.webBtnText}>Đơn hàng mới</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Stats */}
        <StatBar stats={statCards} />

        {/* Content grid */}
        <View style={[H.contentGrid, isWeb && H.contentGridWeb]}>

          {/* Quick actions */}
          <View style={[H.card, isWeb && { flex: 1 }]}>
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

          {/* Recent orders */}
          <View style={[H.card, isWeb && { flex: 2 }]}>
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

        <View style={{ height: isWeb ? 32 : 100 }} />
      </ScrollView>
    </TabScreenLayout>
  );
}

const H = StyleSheet.create({
  scroll: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 16 },
  mobileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  webBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  webTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
  webSub: { fontSize: 14, color: '#64748B' },
  webBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  webBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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