import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const avatarColors = ['#2196F3', '#9C27B0', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#795548'];

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name) {
  if (!name) return avatarColors[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return avatarColors[sum % avatarColors.length];
}

const handleCall = async (phone) => {
  try {
    const can = await Linking.canOpenURL(`tel:${phone}`);
    if (can) await Linking.openURL(`tel:${phone}`);
  } catch (e) { console.error(e); }
};

const handleZalo = async (phone) => {
  const zaloUrl = `zalo://chat?phone=${phone}`;
  const fallback = `https://zalo.me/${phone}`;
  try {
    const can = await Linking.canOpenURL(zaloUrl);
    await Linking.openURL(can ? zaloUrl : fallback);
  } catch (e) { console.error(e); }
};

const handleSMS = async (phone) => {
  try {
    const can = await Linking.canOpenURL(`sms:${phone}`);
    if (can) await Linking.openURL(`sms:${phone}`);
  } catch (e) { console.error(e); }
};

export default function customerView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [showDetail, setShowDetail] = useState(false);

  // ✅ Lấy data thật từ params
  const customer = params.customerParam
    ? JSON.parse(params.customerParam)
    : {};

  const name     = customer.name     || 'Không có tên';
  const phone    = customer.phone    || '';
  const email    = customer.email    || '';
  const address  = customer.address  || '';
  const note     = customer.note     || '';
  const createdAt = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('vi-VN')
    : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin khách hàng</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}>
              <Text style={styles.avatarText}>{getInitials(name)}</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.customerName}>{name}</Text>

          {createdAt ? (
            <View style={styles.joinBadge}>
              <Ionicons name="calendar-outline" size={12} color="#9E9E9E" />
              <Text style={styles.joinText}>Tham gia {createdAt}</Text>
            </View>
          ) : null}

          {note ? <Text style={styles.noteText}>{note}</Text> : null}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {phone ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(phone)} activeOpacity={0.8}>
                <Ionicons name="call-outline" size={16} color="#1A1A2E" />
                <Text style={styles.actionBtnText}>Gọi điện</Text>
              </TouchableOpacity>
            ) : null}

            {phone ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleSMS(phone)} activeOpacity={0.8}>
                <Ionicons name="chatbubble-outline" size={16} color="#1A1A2E" />
                <Text style={styles.actionBtnText}>Nhắn tin</Text>
              </TouchableOpacity>
            ) : null}

            {phone ? (
              <TouchableOpacity style={[styles.actionBtn, styles.zaloBtn]} onPress={() => handleZalo(phone)} activeOpacity={0.8}>
                <Ionicons name="logo-whatsapp" size={16} color="#0068FF" />
                <Text style={[styles.actionBtnText, { color: '#0068FF' }]}>Zalo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Contact Detail */}
        <TouchableOpacity
          style={styles.detailCard}
          onPress={() => setShowDetail(!showDetail)}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={18} color="#2196F3" />
          <Text style={styles.detailCardText}>Xem chi tiết liên hệ</Text>
          <Ionicons
            name={showDetail ? 'chevron-up' : 'chevron-forward'}
            size={18}
            color="#2196F3"
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>

        {showDetail && (
          <View style={styles.detailExpanded}>
            {phone ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="call-outline" size={16} color="#2196F3" />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Số điện thoại</Text>
                  <Text style={styles.detailValue}>{phone}</Text>
                </View>
              </View>
            ) : null}

            {email ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="mail-outline" size={16} color="#9C27B0" />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{email}</Text>
                </View>
              </View>
            ) : null}

            {address ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="location-outline" size={16} color="#FF9800" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Địa chỉ</Text>
                  <Text style={styles.detailValue}>{address}</Text>
                </View>
              </View>
            ) : null}

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

        {/* Empty Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
          </View>
          <View style={styles.emptyOrders}>
            <Ionicons name="receipt-outline" size={36} color="#C5C5C5" />
            <Text style={styles.emptyOrdersText}>Chưa có đơn hàng nào</Text>
          </View>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  scroll: {
    paddingHorizontal: 16,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#E3F2FD',
  },
  avatarText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  joinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  joinText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  noteText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  zaloBtn: {
    borderColor: '#0068FF',
    backgroundColor: '#EEF4FF',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  // Detail Card
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  detailExpanded: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '600',
  },
  noDetail: {
    fontSize: 13,
    color: '#B0B0B0',
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#1565C0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1565C0',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statsOverlay: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statsLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  statsAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  statsBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsSubLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  orderBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  orderBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  emptyOrders: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyOrdersText: {
    fontSize: 13,
    color: '#B0B0B0',
    fontWeight: '500',
  },
});