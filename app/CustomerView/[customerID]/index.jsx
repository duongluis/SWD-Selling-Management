import BgWatermark from "@/components/Main/BgWatermark";
import { showAlert } from "@/components/Main/showAlert";
import { createNotification } from "@/components/Utils/chatService";
import { getRole } from "@/components/Utils/roleHelper";
import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useContext, useState } from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../../../config/firebaseConfig";

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
  const { userDetail } = useContext(UserDetailContext);
  const role = getRole(userDetail);
  const canEditConsult = role === 'admin' || role === 'ctv';
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

  const isConsult = ['none', 'pending', 'success', 'failed'].includes(customer.status);
  const [consultStatus, setConsultStatus] = useState(customer.status || 'none');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showFailureInput, setShowFailureInput] = useState(false);
  const [failureReason, setFailureReason] = useState(customer.reason || '');

  const CONSULT_STATUS_OPTS = [
    { key: 'pending', label: 'Đang tư vấn', icon: 'time-outline', color: '#2563EB', bg: '#EFF6FF' },
    { key: 'success', label: 'Thành công', icon: 'checkmark-circle-outline', color: '#059669', bg: '#ECFDF5' },
    { key: 'failed', label: 'Thất bại', icon: 'close-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
  ];

  const handleConsultStatusChange = async (newStatus) => {
    if (newStatus === consultStatus || !customer.docId) return;
    if (newStatus === 'failed') { setShowFailureInput(true); return; }
    await doUpdateStatus(newStatus, '');
  };

  const doUpdateStatus = async (newStatus, reason) => {
    setUpdatingStatus(true);
    try {
      const updateData = { status: newStatus };
      if (reason) updateData.reason = reason;
      await updateDoc(doc(db, 'consult', customer.docId), updateData);
      setConsultStatus(newStatus);

      if (newStatus === 'success') {
        // Notify admins
        getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))).then(snap => {
          snap.docs.forEach(d => {
            const adminEmail = d.data().email;
            if (adminEmail) createNotification({
              userEmail: adminEmail,
              type: 'consult_success',
              title: 'Consult thành công',
              body: `${userDetail?.name || userDetail?.email} tư vấn thành công: ${name} (${phone})`,
            }).catch(() => {});
          });
        }).catch(() => {});
        router.push({
          pathname: '/addCustomer',
          params: { name: customer.name || '', phone: customer.phone || '', address: customer.address || '', note: customer.note || '', consultCreatedBy: customer.createdBy || '' },
        });
      }
    } catch (e) { console.error(e); }
    finally { setUpdatingStatus(false); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BgWatermark />
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
            {!isConsult && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
                onPress={() => router.push({ pathname: '/addOrder', params: { customerParam: JSON.stringify(customer) } })}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
                <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Tạo đơn</Text>
              </TouchableOpacity>
            )}
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

        {/* Sản phẩm quan tâm */}
        {isConsult && (customer.productNames?.length > 0 || canEditConsult) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sản phẩm quan tâm</Text>
            {(customer.productNames || []).length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(customer.productNames || []).map((p, i) => (
                  <View key={i} style={{ backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDetail}>Chưa có sản phẩm nào được chọn</Text>
            )}
          </View>
        )}

        {/* Trạng thái tư vấn */}
        {isConsult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trạng thái tư vấn</Text>
            {CONSULT_STATUS_OPTS.map(opt => {
              const active = consultStatus === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.statusOpt, active && { borderColor: opt.color, backgroundColor: opt.bg }]}
                  onPress={() => handleConsultStatusChange(opt.key)}
                  activeOpacity={0.8}
                  disabled={updatingStatus || !['pending', 'none'].includes(consultStatus)}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? opt.color : Colors.LightGray} />
                  <Text style={[styles.statusOptText, active && { color: opt.color, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={opt.color} />}
                </TouchableOpacity>
              );
            })}

            {/* Failure reason input */}
            {showFailureInput && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>Lý do thất bại *</Text>
                <View style={[styles.statusOpt, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                  <TextInput
                    style={{ flex: 1, fontSize: 14, color: '#0F172A', minHeight: 60, textAlignVertical: 'top' }}
                    placeholder="Nhập lý do thất bại..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={failureReason}
                    onChangeText={setFailureReason}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' }}
                    onPress={() => { setShowFailureInput(false); setFailureReason(''); }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 2, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#EF4444' }}
                    onPress={() => {
                      if (!failureReason.trim()) { showAlert('Thông báo', 'Vui lòng nhập lý do thất bại'); return; }
                      setShowFailureInput(false);
                      doUpdateStatus('failed', failureReason.trim());
                    }}
                    disabled={updatingStatus}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Xác nhận thất bại</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Show stored failure reason */}
            {consultStatus === 'failed' && (customer.reason || failureReason) && (
              <View style={{ marginTop: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444', marginBottom: 4 }}>LÝ DO THẤT BẠI</Text>
                <Text style={{ fontSize: 13, color: '#374151' }}>{customer.reason || failureReason}</Text>
              </View>
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
  statusOpt: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.Border, backgroundColor: Colors.White, marginBottom: 6 },
  statusOptText: { flex: 1, fontSize: 14, fontWeight: "500", color: Colors.TextPrimary },
});
