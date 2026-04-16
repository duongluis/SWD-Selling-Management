import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === "web";

const STATUS_CONFIG = {
  PENDING: {
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    label: "Chờ lắp đặt",
    icon: "time-outline",
  },
  SHIPPED: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    label: "Đang giao hàng",
    icon: "car-outline",
  },
  CONFIRMED: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    label: "Đã thanh toán",
    icon: "card-outline",
  },
  COMPLETED: {
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    label: "Hoàn thành",
    icon: "checkmark-circle",
  },
};

const TABS = ["All", "PENDING", "SHIPPED", "CONFIRMED", "COMPLETED"];
const TAB_LABELS = {
  All: "Tất cả",
  PENDING: "Chờ lắp đặt",
  SHIPPED: "Đang giao hàng",
  CONFIRMED: "Đã thanh toán",
  COMPLETED: "Hoàn thành",
};

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
];

export default function OrderView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const customerList = userDetail?.customer || [];
        if (customerList.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const customerPhone = customerList.map((c) => c.phone).filter(Boolean);
        const allOrders = [];

        for (const phone of customerPhone) {
          try {
            const snap = await getDoc(doc(db, "orders", phone));
            if (!snap.exists()) continue;
            const workingOrder = snap.data().orders || [];
            workingOrder.forEach((o) => allOrders.push(o));
          } catch (e) {
            console.log("Không có order cho:", phone);
          }
        }

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
      }
    };

    if (userDetail) fetchOrders();
  }, [userDetail]);

  const filteredOrders = orders.filter((order) => {
    const matchFilter = filter === "All" || order.status === filter;
    const matchSearch =
      (order.customer || "").toLowerCase().includes(search.toLowerCase()) ||
      (order.id || "").includes(search);
    return matchFilter && matchSearch;
  });

  const formatAmount = (items) => {
    if (!items?.length) return "0đ";
    return items
      .reduce((s, p) => s + (p.price * p.qty || 0), 0)
      .toLocaleString("vi-VN", { style: "currency", currency: "VND" });
  };

  const counts = {
    All: orders.length,
    PENDING: orders.filter((o) => o.status === "PENDING").length,
    SHIPPED: orders.filter((o) => o.status === "SHIPPED").length,
    CONFIRMED: orders.filter((o) => o.status === "CONFIRMED").length,
    COMPLETED: orders.filter((o) => o.status === "COMPLETED").length,
  };

  const totalRevenue = orders.reduce(
    (sum, o) =>
      sum + (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0),
    0,
  );

  const renderOrder = ({ item, index }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.orderRow}
        onPress={() =>
          router.push({
            pathname: "/OrderView/[orderID]",
            params: { orderID: item?.id, orderParam: JSON.stringify(item) },
          })
        }
      >
        {/* Avatar */}
        <View
          style={[
            styles.orderAvatar,
            { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
          ]}
        >
          <Text style={styles.orderAvatarText}>
            {getInitials(item.customer)}
          </Text>
        </View>

        {/* Info */}
        <View style={[styles.orderInfo, isWeb && { flex: 2 }]}>
          <Text style={styles.orderIdText}>Đơn hàng #{item.id}</Text>
          <Text style={styles.orderCustomer}>{item.customer}</Text>
        </View>

        {/* Date — web only */}
        {isWeb && (
          <Text style={styles.orderDate}>
            {item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("vi-VN")
              : "—"}
          </Text>
        )}

        {/* Items count — web only */}
        {isWeb && (
          <Text style={styles.orderItems}>
            {item.items?.length || 0} sản phẩm
          </Text>
        )}

        {/* Amount */}
        <Text style={[styles.orderAmount, isWeb && { flex: 1 }]}>
          {formatAmount(item.items)}
        </Text>

        {/* Status */}
        <View
          style={[
            styles.statusPill,
            { backgroundColor: cfg.bg, borderColor: cfg.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
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
              <Ionicons
                name="receipt-outline"
                size={22}
                color={Colors.Primary}
              />
            </View>
          )}
          <Text style={styles.title}>Đơn hàng</Text>
          <Text style={styles.headerCount}>{orders.length} đơn hàng</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/addOrder")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={Colors.White} />
          {isWeb && <Text style={styles.addBtnText}>Tạo đơn hàng</Text>}
        </TouchableOpacity>
      </View>

      {/* Stats — web only */}
      {isWeb && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>Tổng đơn hàng</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.statValue}>{counts.PENDING}</Text>
              <Text style={styles.statLabel}>Chờ lắp đặt</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="car-outline" size={16} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.statValue}>{counts.SHIPPED}</Text>
              <Text style={styles.statLabel}>Đang giao hàng</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="cash-outline" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={styles.statValue}>
                {totalRevenue.toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </Text>
              <Text style={styles.statLabel}>Tổng doanh thu</Text>
            </View>
          </View>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={16}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
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

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, filter === tab && styles.activeTabItem]}
              onPress={() => setFilter(tab)}
            >
              <Text
                style={[styles.tabText, filter === tab && styles.activeTabText]}
              >
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
          <Ionicons
            name="hourglass-outline"
            size={48}
            color={Colors.LightGray}
          />
          <Text style={styles.emptyText}>Đang tải đơn hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item, index) =>
            item.id?.toString() ?? index.toString()
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100, gap: 6 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {orders.length === 0
                  ? "Chưa có đơn hàng nào"
                  : "Không tìm thấy đơn hàng"}
              </Text>
              <Text style={styles.emptySubtitle}>
                Tạo đơn hàng mới để bắt đầu
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: isWeb ? 32 : 16,
    paddingTop: isWeb ? 28 : 30,
    width: isWeb ? "100%" : Dimensions.get("window").width,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: isWeb ? 24 : 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: isWeb ? 28 : 24,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: isWeb ? 14 : 12,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  // Stats
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 1 },

  // Toolbar
  toolbar: { gap: 10, marginBottom: 12 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchBar: { flex: 1, fontSize: 14, color: "#0F172A" },
  tabsScroll: { flexGrow: 0 },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activeTabItem: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  activeTabText: { color: "#FFFFFF" },
  tabCount: { fontSize: 11, color: "#94A3B8" },

  // Table header
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  thCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  // Order row
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  orderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  orderAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  orderInfo: { flex: 1 },
  orderIdText: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  orderCustomer: { fontSize: 12, color: "#64748B", marginTop: 2 },
  orderDate: { flex: 1, fontSize: 12, color: "#64748B" },
  orderItems: { flex: 1, fontSize: 12, color: "#94A3B8" },
  orderAmount: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  // Empty
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: "#94A3B8" },
  emptyText: { fontSize: 14, color: Colors.LightGray, fontWeight: "500" },
});
