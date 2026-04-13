import Colors from '@/constant/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_CONFIG = {
  PENDING:   { color: Colors.Warning, bg: Colors.WarningLight, label: 'Đang tạo đơn',   icon: 'time-outline'     },
  SHIPPED:   { color: Colors.Primary, bg: Colors.PrimaryLight, label: 'Đang lắp đặt',   icon: 'car-outline'      },
  COMPLETED: { color: Colors.Success, bg: Colors.SuccessLight, label: 'Hoàn thành',      icon: 'checkmark-circle' },
  CONFIRMED: { color: Colors.Success, bg: Colors.SuccessLight, label: 'Đã xác nhận',     icon: 'checkmark-circle' },
};

export default function OrderDetailView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const order = params.orderParam ? JSON.parse(params.orderParam) : {};
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  const formatCurrency = (n) =>
    (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  const totalAmount = (order.items || []).reduce((sum, p) => sum + (p.price * p.qty || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.Background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>Order #{order.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={13} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}> {cfg.label}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.Gray} />
            <Text style={styles.infoText}>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('vi-VN')
                : 'Chưa có ngày'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={Colors.Gray} />
            <Text style={styles.infoText}>{order.customer || 'Chưa có khách hàng'}</Text>
          </View>
          {order.address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={Colors.Gray} />
              <Text style={styles.infoText}>{order.address}</Text>
            </View>
          ) : null}
          {order.note ? (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={16} color={Colors.Gray} />
              <Text style={styles.infoText}>{order.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Products */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={18} color={Colors.Primary} />
            <Text style={styles.sectionTitle}>Sản phẩm</Text>
          </View>
          {(order.items || []).length === 0 ? (
            <Text style={styles.emptyText}>Chưa có sản phẩm</Text>
          ) : (
            order.items.map((item, index) => (
              <View key={index} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productMeta}>x{item.qty} • {formatCurrency(item.price)}</Text>
                </View>
                <Text style={styles.productTotal}>{formatCurrency(item.price * item.qty)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          <View style={styles.totalOverlay} />
          <Text style={styles.totalLabel}>Tổng cộng</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.totalSub}>{(order.items || []).length} sản phẩm</Text>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.Background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.White, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.Black, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: Colors.TextPrimary },
  scroll:       { paddingHorizontal: 16 },
  card:         { backgroundColor: Colors.White, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderIdRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId:      { fontSize: 18, fontWeight: '800', color: Colors.TextPrimary },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoText:     { fontSize: 14, color: Colors.TextSecondary, flex: 1 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.TextPrimary },
  productRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.DividerLight },
  productInfo:  { flex: 1 },
  productName:  { fontSize: 14, fontWeight: '600', color: Colors.TextPrimary, marginBottom: 3 },
  productMeta:  { fontSize: 12, color: Colors.Gray },
  productTotal: { fontSize: 14, fontWeight: '700', color: Colors.Primary },
  emptyText:    { fontSize: 13, color: Colors.LightGray, textAlign: 'center', paddingVertical: 16 },
  totalCard:    { backgroundColor: Colors.PrimaryDark, borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden', shadowColor: Colors.PrimaryDark, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  totalOverlay: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.07)' },
  totalLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  totalAmount:  { color: Colors.White, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  totalSub:     { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});