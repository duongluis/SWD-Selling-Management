import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

// ── Role helper ───────────────────────────────────────────────
const getRole = (userDetail) => {
  const r = (userDetail?.role || userDetail?.member || "").toLowerCase();
  if (r === "admin") return "admin";
  if (["đại lý", "daily", "dealer"].includes(r)) return "daily";
  if (["nhà phân phối", "phantan", "distributor"].includes(r)) return "phantan";
  if (["cộng tác viên", "ctv", "collaborator"].includes(r)) return "ctv";
  return "other";
};

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).filter(n => n.length > 0)
    .map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

// ── Customer Card ─────────────────────────────────────────────
function CustomerCard({ item, index, onPress }) {
  return (
    <TouchableOpacity style={styles.listRow} activeOpacity={0.6} onPress={() => onPress(item)}>
      <View style={[styles.listAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
        <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.name}</Text>
        <Text style={styles.listSub}>
          {item.phone || "Chưa có SĐT"}
          {item.email ? ` · ${item.email}` : ""}
        </Text>
        {item.address && <Text style={styles.listAddress} numberOfLines={1}>{item.address}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

// ── Section Header ────────────────────────────────────────────
function SectionHeader({ email, name, count }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAvatar}>
        <Text style={styles.sectionAvatarText}>{getInitials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionName}>{name || "Chưa có tên"}</Text>
        <Text style={styles.sectionEmail}>{email}</Text>
      </View>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{count} KH</Text>
      </View>
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function CustomerView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);

  // groups: [{ email, name, customers: [...] }]
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchCustomers = useCallback(async () => {
    if (!userDetail?.email) return;
    const myEmail = userDetail.email;

    try {
      // ────────────────────────────────────────────────────────
      // ADMIN → lấy tất cả
      // ────────────────────────────────────────────────────────
      if (role === "admin") {
        const snap = await getDocs(collection(db, "customers"));
        const all = snap.docs.map(d => ({ ...d.data(), docId: d.id }));

        // Group theo addBy
        const map = new Map();
        all.forEach(c => {
          const key = c.createdBy || "unknown";
          if (!map.has(key)) map.set(key, { email: key, name: key, customers: [] });
          map.get(key).customers.push(c);
        });

        // Lấy tên user cho mỗi group
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.docs.forEach(d => {
          const u = d.data();
          if (map.has(u.email)) {
            map.get(u.email).name = u.name || u.email;
          }
        });

        setGroups([...map.values()]);
        return;
      }

      // ────────────────────────────────────────────────────────
      // CỘNG TÁC VIÊN → chỉ lấy customers addBy === mình
      // ────────────────────────────────────────────────────────
      if (role === "ctv") {
        const snap = await getDocs(
          query(collection(db, "customers"), where("createdBy", "==", myEmail))
        );
        const customers = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
        setGroups([{
          email: myEmail,
          name: userDetail.name || myEmail,
          customers,
          isSelf: true,
        }]);
        return;
      }

      // ────────────────────────────────────────────────────────
      // ĐẠI LÝ / NHÀ PHÂN PHỐI
      // → Lấy khách hàng của chính mình (isSelf)
      // → Bước 1: lấy tài khoản con có advisor === myEmail
      // → Bước 2: lấy customers của từng tài khoản con
      // ────────────────────────────────────────────────────────
      if (role === "daily" || role === "phantan") {

        // Khách hàng của chính mình
        const selfSnap = await getDocs(
          query(collection(db, "customers"), where("createdBy", "==", myEmail))
        );
        const selfCustomers = selfSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

        // Tài khoản con
        const subSnap = await getDocs(
          query(collection(db, "users"), where("advisor", "==", myEmail))
        );
        const subUsers = subSnap.docs.map(d => ({
          email: d.data().email,
          name: d.data().name || d.data().email,
        })).filter(u => u.email);

        // Customers của từng tài khoản con
        const subResults = await Promise.all(
          subUsers.map(async (sub) => {
            const snap = await getDocs(
              query(collection(db, "customers"), where("createdBy", "==", sub.email))
            );
            return {
              email: sub.email,
              name: sub.name,
              customers: snap.docs.map(d => ({ ...d.data(), docId: d.id })),
            };
          })
        );

        setGroups([
          // Bản thân luôn đứng đầu
          {
            email: myEmail,
            name: userDetail.name || myEmail,
            customers: selfCustomers,
            isSelf: true,
          },
          // Tài khoản con — chỉ hiện nếu có khách hàng
          ...subResults.filter(g => g.customers.length > 0),
        ]);
        return;
      }

      setGroups([]);
    } catch (e) {
      console.error("Lỗi fetch customers:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userDetail?.email, role]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ── Filter search ─────────────────────────────────────────
  const filteredGroups = groups.map(g => ({
    ...g,
    customers: search.trim() === ""
      ? g.customers
      : g.customers.filter(c =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search)
      ),
  })).filter(g => g.customers.length > 0 || search.trim() === "");

  const totalCount = groups.reduce((s, g) => s + g.customers.length, 0);

  const handlePress = (item) => {
    router.push({
      pathname: "/CustomerView/[customerID]",
      params: { customerid: item?.docId, customerParam: JSON.stringify(item) },
    });
  };

  if (loading) return (
    <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 14 }}>Đang tải khách hàng...</Text>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          {!isWeb && <Text style={styles.headerSub}>QUẢN LÝ</Text>}
          <Text style={styles.headerTitle}>Khách hàng</Text>
          <Text style={styles.headerCount}>{totalCount} khách hàng · {groups.length} nhóm</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/addCustomer")}>
          <Ionicons name="add" size={18} color={Colors.White} />
          {isWeb && <Text style={styles.addBtnText}>Thêm khách hàng</Text>}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên, SĐT..."
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

      {/* Grouped list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCustomers(); }} />
        }
      >
        {filteredGroups.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>{search ? "Không tìm thấy kết quả" : "Chưa có khách hàng"}</Text>
            <Text style={styles.emptySub}>{search ? "Thử từ khoá khác" : "Thêm khách hàng đầu tiên"}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/addCustomer")}>
                <Ionicons name="add" size={16} color={Colors.White} />
                <Text style={styles.emptyBtnText}>Thêm khách hàng</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredGroups.map((group) => (
            <View key={group.email} style={styles.group}>
              {/* Section header — không hiện nếu là chính mình (CTV) */}
              {!group.isSelf && (
                <SectionHeader
                  email={group.email}
                  name={group.name}
                  count={group.customers.length}
                />
              )}
              {group.customers.map((item, index) => (
                <CustomerCard
                  key={item.docId || index}
                  item={item}
                  index={index}
                  onPress={handlePress}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerSub: { fontSize: 10, color: "#94A3B8", fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: isWeb ? 28 : 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8 },
  addBtnText: { color: Colors.White, fontSize: 13, fontWeight: "600" },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  // Group
  group: { marginBottom: 20 },

  // Section header: "email - tên"
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  sectionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  sectionAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  sectionName: { fontSize: 13, fontWeight: "700", color: "#F8FAFC" },
  sectionEmail: { fontSize: 11, color: "#fff", marginTop: 1 },
  sectionBadge: { backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  sectionBadgeText: { fontSize: 11, color: "#2563EB", fontWeight: "600" },

  // Customer row
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 5, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  listAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  listAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  listSub: { fontSize: 12, color: "#64748B", marginTop: 1 },
  listAddress: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  // Empty
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  emptyBtnText: { color: Colors.White, fontWeight: "600", fontSize: 13 },
});