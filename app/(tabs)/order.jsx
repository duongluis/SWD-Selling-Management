import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === "web";

// ── Role helper (giống customer.jsx) ─────────────────────────
const getRole = (userDetail) => {
  const r = (userDetail?.role || userDetail?.member || "").toLowerCase();
  if (r === "admin") return "admin";
  if (["đại lý", "daily", "dealer"].includes(r)) return "daily";
  if (["nhà phân phối", "phantan", "distributor"].includes(r)) return "phantan";
  if (["cộng tác viên", "ctv", "collaborator"].includes(r)) return "ctv";
  return "other";
};

const STATUS_CONFIG = {
  PENDING: { color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: "Chờ lắp đặt", icon: "time-outline" },
  SHIPPED: { color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", label: "Đang giao hàng", icon: "car-outline" },
  CONFIRMED: { color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", label: "Đã thanh toán", icon: "card-outline" },
  COMPLETED: { color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", label: "Hoàn thành", icon: "checkmark-circle" },
};

const TABS = ["All", "PENDING", "SHIPPED", "CONFIRMED", "COMPLETED"];
const TAB_LABELS = {
  All: "Tất cả", PENDING: "Chờ lắp đặt", SHIPPED: "Đang giao hàng",
  CONFIRMED: "Đã thanh toán", COMPLETED: "Hoàn thành",
};

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

export default function OrderView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ── Fetch orders — giống customer.jsx ────────────────────
  // Bước 1: lấy danh sách customers theo role
  // Bước 2: lấy orders theo phone của từng customer
  const fetchOrders = useCallback(async () => {
    if (!userDetail?.email) return;
    const myEmail = userDetail.email;

    try {
      // ── Lấy danh sách customers theo role ────────────────
      const customerMap = new Map(); // phone → customer

      if (role === "admin") {
        const snap = await getDocs(collection(db, "customers"));
        snap.docs.forEach(d => {
          const c = d.data();
          if (c.phone) customerMap.set(c.phone, c);
        });

      } else if (role === "ctv") {
        const snap = await getDocs(
          query(collection(db, "customers"), where("createdBy", "==", myEmail))
        );
        snap.docs.forEach(d => {
          const c = d.data();
          if (c.phone) customerMap.set(c.phone, c);
        });

      } else if (role === "daily" || role === "phantan") {
        // Của mình
        const selfSnap = await getDocs(
          query(collection(db, "customers"), where("createdBy", "==", myEmail))
        );
        selfSnap.docs.forEach(d => {
          const c = d.data();
          if (c.phone) customerMap.set(c.phone, c);
        });

        // Tài khoản con
        const subSnap = await getDocs(
          query(collection(db, "users"), where("advisor", "==", myEmail))
        );
        const subEmails = subSnap.docs.map(d => d.data().email).filter(Boolean);

        for (let i = 0; i < subEmails.length; i += 30) {
          const chunk = subEmails.slice(i, i + 30);
          const snap = await getDocs(
            query(collection(db, "customers"), where("createdBy", "in", chunk))
          );
          snap.docs.forEach(d => {
            const c = d.data();
            if (c.phone) customerMap.set(c.phone, c);
          });
        }
      }

      // ── Lấy orders theo phone ─────────────────────────────
      const phones = [...customerMap.keys()];
      const allOrders = [];

      await Promise.all(
        phones.map(async (phone) => {
          try {
            const snap = await getDoc(doc(db, "orders", phone));
            if (!snap.exists()) return;
            (snap.data().orders || []).forEach(o => allOrders.push(o));
          } catch (_) { }
        })
      );

      // Sort mới nhất trước
      allOrders.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const db2 = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return db2 - da;
      });

      setOrders(allOrders);
    } catch (e) {
      console.error("Lỗi fetch orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userDetail?.email, role]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Filter ────────────────────────────────────────────────
  const filteredOrders = orders.filter(order => {
    const matchFilter = filter === "All" || order.status === filter;
    const matchSearch =
      (order.customer || "").toLowerCase().includes(search.toLowerCase()) ||
      (order.id || "").includes(search);
    return matchFilter && matchSearch;
  });

  const formatAmount = (items) => {
    if (!items?.length) return "0đ";
    return items.reduce((s, p) => s + (p.price * p.qty || 0), 0)
      .toLocaleString("vi-VN", { style: "currency", currency: "VND" });
  };

  const counts = {
    All: orders.length,
    PENDING: orders.filter(o => o.status === "PENDING").length,
    SHIPPED: orders.filter(o => o.status === "SHIPPED").length,
    CONFIRMED: orders.filter(o => o.status === "CONFIRMED").length,
    COMPLETED: orders.filter(o => o.status === "COMPLETED").length,
  };

  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0), 0
  );

  const renderOrder = ({ item, index }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.orderRow}
        onPress={() => router.push({
          pathname: "/OrderView/[orderID]",
          params: { orderID: item?.id, orderParam: JSON.stringify(item) },
        })}
      >
        <View style={[styles.orderAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
          <Text style={styles.orderAvatarText}>{getInitials(item.customer)}</Text>
        </View>

        <View style={[styles.orderInfo, isWeb && { flex: 2 }]}>
          <Text style={styles.orderIdText}>Đơn hàng #{item.id}</Text>
          <Text style={styles.orderCustomer}>{item.customer}</Text>
        </View>

        {isWeb && (
          <Text style={styles.orderDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "—"}
          </Text>
        )}
        {isWeb && (
          <Text style={styles.orderItems}>{item.items?.length || 0} sản phẩm</Text>
        )}

        <Text style={[styles.orderAmount, isWeb && { flex: 1 }]}>
          {formatAmount(item.items)}
        </Text>

        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {!isWeb && (
            <View style={styles.headerLeft}>
              <Ionicons name="receipt-outline" size={22} color={Colors.Primary} />
            </View>
          )}
          <Text style={styles.title}>Đơn hàng</Text>
          <Text style={styles.headerCount}>{orders.length} đơn hàng</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/addOrder")} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color={Colors.White} />
          {isWeb && <Text style={styles.addBtnText}>Tạo đơn hàng</Text>}
        </TouchableOpacity>
      </View>

      {/* Stats — web only */}
      {isWeb && (
        <View style={styles.statsRow}>
          {[
            { icon: "receipt-outline", color: "#3B82F6", bg: "#EFF6FF", value: orders.length, label: "Tổng đơn hàng" },
            { icon: "time-outline", color: "#F59E0B", bg: "#FFFBEB", value: counts.PENDING, label: "Chờ lắp đặt" },
            { icon: "car-outline", color: "#3B82F6", bg: "#EFF6FF", value: counts.SHIPPED, label: "Đang giao" },
            { icon: "cash-outline", color: "#10B981", bg: "#ECFDF5", value: totalRevenue.toLocaleString("vi-VN", { style: "currency", currency: "VND" }), label: "Doanh thu" },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchBar}
            placeholder="Tìm kiếm đơn hàng..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, filter === tab && styles.activeTabItem]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.tabText, filter === tab && styles.activeTabText]}>
                {TAB_LABELS[tab]}
                {counts[tab] > 0 && filter !== tab && (
                  <Text style={styles.tabCount}> {counts[tab]}</Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Table header — web */}
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

      {/* List */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.emptyText}>Đang tải đơn hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
            />
          }
          contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100, gap: 6 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {orders.length === 0 ? "Chưa có đơn hàng nào" : "Không tìm thấy đơn hàng"}
              </Text>
              <Text style={styles.emptySubtitle}>Tạo đơn hàng mới để bắt đầu</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30, width: isWeb ? "100%" : Dimensions.get("window").width },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isWeb ? 24 : 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { fontSize: isWeb ? 28 : 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8, shadowColor: "#2563EB", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 1 },
  toolbar: { gap: 10, marginBottom: 12 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  searchBar: { flex: 1, fontSize: 14, color: "#0F172A" },
  tabsScroll: { flexGrow: 0 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, backgroundColor: "#FFFFFF", marginRight: 6, borderWidth: 1, borderColor: "#E2E8F0" },
  activeTabItem: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  activeTabText: { color: "#FFFFFF" },
  tabCount: { fontSize: 11, color: "#94A3B8" },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, marginBottom: 4 },
  thCell: { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
  orderRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  orderAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  orderAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  orderInfo: { flex: 1 },
  orderIdText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  orderCustomer: { fontSize: 12, color: "#64748B", marginTop: 2 },
  orderDate: { flex: 1, fontSize: 12, color: "#64748B" },
  orderItems: { flex: 1, fontSize: 12, color: "#94A3B8" },
  orderAmount: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: "#94A3B8" },
  emptyText: { fontSize: 14, color: Colors.LightGray, fontWeight: "500", marginTop: 8 },
});