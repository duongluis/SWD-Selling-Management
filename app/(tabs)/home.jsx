import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebaseConfig';

export default function HomeView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);

  const customerList = userDetail?.customer || [];
  const totalCustomers = customerList.length;

  const fetchOrders = async () => {
    try {
      if (customerList.length === 0) return;

      const customerPhone = customerList.map(c => c.phone).filter(Boolean);
      const allOrders = [];

      for (const name of customerPhone) {
        try {
          const snap = await getDoc(
            doc(db, 'orders', name)
          )

          console.log("doc data: ", snap.data())

          const workingOrder = snap.data().orders;
          workingOrder.forEach(orderSnap => {
            console.log("doc data o home: ", orderSnap)
            allOrders.push(orderSnap)
          })
        } catch (e) { }
      }

      const revenue = allOrders.reduce((sum, order) => {
        const orderTotal = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
        return sum + orderTotal;
      }, 0);

      allOrders.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const db2 = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return db2 - da;
      });

      setTotalOrders(allOrders.length);
      setTotalRevenue(revenue);
      setRecentOrders(allOrders.slice(0, 2));
    } catch (e) {
      console.error('❌ Lỗi fetch orders:', e);
    }
  };

  useEffect(() => {
    if (!userDetail) return;

    fetchOrders();
  }, [userDetail]);

  const formatCurrency = (n) =>
    n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  const STATUS_CONFIG = {
    PENDING: { icon: 'time-outline', color: Colors.Warning, bg: Colors.WarningLight },
    SHIPPED: { icon: 'car-outline', color: Colors.Primary, bg: Colors.PrimaryLight },
    COMPLETED: { icon: 'checkmark-circle', color: Colors.Success, bg: Colors.SuccessLight },
    CONFIRMED: { icon: 'checkmark-circle', color: Colors.Success, bg: Colors.SuccessLight },
  };

  const quickActions = [
    { name: 'Thêm đơn hàng', icon: 'cart-outline', action: () => router.push('/addOrder') },
    { name: 'Thêm khách hàng', icon: 'person-add-outline', action: () => router.push('/addCustomer') },
    { name: 'Báo cáo doanh thu', icon: 'podium-outline', action: () => console.log('Report') },
    { name: 'Quản lý', icon: 'people-outline', action: () => console.log('Staff') },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={Colors.White} />
          </View>
          <View>
            <Text style={styles.dashboardLabel}>DASHBOARD</Text>
            <Text style={styles.userName}>{userDetail?.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={22} color={Colors.TextPrimary} />
        </TouchableOpacity>
      </View>

      {/* Daily Summary */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>DOANH THU HÀNG NGÀY</Text>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>CẬP NHẬT GẦN ĐÂY</Text>
        </View>
      </View>

      {/* Sales Card */}
      <View style={styles.salesCard}>
        <View style={styles.salesCardTopRow}>
          <Text style={styles.salesCardLabel}>Tổng doanh thu</Text>
          <Ionicons name="stats-chart-outline" size={18} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={styles.salesAmount}>{formatCurrency(totalRevenue)}</Text>
        <View style={styles.percentBadge}>
          <Ionicons name="receipt-outline" size={13} color={Colors.White} />
          <Text style={styles.percentText}> {totalOrders} đơn hàng</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="receipt-outline" size={18} color={Colors.LightBlue} style={styles.statIconWrap} />
          <Text style={styles.statNumber}>{totalOrders}</Text>
          <Text style={styles.statLabel}>TỔNG SỐ ĐƠN HÀNG</Text>
        </View>
        <View style={[styles.statBox, { marginLeft: 12 }]}>
          <Ionicons name="people-outline" size={18} color={Colors.LightBlue} style={styles.statIconWrap} />
          <Text style={styles.statNumber}>{totalCustomers}</Text>
          <Text style={styles.statLabel}>TỔNG SỐ KHÁCH HÀNG</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          {quickActions.map((action) => (
            <View key={action.name} style={styles.actionItem}>
              <TouchableOpacity style={styles.actionButton} onPress={action.action}>
                <Ionicons name={action.icon} size={22} color={Colors.LightBlue} />
              </TouchableOpacity>
              <Text style={styles.actionText}>{action.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ĐƠN HÀNG GẦN ĐÂY</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/order') }>
            <Text style={styles.viewAll}>XEM TẤT CẢ</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Ionicons name="receipt-outline" size={32} color={Colors.LightGray} />
            <Text style={styles.emptyActivityText}>Chưa có đơn hàng nào</Text>
          </View>
        ) : (
          recentOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const orderTotal = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
            return (
              <View key={order.id || order.docId} style={styles.activityItem}>
                <View style={[styles.activityIconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>Order #{order.id}</Text>
                  <Text style={styles.activityDetail}>{order.customer}</Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityAmount}>{formatCurrency(orderTotal)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{order.status}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get('window').width,
    backgroundColor: Colors.Background,
    paddingHorizontal: 16,
    paddingTop: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#B0BEC5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dashboardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.Gray,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.TextPrimary,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.White,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.Black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.Gray,
    letterSpacing: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.Success,
    marginRight: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.Success,
    letterSpacing: 0.5,
  },
  salesCard: {
    backgroundColor: Colors.Primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.Primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  salesCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  salesCardLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  salesAmount: {
    color: Colors.White,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  percentText: {
    color: Colors.White,
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.White,
    padding: 14,
    borderRadius: 12,
    shadowColor: Colors.Black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.TextPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.Gray,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButton: {
    backgroundColor: Colors.White,
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.Black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.TextSecondary,
    textAlign: 'center',
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.Primary,
  },
  activityItem: {
    backgroundColor: Colors.White,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.Black,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.TextPrimary,
    marginBottom: 2,
  },
  activityDetail: {
    fontSize: 12,
    color: Colors.Gray,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.TextPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: Colors.White,
    borderRadius: 12,
  },
  emptyActivityText: {
    fontSize: 13,
    color: Colors.LightGray,
    fontWeight: '500',
  },
});