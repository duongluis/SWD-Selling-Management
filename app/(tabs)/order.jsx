import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebaseConfig';

const STATUS_CONFIG = {
  PENDING: { color: Colors.Warning, bg: Colors.WarningLight, label: 'Đang chuẩn bị', icon: 'time-outline' },
  SHIPPED: { color: Colors.Primary, bg: Colors.PrimaryLight, label: 'Đang lắp đặt', icon: 'car-outline' },
  COMPLETED: { color: Colors.Success, bg: Colors.SuccessLight, label: 'Hoàn thành', icon: 'checkmark-circle' },
  CONFIRMED: { color: Colors.Success, bg: Colors.SuccessLight, label: 'Xác nhận đơn', icon: 'checkmark-circle' },
};

const TABS = ['All', 'PENDING', 'SHIPPED', 'COMPLETED'];
const TAB_LABELS = { All: 'Tất cả', PENDING: 'Đang chuẩn bị', SHIPPED: 'Đang lắp đặt', COMPLETED: 'Hoàn thành' };

export default function OrderView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const customerList = userDetail?.customer || [];
        if (customerList.length === 0) { setOrders([]); setLoading(false); return; }

        const customerPhone = customerList.map(c => c.phone).filter(Boolean);

        console.log("danh sach khach hang : ", customerPhone);
        
        const allOrders = [];

        //
        for (const name of customerPhone) {
          try {
            const snap = await getDoc(
              doc(db, 'orders', name)
            );

            // console.log("doc data: ", snap.data())

            const workingOrder = snap.data().orders;
            workingOrder.forEach(orderSnap => {
              // console.log("doc data bên trong: ", orderSnap)
              allOrders.push(orderSnap)
            })

            console.log("danh sach don hang: ", allOrders)

          } catch (e) {

            console.log('Không có order cho:', name);
            
            console.log(e);
          }
        }

        // Sort mới nhất lên đầu
        allOrders.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const db2 = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return db2 - da;
        });

        setOrders(allOrders);
      } catch (e) {
        console.error(' Lỗi fetch orders:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [userDetail]);

  const filteredOrders = orders.filter(order => {
    const matchFilter = filter === 'All' || order.status === filter;
    const matchSearch =
      (order.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (order.id || '').includes(search);
    return matchFilter && matchSearch;
  });

  const formatAmount = (items) => {
    if (!items || items.length === 0) return '0đ';
    const total = items.reduce((sum, p) => sum + (p.price * p.qty || 0), 0);
    return total.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  };

  const renderOrder = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    console.log("item: ", item)
    return (
      // ✅ Bọc card bằng TouchableOpacity
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push({
          pathname: '/OrderView/[orderID]' ,
          params: {orderID: item?.id, orderParam: JSON.stringify(item) }
        })}
      >
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={[styles.orderIcon, { backgroundColor: cfg.color + '22' }]}>
              <Ionicons name={cfg.icon} size={22} color={cfg.color} />
            </View>
            <View style={styles.orderMid}>
              <Text style={styles.orderNumber}>Đơn hàng số {item.id}</Text>
              <Text style={styles.orderDate}>
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('vi-VN')
                  : 'Chưa có ngày'}
              </Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.amountText}>{formatAmount(item.items)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.orderBottom}>
            <Ionicons name="person-outline" size={16} color={Colors.Gray} />
            <Text style={styles.customerName}>{item.customer}</Text>
            {item.items?.length > 0 && (
              <Text style={styles.itemCount}>{item.items.length} sản phẩm</Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={Colors.LightGray} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="receipt-outline" size={22} color={Colors.Primary} />
          <Text style={styles.title}>Đơn hàng</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/addOrder')} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color={Colors.White} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={Colors.Gray} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchBar}
          placeholder="Tìm kiếm đơn hàng..."
          placeholderTextColor={Colors.LightGray}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.Gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, filter === tab && styles.activeTabItem]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.activeTabText]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="hourglass-outline" size={48} color={Colors.LightGray} />
          <Text style={styles.emptyText}>Đang tải đơn hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.LightGray} />
              <Text style={styles.emptyText}>
                {orders.length === 0 ? 'Chưa có đơn hàng nào' : 'Không tìm thấy đơn hàng'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.BackgroundGray, paddingHorizontal: 16, paddingTop: 30, width: Dimensions.get('window').width },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.TextPrimary, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.Primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.Primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.White, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14, shadowColor: Colors.Black, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  searchBar: { flex: 1, fontSize: 14, color: Colors.TextPrimary },
  tabsRow: { flexDirection: 'row', marginBottom: 16, gap: 6 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.White, shadowColor: Colors.Black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  activeTabItem: { backgroundColor: Colors.TextPrimary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.Gray },
  activeTabText: { color: Colors.White },
  orderCard: { backgroundColor: Colors.White, borderRadius: 16, overflow: 'hidden', shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  orderIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  orderMid: { flex: 1 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: Colors.TextPrimary, marginBottom: 3 },
  orderDate: { fontSize: 12, color: Colors.Gray },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  amountText: { fontSize: 14, fontWeight: '800', color: Colors.TextPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: Colors.BackgroundGray, marginHorizontal: 14 },
  orderBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  customerName: { flex: 1, fontSize: 13, color: Colors.TextSecondary, fontWeight: '500' },
  itemCount: { fontSize: 11, color: Colors.Gray, marginRight: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.LightGray, fontWeight: '500' },
});