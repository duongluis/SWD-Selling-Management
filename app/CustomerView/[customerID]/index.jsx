import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const customer = {
  name: 'Lê Hoàng Nam',
  tier: 'THÀNH VIÊN PLATINUM',
  tierColor: '#FFD700',
  tierBg: '#FFF8E1',
  note: 'Khách hàng ưu tiên • Tham gia từ T10, 2022',
  phone: '0901234567',
  totalSpent: '42.500.000đ',
  totalOrders: 24,
  initials: 'LN',
  avatarColor: '#2196F3',
};

const recentOrders = [
  {
    id: 'ORD-88291',
    date: '24/05/2024',
    items: 3,
    amount: '2.450.000đ',
    status: 'HOÀN THÀNH',
    statusColor: '#4CAF50',
    statusBg: '#E8F5E9',
    icon: 'receipt-outline',
    iconColor: '#4CAF50',
    iconBg: '#E8F5E9',
  },
  {
    id: 'ORD-88102',
    date: '12/05/2024',
    items: 1,
    amount: '15.200.000đ',
    status: 'ĐANG GIAO',
    statusColor: '#2196F3',
    statusBg: '#E3F2FD',
    icon: 'cube-outline',
    iconColor: '#2196F3',
    iconBg: '#E3F2FD',
  },
  {
    id: 'ORD-87944',
    date: '28/04/2024',
    items: 5,
    amount: '850.000đ',
    status: 'HOÀN THÀNH',
    statusColor: '#4CAF50',
    statusBg: '#E8F5E9',
    icon: 'receipt-outline',
    iconColor: '#4CAF50',
    iconBg: '#E8F5E9',
  },
];

// Mở ứng dụng điện thoại
const handleCall = async (phone) => {
  const url = `tel:${phone}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch (e) {
    console.error('Không thể gọi điện:', e);
  }
};

// Mở Zalo chat
const handleZalo = async (phone) => {
  const zaloUrl = `zalo://chat?phone=${phone}`;
  const fallback = `https://zalo.me/${phone}`;
  try {
    const can = await Linking.canOpenURL(zaloUrl);
    await Linking.openURL(can ? zaloUrl : fallback);
  } catch (e) {
    console.error('Không mở được Zalo:', e);
  }
};

// Gửi tin nhắn SMS
const handleSMS = async (phone) => {
  const url = `sms:${phone}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch (e) {
    console.error('Không thể gửi SMS:', e);
  }
};

export default function customerView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showAllOrders, setShowAllOrders] = useState(false);

  const displayedOrders = showAllOrders ? recentOrders : recentOrders.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin khách hàng</Text>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar & Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: customer.avatarColor }]}>
              <Text style={styles.avatarText}>{customer.initials}</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.customerName}>{customer.name}</Text>
          <View style={[styles.tierBadge, { backgroundColor: customer.tierBg }]}>
            <Text style={[styles.tierText, { color: customer.tierColor }]}>{customer.tier}</Text>
          </View>
          <Text style={styles.customerNote}>{customer.note}</Text>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCall(customer.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={16} color="#1A1A2E" />
              <Text style={styles.actionBtnText}>Gọi điện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleSMS(customer.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#1A1A2E" />
              <Text style={styles.actionBtnText}>Gửi tin nhắn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.zaloBtn]}
              onPress={() => handleZalo(customer.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#0068FF" />
              <Text style={[styles.actionBtnText, { color: '#0068FF' }]}>Zalo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsCardOverlay} />
          <View style={styles.statsTop}>
            <Text style={styles.statsLabel}>Tổng chi tiêu</Text>
          </View>
          <Text style={styles.statsAmount}>{customer.totalSpent}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsSubLabel}>Đơn hàng đã mua</Text>
            <View style={styles.orderCountBadge}>
              <Text style={styles.orderCountText}>{customer.totalOrders} Đơn</Text>
            </View>
          </View>
        </View>

        {/* View Detail Button */}
        <TouchableOpacity style={styles.detailBtn} activeOpacity={0.8}>
          <Ionicons name="document-text-outline" size={18} color="#2196F3" />
          <Text style={styles.detailBtnText}>Xem chi tiết liên hệ</Text>
          <Ionicons name="chevron-forward" size={18} color="#2196F3" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
            <TouchableOpacity onPress={() => setShowAllOrders(!showAllOrders)}>
              <Text style={styles.viewAll}>{showAllOrders ? 'Thu gọn' : 'Xem tất cả'}</Text>
            </TouchableOpacity>
          </View>

          {displayedOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard} activeOpacity={0.75}>
              <View style={[styles.orderIconWrap, { backgroundColor: order.iconBg }]}>
                <Ionicons name={order.icon} size={18} color={order.iconColor} />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderId}>#{order.id}</Text>
                <Text style={styles.orderMeta}>{order.date} • {order.items} sản phẩm</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{order.amount}</Text>
                <View style={[styles.statusBadge, { backgroundColor: order.statusBg }]}>
                  <Text style={[styles.statusText, { color: order.statusColor }]}>{order.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },

  scroll: {
    paddingHorizontal: 16,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#E3F2FD',
  },
  avatarText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  customerNote: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 16,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  zaloBtn: {
    borderColor: '#0068FF',
    backgroundColor: '#EEF4FF',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#1565C0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1565C0',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statsCardOverlay: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statsTop: {
    marginBottom: 4,
  },
  statsLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  statsAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsSubLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  orderCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  orderCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Detail Button
  detailBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },

  // Order Card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  orderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  orderMeta: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  orderAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});