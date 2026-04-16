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

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .filter((n) => n.length > 0)
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

export default function CustomerView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | grid

  const customerList = userDetail?.customer || [];
  const filteredList =
    search.trim() === ""
      ? customerList
      : customerList.filter(
          (c) =>
            (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || "").includes(search),
        );

  const renderListItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.listRow}
      activeOpacity={0.6}
      onPress={() =>
        router.push({
          pathname: "/CustomerView/[customerID]",
          params: { customerid: item?.id, customerParam: JSON.stringify(item) },
        })
      }
    >
      <View
        style={[
          styles.listAvatar,
          { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
        ]}
      >
        <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.name}</Text>
        <Text style={styles.listSub}>
          {item.phone || "No phone"}
          {item.email ? ` · ${item.email}` : ""}
        </Text>
      </View>
      {item.address && (
        <Text style={styles.listAddress} numberOfLines={1}>
          {item.address}
        </Text>
      )}
      <View style={styles.listBadge}>
        <Text style={styles.listBadgeText}>Active</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
    </TouchableOpacity>
  );

  const renderGridItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.gridCard}
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: "/CustomerView/[customerID]",
          params: { customerid: item?.id, customerParam: JSON.stringify(item) },
        })
      }
    >
      <View
        style={[
          styles.gridAvatar,
          { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
        ]}
      >
        <Text style={styles.gridAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <Text style={styles.gridName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.gridSub} numberOfLines={1}>
        {item.phone || "No phone"}
      </Text>
      {item.address && (
        <Text style={styles.gridAddress} numberOfLines={2}>
          {item.address}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {!isWeb && <Text style={styles.headerSub}>MANAGEMENT</Text>}
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerCount}>{customerList.length} total</Text>
        </View>
        <View style={styles.headerActions}>
          {isWeb && (
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[
                  styles.viewBtn,
                  viewMode === "list" && styles.viewBtnActive,
                ]}
                onPress={() => setViewMode("list")}
              >
                <Ionicons
                  name="list-outline"
                  size={16}
                  color={viewMode === "list" ? "#2563EB" : "#64748B"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewBtn,
                  viewMode === "grid" && styles.viewBtnActive,
                ]}
                onPress={() => setViewMode("grid")}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={viewMode === "grid" ? "#2563EB" : "#64748B"}
                />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/addCustomer")}
          >
            <Ionicons name="add" size={18} color={Colors.White} />
            {isWeb && <Text style={styles.addBtnText}>Add Customer</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row — web only */}
      {isWeb && (
        <View style={styles.statsRow}>
          {[
            {
              label: "Total",
              value: customerList.length,
              icon: "people-outline",
              color: "#3B82F6",
              bg: "#EFF6FF",
            },
            {
              label: "This week",
              value: customerList.filter(
                (c) =>
                  c.createdAt &&
                  new Date(c.createdAt) > new Date(Date.now() - 7 * 86400000),
              ).length,
              icon: "time-outline",
              color: "#10B981",
              bg: "#ECFDF5",
            },
            {
              label: "This month",
              value: customerList.filter(
                (c) =>
                  c.createdAt &&
                  new Date(c.createdAt) > new Date(Date.now() - 30 * 86400000),
              ).length,
              icon: "calendar-outline",
              color: "#8B5CF6",
              bg: "#F5F3FF",
            },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Search + filter bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
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
      </View>

      {/* Table header — list mode web */}
      {isWeb && viewMode === "list" && filteredList.length > 0 && (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Contact</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Address</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
          <View style={{ width: 20 }} />
        </View>
      )}

      {/* List */}
      <FlatList
        data={filteredList}
        renderItem={
          isWeb && viewMode === "grid" ? renderGridItem : renderListItem
        }
        keyExtractor={(item, index) => item?.id?.toString() || index.toString()}
        numColumns={isWeb && viewMode === "grid" ? 3 : 1}
        key={isWeb && viewMode === "grid" ? "grid" : "list"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingBottom: isWeb ? 32 : 100 },
          isWeb && viewMode === "grid" && { gap: 12 },
        ]}
        columnWrapperStyle={
          isWeb && viewMode === "grid" ? { gap: 12 } : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? "No results found" : "No customers yet"}
            </Text>
            <Text style={styles.emptySub}>
              {search
                ? "Try a different search term"
                : "Add your first customer to get started"}
            </Text>
            {!search && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/addCustomer")}
              >
                <Ionicons name="add" size={16} color={Colors.White} />
                <Text style={styles.emptyBtnText}>Add Customer</Text>
              </TouchableOpacity>
            )}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },

  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  viewBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },

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

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
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
  statValue: { fontSize: 20, fontWeight: "800", color: "#0F172A", flex: 1 },
  statLabel: { fontSize: 12, color: "#64748B" },

  toolbar: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchWrap: {
    flex: 1,
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

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  // List row
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listInfo: { flex: 2 },
  listName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  listSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  listAddress: { flex: 2, fontSize: 12, color: "#94A3B8" },
  listBadge: {
    flex: 1,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  listBadgeText: { fontSize: 11, fontWeight: "600", color: "#10B981" },

  // Grid card
  gridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  gridAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  gridAvatarText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  gridName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3,
  },
  gridSub: { fontSize: 12, color: "#64748B", marginBottom: 6 },
  gridAddress: { fontSize: 11, color: "#94A3B8" },

  // Empty
  empty: {
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
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
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
