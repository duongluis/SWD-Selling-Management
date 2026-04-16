import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const isWeb = Platform.OS === "web";

const topEmployees = [
  {
    id: "1",
    name: "Alex Johnson",
    earnings: "$15,820",
    rank: 1,
    initials: "AJ",
    orders: 124,
  },
  {
    id: "2",
    name: "Sarah Smith",
    earnings: "$12,450",
    rank: 2,
    initials: "SS",
    orders: 98,
  },
  {
    id: "3",
    name: "Mike Ross",
    earnings: "$10,100",
    rank: 3,
    initials: "MR",
    orders: 81,
  },
];

const otherEmployees = [
  {
    id: "4",
    name: "Emily Davis",
    earnings: "$9,840",
    orders: 42,
    trend: "+2",
    trendUp: true,
  },
  {
    id: "5",
    name: "James Wilson",
    earnings: "$8,920",
    orders: 38,
    trend: "—",
    trendUp: null,
  },
  {
    id: "6",
    name: "Lisa Chen",
    earnings: "$7,650",
    orders: 35,
    trend: "-2",
    trendUp: false,
  },
  {
    id: "7",
    name: "Robert Taylor",
    earnings: "$6,120",
    orders: 31,
    trend: "+4",
    trendUp: true,
  },
];

const RANK_COLORS = { 1: "#F59E0B", 2: "#94A3B8", 3: "#B45309" };
const AVATAR_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
];
const FILTERS = ["This Month", "Last Month", "All Time"];

export default function LeaderboardView() {
  const [filter, setFilter] = useState("This Month");

  const renderOther = ({ item, index }) => {
    const rank = index + 4;
    const trendColor =
      item.trendUp === null ? "#94A3B8" : item.trendUp ? "#10B981" : "#EF4444";
    return (
      <View style={styles.rankRow}>
        <Text style={styles.rankNum}>{rank}</Text>
        <View
          style={[
            styles.rankAvatar,
            {
              backgroundColor: AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length],
            },
          ]}
        >
          <Text style={styles.rankAvatarText}>
            {item.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </Text>
        </View>
        <View style={styles.rankInfo}>
          <Text style={styles.rankName}>{item.name}</Text>
          <Text style={styles.rankOrders}>{item.orders} orders completed</Text>
        </View>
        {isWeb && (
          <View style={styles.rankBar}>
            <View
              style={[
                styles.rankBarFill,
                {
                  width: `${(item.orders / 50) * 100}%`,
                  backgroundColor:
                    AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length],
                },
              ]}
            />
          </View>
        )}
        <Text style={styles.rankEarnings}>{item.earnings}</Text>
        <View
          style={[
            styles.trendPill,
            {
              backgroundColor: item.trendUp
                ? "#ECFDF5"
                : item.trendUp === null
                  ? "#F1F5F9"
                  : "#FEF2F2",
            },
          ]}
        >
          {item.trendUp !== null && (
            <Ionicons
              name={item.trendUp ? "trending-up" : "trending-down"}
              size={12}
              color={trendColor}
            />
          )}
          <Text style={[styles.trendText, { color: trendColor }]}>
            {item.trend}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {!isWeb && <Text style={styles.headerSub}>RANKINGS</Text>}
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerCount}>Top performers this period</Text>
        </View>
        {/* Filter */}
        <View style={styles.filterTabs}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Podium — top 3 */}
      <View style={[styles.podiumCard, isWeb && styles.podiumCardWeb]}>
        <View style={styles.podiumRow}>
          {[topEmployees[1], topEmployees[0], topEmployees[2]].map((emp) => {
            const isFirst = emp.rank === 1;
            return (
              <View
                key={emp.id}
                style={[styles.podiumItem, isFirst && styles.podiumItemFirst]}
              >
                {isFirst && (
                  <View style={styles.crownWrap}>
                    <Text style={styles.crownEmoji}>👑</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.podiumAvatar,
                    isFirst && styles.podiumAvatarFirst,
                    {
                      borderColor: RANK_COLORS[emp.rank] + "40",
                      backgroundColor: RANK_COLORS[emp.rank] + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.podiumAvatarText,
                      isFirst && styles.podiumAvatarTextFirst,
                      { color: RANK_COLORS[emp.rank] },
                    ]}
                  >
                    {emp.initials}
                  </Text>
                  <View
                    style={[
                      styles.rankBadge,
                      { backgroundColor: RANK_COLORS[emp.rank] },
                    ]}
                  >
                    <Text style={styles.rankBadgeText}>{emp.rank}</Text>
                  </View>
                </View>
                <Text
                  style={[styles.podiumName, isFirst && styles.podiumNameFirst]}
                  numberOfLines={1}
                >
                  {emp.name}
                </Text>
                <Text
                  style={[
                    styles.podiumEarnings,
                    isFirst && { color: "#0F172A", fontSize: 16 },
                  ]}
                >
                  {emp.earnings}
                </Text>
                <Text style={styles.podiumOrders}>{emp.orders} orders</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Rankings table */}
      <View style={styles.rankingsCard}>
        {/* Table header */}
        {isWeb && (
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: 32 }]}>#</Text>
            <Text style={[styles.thCell, { flex: 2 }]}>Employee</Text>
            {isWeb && (
              <Text style={[styles.thCell, { flex: 2 }]}>Progress</Text>
            )}
            <Text style={[styles.thCell, { flex: 1 }]}>Revenue</Text>
            <Text style={[styles.thCell, { width: 80 }]}>Trend</Text>
          </View>
        )}
        <FlatList
          data={otherEmployees}
          renderItem={renderOther}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    flexDirection: isWeb ? "row" : "column",
    justifyContent: "space-between",
    alignItems: isWeb ? "center" : "flex-start",
    marginBottom: isWeb ? 24 : 16,
    gap: 12,
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

  filterTabs: { flexDirection: "row", gap: 4 },
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

  podiumCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: isWeb ? 32 : 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  podiumCardWeb: { padding: 40 },
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: isWeb ? 40 : 20,
  },

  podiumItem: { alignItems: "center", flex: 1 },
  podiumItemFirst: { marginBottom: 0 },
  crownWrap: { marginBottom: 4 },
  crownEmoji: { fontSize: 24 },

  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  podiumAvatarFirst: { width: 72, height: 72, borderRadius: 36 },
  podiumAvatarText: { fontWeight: "800", fontSize: 16 },
  podiumAvatarTextFirst: { fontSize: 20 },
  rankBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F8FAFC",
  },
  rankBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },

  podiumName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 2,
  },
  podiumNameFirst: { fontSize: 15 },
  podiumEarnings: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  podiumOrders: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  rankingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: isWeb ? 16 : 0,
    paddingVertical: isWeb ? 8 : 0,
    borderWidth: isWeb ? 1 : 0,
    borderColor: "#E2E8F0",
    flex: 1,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  thCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: isWeb ? 16 : 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 12,
  },
  rankNum: {
    width: 24,
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    textAlign: "center",
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rankAvatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  rankInfo: { flex: 2 },
  rankName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  rankOrders: { fontSize: 11, color: "#64748B", marginTop: 1 },
  rankBar: {
    flex: 2,
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  rankBarFill: { height: "100%", borderRadius: 3 },
  rankEarnings: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    width: 60,
    justifyContent: "center",
  },
  trendText: { fontSize: 11, fontWeight: "600" },
});
