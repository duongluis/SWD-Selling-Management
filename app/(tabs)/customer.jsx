import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator, Image, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { getRole, useCustomers } from "../../components/Hooks/useCustomers";

const isWeb = Platform.OS === "web";
const BG_IMAGE = require('../../assets/images/logo-light.png');

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).filter(n => n.length > 0).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

function CustomerCard({ item, index, onPress }) {
  return (
    <TouchableOpacity style={styles.listRow} activeOpacity={0.6} onPress={() => onPress(item)}>
      <View style={[styles.listAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
        <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.name}</Text>
        <Text style={styles.listSub}>{item.phone || "Chưa có SĐT"}{item.email ? ` · ${item.email}` : ""}</Text>
        {item.address && <Text style={styles.listAddress} numberOfLines={1}>{item.address}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

function SectionHeader({ email, name, count }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAvatar}><Text style={styles.sectionAvatarText}>{getInitials(name)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionName}>{name || "Chưa có tên"}</Text>
        <Text style={styles.sectionEmail}>{email}</Text>
      </View>
      <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{count} KH</Text></View>
    </View>
  );
}

export default function CustomerView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const { customers, loading, refresh } = useCustomers();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true); await refresh(); setRefreshing(false);
  }, [refresh]);

  const groups = useCallback(() => {
    if (role === "ctv") return [{ email: userDetail?.email, name: userDetail?.name || userDetail?.email, customers, isSelf: true }];
    if (role === "daily" || role === "phantan") {
      const myEmail = userDetail?.email;
      const selfCustomers = customers.filter(c => c.createdBy === myEmail);
      const subMap = new Map();
      customers.forEach(c => {
        if (c.createdBy && c.createdBy !== myEmail) {
          if (!subMap.has(c.createdBy)) subMap.set(c.createdBy, { email: c.createdBy, name: c.createdBy, customers: [] });
          subMap.get(c.createdBy).customers.push(c);
        }
      });
      return [{ email: myEmail, name: userDetail?.name || myEmail, customers: selfCustomers, isSelf: true }, ...[...subMap.values()].filter(g => g.customers.length > 0)];
    }
    if (role === "admin") {
      const map = new Map();
      customers.forEach(c => { const key = c.createdBy || "unknown"; if (!map.has(key)) map.set(key, { email: key, name: key, customers: [] }); map.get(key).customers.push(c); });
      return [...map.values()];
    }
    return [];
  }, [customers, role, userDetail])();

  const filteredGroups = groups.map(g => ({ ...g, customers: search.trim() === "" ? g.customers : g.customers.filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)) })).filter(g => g.customers.length > 0 || search.trim() === "");

  const handlePress = (item) => router.push({ pathname: "/CustomerView/[customerID]", params: { customerid: item?.docId, customerParam: JSON.stringify(item) } });

  if (loading && !refreshing) return (
    <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 14 }}>Đang tải khách hàng...</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <Image source={BG_IMAGE} style={styles.watermark} resizeMode="contain" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            {!isWeb && <Text style={styles.headerSub}>QUẢN LÝ</Text>}
            <Text style={styles.headerTitle}>Khách hàng</Text>
            <Text style={styles.headerCount}>{customers.length} khách hàng · {groups.length} nhóm</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/addCustomer")}>
            <Ionicons name="add" size={18} color={Colors.White} />
            {isWeb && <Text style={styles.addBtnText}>Thêm khách hàng</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput style={styles.searchInput} placeholder="Tìm tên, SĐT..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#94A3B8" /></TouchableOpacity>}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          {filteredGroups.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}><Ionicons name="people-outline" size={32} color="#94A3B8" /></View>
              <Text style={styles.emptyTitle}>{search ? "Không tìm thấy kết quả" : "Chưa có khách hàng"}</Text>
              <Text style={styles.emptySub}>{search ? "Thử từ khoá khác" : "Thêm khách hàng đầu tiên"}</Text>
              {!search && <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/addCustomer")}><Ionicons name="add" size={16} color={Colors.White} /><Text style={styles.emptyBtnText}>Thêm khách hàng</Text></TouchableOpacity>}
            </View>
          ) : (
            filteredGroups.map(group => (
              <View key={group.email} style={styles.group}>
                {!group.isSelf && <SectionHeader email={group.email} name={group.name} count={group.customers.length} />}
                {group.customers.map((item, index) => <CustomerCard key={item.docId || index} item={item} index={index} onPress={handlePress} />)}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" }, watermark: { position: "absolute", width: "80%", height: "60%", top: "20%", left: "10%", opacity: 0.05 },
  container: { flex: 1, backgroundColor: "transparent", paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerSub: { fontSize: 10, color: "#94A3B8", fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: isWeb ? 28 : 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8 },
  addBtnText: { color: Colors.White, fontSize: 13, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  group: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  sectionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  sectionAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" }, sectionName: { fontSize: 13, fontWeight: "700", color: "#F8FAFC" },
  sectionEmail: { fontSize: 11, color: "#fff", marginTop: 1 }, sectionBadge: { backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  sectionBadgeText: { fontSize: 11, color: "#2563EB", fontWeight: "600" },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 5, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
  listAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, listAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listInfo: { flex: 1 }, listName: { fontSize: 14, fontWeight: "600", color: "#0F172A" }, listSub: { fontSize: 12, color: "#64748B", marginTop: 1 }, listAddress: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" }, emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  emptyBtnText: { color: Colors.White, fontWeight: "600", fontSize: 13 },
});