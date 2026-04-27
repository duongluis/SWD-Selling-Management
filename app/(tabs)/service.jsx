import { db } from "@/config/firebaseConfig";
import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import {
  SERVICE_TYPE_TO_CATEGORY,
  getStatusConfig,
  useMultiStatusList,
} from "../../components/Hooks/getStatus";
import { getRole } from "../../components/Hooks/useCustomers";

const isWeb = Platform.OS === "web";
const BG_IMAGE = require('../../assets/images/logo-light.png');

const SERVICE_TYPES = {
  INSTALLATION: { color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", label: "Lắp đặt", icon: "build-outline" },
  DELIVERY: { color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", label: "Giao hàng", icon: "car-outline" },
  MAINTENANCE: { color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: "Bảo dưỡng", icon: "construct-outline" },
  CONSULTING: { color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", label: "Tư vấn", icon: "chatbubbles-outline" },
};

const ALL_SVC_CATEGORIES = Object.values(SERVICE_TYPE_TO_CATEGORY);
const TABS = ["All", "Chờ xử lý", "Đang xử lý", "Hoàn thành", "Đã hủy"];

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

// ── Hook fetch services ───────────────────────────────────────
function useServices() {
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    if (!userDetail?.email) return;
    const myEmail = userDetail.email;
    const all = [];
    try {
      if (role === "admin") {
        (await getDocs(collection(db, "service"))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
      } else if (role === "ctv") {
        (await getDocs(query(collection(db, "service"), where("createdBy", "==", myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
      } else if (role === "daily" || role === "phantan") {
        (await getDocs(query(collection(db, "service"), where("createdBy", "==", myEmail)))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        const subs = (await getDocs(query(collection(db, "users"), where("advisor", "==", myEmail)))).docs.map(d => d.data().email).filter(Boolean);
        for (let i = 0; i < subs.length; i += 30) {
          (await getDocs(query(collection(db, "service"), where("createdBy", "in", subs.slice(i, i + 30))))).docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        }
      }
      const map = new Map();
      all.forEach(s => map.set(s.docId, s));
      setServices([...map.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    } catch (e) { console.error("useServices error:", e); }
    finally { setLoading(false); }
  }, [userDetail?.email, role]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  // ✅ Auto-refresh mỗi khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      fetchServices();
    }, [fetchServices])
  );
  return { services, loading, refresh: fetchServices };
}

// ── Main ─────────────────────────────────────────────────────
export default function ServiceView() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const { services, loading, refresh } = useServices();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const isCTV = role === 'ctv';

  // ✅ Load tất cả 4 category status một lần, có cache
  const { statusMap } = useMultiStatusList(ALL_SVC_CATEGORIES);

  const getStatusList = (svcType) => statusMap[SERVICE_TYPE_TO_CATEGORY[svcType]] || [];

  const filteredServices = services.filter(s => {
    const matchFilter = filter === "All" || s.status === filter;
    const matchSearch = (s.customer || "").toLowerCase().includes(search.toLowerCase()) || (s.id || "").includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    All: services.length,
    "Chờ xử lý": services.filter(s => s.status === "Chờ xử lý").length,
    "Đang xử lý": services.filter(s => s.status === "Đang xử lý").length,
    "Hoàn thành": services.filter(s => s.status === "Hoàn thành").length,
    "Đã hủy": services.filter(s => s.status === "Đã hủy").length,
  };

  const renderService = ({ item, index }) => {
    const typeCfg = SERVICE_TYPES[item.type] || SERVICE_TYPES.INSTALLATION;
    // ✅ Lấy status config từ DB theo loại dịch vụ
    const statusCfg = getStatusConfig(item.status, getStatusList(item.type));

    return (
      <TouchableOpacity
        style={styles.serviceRow}
        activeOpacity={0.6}
        onPress={() => router.push({
          pathname: "/ServiceView/[serviceID]",
          params: { serviceID: item?.id, serviceParam: JSON.stringify(item) },
        })}
      >
        <View style={[styles.serviceAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
          <Text style={styles.serviceAvatarText}>{getInitials(item.customer)}</Text>
        </View>
        <View style={[styles.serviceInfo, isWeb && { flex: 2 }]}>
          <Text style={styles.serviceId}>#{item.id}</Text>
          <Text style={styles.serviceCustomer}>{item.customer}</Text>
        </View>
        <View style={[styles.typePill, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
          <Ionicons name={typeCfg.icon} size={12} color={typeCfg.color} />
          <Text style={[styles.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
        </View>
        {isWeb && <Text style={styles.serviceDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "—"}</Text>}
        {isWeb && <Text style={styles.serviceNote} numberOfLines={1}>{item.note || "—"}</Text>}
        {/* ✅ Status từ DB */}
        <View style={[styles.statusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <Image source={BG_IMAGE} style={styles.watermark} resizeMode="contain" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            {!isWeb && <Text style={styles.headerSub}>MANAGEMENT</Text>}
            <Text style={styles.headerTitle}>Dịch vụ</Text>
            <Text style={styles.headerCount}>{loading ? "Đang tải..." : `${services.length} dịch vụ`}</Text>
          </View>
          {!isCTV && (
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/addService")}>
              <Ionicons name="add" size={18} color={Colors.White} />
              {isWeb && <Text style={styles.addBtnText}>Đăng kí dịch vụ</Text>}
            </TouchableOpacity>
          )}
        </View>

        {isWeb && (
          <View style={styles.statsRow}>
            {Object.entries(SERVICE_TYPES).map(([key, cfg]) => (
              <View key={key} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: cfg.bg }]}><Ionicons name={cfg.icon} size={16} color={cfg.color} /></View>
                <View><Text style={styles.statValue}>{services.filter(s => s.type === key).length}</Text><Text style={styles.statLabel}>{cfg.label}</Text></View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#94A3B8" />
            <TextInput style={styles.searchInput} placeholder="Tìm dịch vụ..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#94A3B8" /></TouchableOpacity>}
          </View>
          <View style={styles.filterTabs}>
            {TABS.map(tab => (
              <TouchableOpacity key={tab} style={[styles.filterTab, filter === tab && styles.filterTabActive]} onPress={() => setFilter(tab)}>
                <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                  {tab === "All" ? `Tất cả (${counts.All})` : `${tab} (${counts[tab] || 0})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isWeb && filteredServices.length > 0 && (
          <View style={styles.tableHeader}>
            <View style={{ width: 36 }} />
            <Text style={[styles.thCell, { flex: 2 }]}>Khách hàng</Text>
            <Text style={[styles.thCell, { width: 110 }]}>Loại dịch vụ</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Ngày</Text>
            <Text style={[styles.thCell, { flex: 2 }]}>Ghi chú</Text>
            <Text style={[styles.thCell, { width: 130 }]}>Trạng thái</Text>
            <View style={{ width: 20 }} />
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#2563EB" /><Text style={styles.loadingText}>Đang tải dịch vụ...</Text></View>
        ) : (
          <FlatList
            data={filteredServices}
            renderItem={renderService}
            keyExtractor={(item, i) => item.docId ?? item.id?.toString() ?? String(i)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
            onRefresh={refresh}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}><Ionicons name="build-outline" size={32} color="#94A3B8" /></View>
                <Text style={styles.emptyTitle}>{services.length === 0 ? "Chưa có dịch vụ nào" : "Không tìm thấy"}</Text>
                <Text style={styles.emptySub}>Tạo dịch vụ mới để bắt đầu</Text>
                {!isCTV && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/addService")}>
                    <Ionicons name="add" size={16} color={Colors.White} />
                    <Text style={styles.emptyBtnText}>Tạo dịch vụ</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  watermark: { position: "absolute", width: "80%", height: "60%", top: "20%", left: "10%", opacity: 0.05 },
  container: { flex: 1, backgroundColor: "transparent", paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isWeb ? 24 : 16 },
  headerSub: { fontSize: 10, color: "#94A3B8", fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: isWeb ? 28 : 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8 },
  addBtnText: { color: Colors.White, fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  statIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B" },
  toolbar: { gap: 10, marginBottom: 12 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  filterTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  filterTabTextActive: { color: "#FFFFFF", fontWeight: "600" },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, marginBottom: 4 },
  thCell: { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
  serviceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  serviceAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  serviceAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  serviceInfo: { flex: 1 },
  serviceId: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  serviceCustomer: { fontSize: 12, color: "#64748B", marginTop: 1 },
  serviceDate: { flex: 1, fontSize: 12, color: "#64748B" },
  serviceNote: { flex: 2, fontSize: 12, color: "#94A3B8" },
  typePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, minWidth: 90, justifyContent: "center" },
  typePillText: { fontSize: 11, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: "#94A3B8" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySub: { fontSize: 13, color: "#94A3B8" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  emptyBtnText: { color: Colors.White, fontWeight: "600", fontSize: 13 },
});