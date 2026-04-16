import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const isWeb = Platform.OS === "web";

const SERVICE_TYPES = {
  INSTALLATION: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    label: "Lắp đặt",
    icon: "build-outline",
  },
  DELIVERY: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    label: "Giao hàng",
    icon: "car-outline",
  },
  MAINTENANCE: {
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    label: "Bảo trì",
    icon: "construct-outline",
  },
  CONSULTING: {
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    label: "Tư vấn",
    icon: "chatbubbles-outline",
  },
};

const STATUS_CONFIG = {
  PENDING: {
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    label: "Chờ xử lý",
    icon: "time-outline",
  },
  PROCESSING: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    label: "Đang xử lý",
    icon: "reload-outline",
  },
  COMPLETED: {
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    label: "Hoàn thành",
    icon: "checkmark-circle",
  },
  CANCELLED: {
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#FECACA",
    label: "Đã hủy",
    icon: "close-circle-outline",
  },
};

const MOCK_SERVICES = [
  {
    id: "SV-001",
    customer: "Nguyễn Văn A",
    type: "INSTALLATION",
    status: "PENDING",
    date: "2024-05-25",
    address: "123 Nguyễn Trãi, Q1",
    note: "Lắp máy lạnh 2HP",
  },
  {
    id: "SV-002",
    customer: "Trần Thị B",
    type: "DELIVERY",
    status: "PROCESSING",
    date: "2024-05-24",
    address: "456 Lê Lợi, Q3",
    note: "Giao tủ lạnh",
  },
  {
    id: "SV-003",
    customer: "Lê Văn C",
    type: "MAINTENANCE",
    status: "COMPLETED",
    date: "2024-05-23",
    address: "789 Trần Hưng Đạo",
    note: "Bảo trì điều hòa",
  },
  {
    id: "SV-004",
    customer: "Phạm Thị D",
    type: "CONSULTING",
    status: "PENDING",
    date: "2024-05-22",
    address: "321 Cộng Hòa, Tân Bình",
    note: "Tư vấn hệ thống",
  },
];

const TABS = ["All", "PENDING", "PROCESSING", "COMPLETED"];

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

const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

export default function ServiceView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const services = MOCK_SERVICES;

  const filteredServices = services.filter((s) => {
    const matchFilter = filter === "All" || s.status === filter;
    const matchSearch =
      (s.customer || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.id || "").includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    All: services.length,
    PENDING: services.filter((s) => s.status === "PENDING").length,
    PROCESSING: services.filter((s) => s.status === "PROCESSING").length,
    COMPLETED: services.filter((s) => s.status === "COMPLETED").length,
  };

  const renderService = ({ item, index }) => {
    const typeCfg = SERVICE_TYPES[item.type] || SERVICE_TYPES.INSTALLATION;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;

    return (
      <TouchableOpacity
        style={styles.serviceRow}
        activeOpacity={0.6}
        onPress={() =>
          router.push({
            pathname: "/ServiceView/[serviceID]",
            params: { serviceID: item?.id, serviceParam: JSON.stringify(item) },
          })
        }
      >
        <View
          style={[
            styles.serviceAvatar,
            { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
          ]}
        >
          <Text style={styles.serviceAvatarText}>
            {getInitials(item.customer)}
          </Text>
        </View>

        <View style={[styles.serviceInfo, isWeb && { flex: 2 }]}>
          <Text style={styles.serviceId}>#{item.id}</Text>
          <Text style={styles.serviceCustomer}>{item.customer}</Text>
        </View>

        <View
          style={[
            styles.typePill,
            { backgroundColor: typeCfg.bg, borderColor: typeCfg.border },
          ]}
        >
          <Ionicons name={typeCfg.icon} size={12} color={typeCfg.color} />
          <Text style={[styles.typePillText, { color: typeCfg.color }]}>
            {typeCfg.label}
          </Text>
        </View>

        {isWeb && (
          <Text style={styles.serviceDate}>
            {item.date ? new Date(item.date).toLocaleDateString("vi-VN") : "—"}
          </Text>
        )}

        {isWeb && (
          <Text style={styles.serviceNote} numberOfLines={1}>
            {item.note || "—"}
          </Text>
        )}

        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: statusCfg.color }]}
          />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.label}
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
          {!isWeb && <Text style={styles.headerSub}>MANAGEMENT</Text>}
          <Text style={styles.headerTitle}>Services</Text>
          <Text style={styles.headerCount}>{services.length} dịch vụ</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/addService")}
        >
          <Ionicons name="add" size={18} color={Colors.White} />
          {isWeb && <Text style={styles.addBtnText}>New Service</Text>}
        </TouchableOpacity>
      </View>

      {/* Stats — web */}
      {isWeb && (
        <View style={styles.statsRow}>
          {Object.entries(SERVICE_TYPES).map(([key, cfg]) => (
            <View key={key} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <View>
                <Text style={styles.statValue}>
                  {services.filter((s) => s.type === key).length}
                </Text>
                <Text style={styles.statLabel}>{cfg.label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm dịch vụ..."
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

        <View style={styles.filterTabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterTab,
                filter === tab && styles.filterTabActive,
              ]}
              onPress={() => setFilter(tab)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === tab && styles.filterTabTextActive,
                ]}
              >
                {tab === "All"
                  ? `Tất cả (${counts.All})`
                  : `${STATUS_CONFIG[tab]?.label} (${counts[tab]})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Table header — web */}
      {isWeb && filteredServices.length > 0 && (
        <View style={styles.tableHeader}>
          <View style={{ width: 36 }} />
          <Text style={[styles.thCell, { flex: 2 }]}>Khách hàng</Text>
          <Text style={[styles.thCell, { width: 110 }]}>Loại dịch vụ</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Ngày</Text>
          <Text style={[styles.thCell, { flex: 2 }]}>Ghi chú</Text>
          <Text style={[styles.thCell, { width: 110 }]}>Trạng thái</Text>
          <View style={{ width: 20 }} />
        </View>
      )}

      {/* List */}
      <FlatList
        data={filteredServices}
        renderItem={renderService}
        keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="build-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {services.length === 0 ? "Chưa có dịch vụ nào" : "Không tìm thấy"}
            </Text>
            <Text style={styles.emptySub}>Tạo dịch vụ mới để bắt đầu</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/addService")}
            >
              <Ionicons name="add" size={16} color={Colors.White} />
              <Text style={styles.emptyBtnText}>Tạo dịch vụ</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: isWeb ? 32 : 16,
    paddingTop: isWeb ? 28 : 30,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: isWeb ? 24 : 16,
  },
  headerSub: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
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
  },
  addBtnText: { color: Colors.White, fontSize: 13, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B" },

  toolbar: { gap: 10, marginBottom: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  filterTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  filterTabTextActive: { color: "#FFFFFF", fontWeight: "600" },

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

  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  serviceAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  serviceInfo: { flex: 1 },
  serviceId: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  serviceCustomer: { fontSize: 12, color: "#64748B", marginTop: 1 },
  serviceDate: { flex: 1, fontSize: 12, color: "#64748B" },
  serviceNote: { flex: 2, fontSize: 12, color: "#94A3B8" },

  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 90,
    justifyContent: "center",
  },
  typePillText: { fontSize: 11, fontWeight: "600" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
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
  emptySub: { fontSize: 13, color: "#94A3B8" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyBtnText: { color: Colors.White, fontWeight: "600", fontSize: 13 },
});
