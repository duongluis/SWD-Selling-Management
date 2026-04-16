import Colors from "@/constant/Colors";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function getAvatarColor(name) {
  if (!name) return Colors.Avatar[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return Colors.Avatar[sum % Colors.Avatar.length];
}

const handleCall = async (phone) => {
  try {
    const can = await Linking.canOpenURL(`tel:${phone}`);
    if (can) await Linking.openURL(`tel:${phone}`);
  } catch (e) {
    console.error(e);
  }
};
const handleZalo = async (phone) => {
  const z = `zalo://chat?phone=${phone}`;
  const f = `https://zalo.me/${phone}`;
  try {
    const can = await Linking.canOpenURL(z);
    await Linking.openURL(can ? z : f);
  } catch (e) {
    console.error(e);
  }
};
const handleSMS = async (phone) => {
  try {
    const can = await Linking.canOpenURL(`sms:${phone}`);
    if (can) await Linking.openURL(`sms:${phone}`);
  } catch (e) {
    console.error(e);
  }
};

export default function customerView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [showDetail, setShowDetail] = useState(false);

  const customer = params.customerParam ? JSON.parse(params.customerParam) : {};
  const name = customer.name || "Không có tên";
  const phone = customer.phone || "";
  const email = customer.email || "";
  const address = customer.address || "";
  const note = customer.note || "";
  const createdAt = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString("vi-VN")
    : "";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.Background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin khách hàng</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={Colors.TextPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View
              style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}
            >
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.customerName}>{name}</Text>
          {createdAt ? (
            <View style={styles.joinBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.Gray} />
              <Text style={styles.joinText}>Tham gia {createdAt}</Text>
            </View>
          ) : null}
          {note ? <Text style={styles.noteText}>{note}</Text> : null}

          {/* Actions */}
          <View style={styles.actionRow}>
            {phone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleCall(phone)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={Colors.TextPrimary}
                />
                <Text style={styles.actionBtnText}>Gọi điện</Text>
              </TouchableOpacity>
            )}
            {phone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleSMS(phone)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={Colors.TextPrimary}
                />
                <Text style={styles.actionBtnText}>Nhắn tin</Text>
              </TouchableOpacity>
            )}
            {phone && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.zaloBtn]}
                onPress={() => handleZalo(phone)}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={16} color={Colors.Zalo} />
                <Text style={[styles.actionBtnText, { color: Colors.Zalo }]}>
                  Zalo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Detail toggle */}
        <TouchableOpacity
          style={styles.detailCard}
          onPress={() => setShowDetail(!showDetail)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={Colors.Primary}
          />
          <Text style={styles.detailCardText}>Xem chi tiết liên hệ</Text>
          <Ionicons
            name={showDetail ? "chevron-up" : "chevron-forward"}
            size={18}
            color={Colors.Primary}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        {showDetail && (
          <View style={styles.detailExpanded}>
            {[
              {
                show: !!phone,
                icon: "call-outline",
                color: Colors.Primary,
                label: "Số điện thoại",
                value: phone,
              },
              {
                show: !!email,
                icon: "mail-outline",
                color: Colors.Purple,
                label: "Email",
                value: email,
              },
              {
                show: !!address,
                icon: "location-outline",
                color: Colors.Warning,
                label: "Địa chỉ",
                value: address,
              },
            ]
              .filter((r) => r.show)
              .map((r) => (
                <View style={styles.detailRow} key={r.label}>
                  <View style={styles.detailIconWrap}>
                    <Ionicons name={r.icon} size={16} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>{r.label}</Text>
                    <Text style={styles.detailValue}>{r.value}</Text>
                  </View>
                </View>
              ))}
            {!phone && !email && !address && (
              <Text style={styles.noDetail}>Chưa có thông tin liên hệ</Text>
            )}
          </View>
        )}

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsOverlay} />
          <Text style={styles.statsLabel}>Tổng chi tiêu</Text>
          <Text style={styles.statsAmount}>0đ</Text>
          <View style={styles.statsBottom}>
            <Text style={styles.statsSubLabel}>Đơn hàng đã mua</Text>
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>0 Đơn</Text>
            </View>
          </View>
        </View>

        {/* Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
          <View style={styles.emptyOrders}>
            <Ionicons
              name="receipt-outline"
              size={36}
              color={Colors.LightGray}
            />
            <Text style={styles.emptyOrdersText}>Chưa có đơn hàng nào</Text>
          </View>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.Background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.White,
    shadowColor: Colors.Black,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: Colors.TextPrimary },
  scroll: { paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: Colors.White,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: Colors.Black,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.PrimaryLight,
  },
  avatarText: { color: Colors.White, fontSize: 26, fontWeight: "800" },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.Success,
    borderWidth: 2,
    borderColor: Colors.White,
  },
  customerName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.TextPrimary,
    marginBottom: 6,
  },
  joinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  joinText: { fontSize: 12, color: Colors.Gray },
  noteText: {
    fontSize: 12,
    color: Colors.Gray,
    textAlign: "center",
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.Background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  zaloBtn: { borderColor: Colors.Zalo, backgroundColor: Colors.ZaloLight },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: Colors.TextPrimary },
  detailCard: {
    backgroundColor: Colors.White,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
    shadowColor: Colors.Black,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailCardText: { fontSize: 14, fontWeight: "600", color: Colors.Primary },
  detailExpanded: {
    backgroundColor: Colors.White,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: Colors.Black,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.Background,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.Gray,
    fontWeight: "600",
    marginBottom: 2,
  },
  detailValue: { fontSize: 14, color: Colors.TextPrimary, fontWeight: "600" },
  noDetail: {
    fontSize: 13,
    color: Colors.LightGray,
    textAlign: "center",
    paddingVertical: 8,
  },
  statsCard: {
    backgroundColor: Colors.PrimaryDark,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: Colors.PrimaryDark,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statsOverlay: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  statsLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  statsAmount: {
    color: Colors.White,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  statsBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsSubLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  orderBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  orderBadgeText: { color: Colors.White, fontSize: 12, fontWeight: "700" },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.TextPrimary,
    marginBottom: 12,
  },
  emptyOrders: {
    backgroundColor: Colors.White,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.Black,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyOrdersText: { fontSize: 13, color: Colors.LightGray, fontWeight: "500" },
});
