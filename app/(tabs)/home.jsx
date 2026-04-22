import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useCustomers } from "../../components/Hooks/useCustomers";
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === "web";

function StatCard({ icon, label, value, color, bg }) {
  return (
    <View style={[styles.statCard, isWeb && styles.statCardWeb]}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function HomeView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);

  // ✅ Hook tự fetch theo role, dùng field createdBy
  const { customers: customerList, loading: customerLoading } = useCustomers();

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    if (!userDetail || customerLoading || customerList.length === 0) return;

    const fetchOrders = async () => {
      try {
        const phones = customerList.map(c => c.phone).filter(Boolean);
        const allOrders = [];

        await Promise.all(phones.map(async (phone) => {
          try {
            const snap = await getDoc(doc(db, "orders", phone));
            if (!snap.exists()) return;
            (snap.data().orders || []).forEach(o => allOrders.push(o));
          } catch (_) { }
        }));

        const revenue = allOrders.reduce((sum, o) =>
          sum + (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0), 0);

        allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setTotalOrders(allOrders.length);
        setTotalRevenue(revenue);
        setRecentOrders(allOrders.slice(0, 5));
      } catch (e) { console.error(e); }
    };

    fetchOrders();
  }, [userDetail, customerList, customerLoading]);

  const fmt = (n) => (n || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  const STATUS_CONFIG = {
    PENDING: { color: "#F59E0B", bg: "#FFFBEB", label: "Chờ xử lý" },
    SHIPPED: { color: "#3B82F6", bg: "#EFF6FF", label: "Đang giao" },
    COMPLETED: { color: "#10B981", bg: "#ECFDF5", label: "Hoàn thành" },
    CONFIRMED: { color: "#10B981", bg: "#ECFDF5", label: "Xác nhận" },
  };

  const quickActions = [
    { name: "Đơn hàng mới", icon: "add-circle-outline", action: () => router.push("/addOrder"), color: "#3B82F6", bg: "#EFF6FF" },
    { name: "Thêm khách", icon: "person-add-outline", action: () => router.push("/addCustomer"), color: "#8B5CF6", bg: "#F5F3FF" },
    { name: "Báo cáo", icon: "bar-chart-outline", action: () => router.push("/revenue"), color: "#10B981", bg: "#ECFDF5" },
    { name: "Dịch vụ", icon: "construct-outline", action: () => router.push("/addService"), color: "#F59E0B", bg: "#FFFBEB" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {!isWeb && (
        <View style={styles.mobileHeader}>
          <View>
            <Text style={styles.greeting}>Xin chào 👋</Text>
            <Text style={styles.userName}>{userDetail?.name}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.TextPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {isWeb && (
        <View style={styles.welcomeBanner}>
          <View>
            <Text style={styles.welcomeTitle}>Xin chào, {userDetail?.name}</Text>
            <Text style={styles.welcomeSub}>Tổng quan hoạt động kinh doanh của bạn hôm nay.</Text>
          </View>
          <TouchableOpacity style={styles.welcomeBtn} onPress={() => router.push("/addOrder")}>
            <Ionicons name="add" size={16} color={Colors.White} />
            <Text style={styles.welcomeBtnText}>Đơn hàng mới</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.statsGrid, isWeb && styles.statsGridWeb]}>
        <StatCard icon="cash-outline" label="Doanh Thu" value={fmt(totalRevenue)} color="#10B981" bg="#ECFDF5" />
        <StatCard icon="receipt-outline" label="Tổng Đơn Hàng" value={String(totalOrders)} color="#3B82F6" bg="#EFF6FF" />
        <StatCard icon="people-outline" label="Khách Hàng" value={String(customerList.length)} color="#8B5CF6" bg="#F5F3FF" />
        <StatCard icon="trending-up-outline" label="Doanh Thu TB/Đơn" value={totalOrders > 0 ? fmt(totalRevenue / totalOrders) : "0đ"} color="#F59E0B" bg="#FFFBEB" />
      </View>

      <View style={[styles.contentGrid, isWeb && styles.contentGridWeb]}>
        {/* Quick actions */}
        <View style={[styles.card, isWeb && { flex: 1 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Thao tác nhanh</Text>
          </View>
          <View style={styles.quickGrid}>
            {quickActions.map(a => (
              <TouchableOpacity key={a.name} style={styles.quickItem} onPress={a.action} activeOpacity={0.7}>
                <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={20} color={a.color} />
                </View>
                <Text style={styles.quickLabel}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.cardDivider} />
          <Text style={styles.cardSubtitle}>Khách hàng gần đây</Text>
          {customerLoading ? (
            <Text style={styles.emptyText}>Đang tải...</Text>
          ) : customerList.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có khách hàng</Text>
          ) : customerList.slice(0, 3).map((c, i) => (
            <View key={c.docId || i} style={styles.customerRow}>
              <View style={[styles.customerAvatar, { backgroundColor: ["#3B82F6", "#8B5CF6", "#10B981"][i % 3] }]}>
                <Text style={styles.customerAvatarText}>
                  {(c.name || "?").trim().split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{c.name}</Text>
                <Text style={styles.customerPhone}>{c.phone || "Chưa có SĐT"}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent orders */}
        <View style={[styles.card, isWeb && { flex: 2 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Đơn Hàng Gần Đây</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/order")}>
              <Text style={styles.cardLink}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>Chưa có đơn hàng</Text>
            </View>
          ) : recentOrders.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const total = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
            return (
              <View key={order.id} style={styles.orderRow}>
                <View style={[styles.orderDot, { backgroundColor: cfg.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderRowId}>#{order.id}</Text>
                  <Text style={styles.orderRowCustomer}>{order.customer}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.orderRowAmount}>{fmt(total)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: isWeb ? 32 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 16 },
  mobileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  userName: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  welcomeBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  welcomeTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5, marginBottom: 4 },
  welcomeSub: { fontSize: 14, color: "#64748B" },
  welcomeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  welcomeBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  statsGrid: { flexDirection: "column", gap: 10, marginBottom: 20 },
  statsGridWeb: { flexDirection: "row", gap: 16, marginBottom: 24 },
  statCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  statCardWeb: { flex: 1 },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 12, color: "#64748B", fontWeight: "500", marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  contentGrid: { flexDirection: "column", gap: 16 },
  contentGridWeb: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardLink: { fontSize: 13, color: "#3B82F6", fontWeight: "500" },
  cardDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 14 },
  cardSubtitle: { fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5, marginBottom: 10 },
  orderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8FAFC", gap: 10 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderRowId: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  orderRowCustomer: { fontSize: 12, color: "#64748B", marginTop: 1 },
  orderRowAmount: { fontSize: 13, fontWeight: "700", color: "#0F172A", marginBottom: 3 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontWeight: "700" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: { width: "47%", alignItems: "center", padding: 14, backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  quickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#374151", textAlign: "center" },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  customerAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  customerAvatarText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  customerName: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  customerPhone: { fontSize: 11, color: "#94A3B8" },
  emptyCard: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
});