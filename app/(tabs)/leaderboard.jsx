import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Platform,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png');

// ── Filters ───────────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'Toàn thời gian', icon: 'infinite-outline' },
  { key: 'month', label: 'Tháng này', icon: 'calendar-outline' },
  { key: 'day', label: 'Hôm nay', icon: 'today-outline' },
];

const getRange = (key) => {
  const now = new Date();
  switch (key) {
    case 'day':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      };
    case 'month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };
    default: return null; // all time
  }
};

const inRange = (dateStr, range) => {
  if (!range || !dateStr) return true;
  const d = new Date(dateStr);
  return d >= range.start && d <= range.end;
};

// ── Helpers ───────────────────────────────────────────────────
const fmtVND = (n) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return '0';
};
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const getInitials = (name) =>
  (name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#EC4899'];
const RANK_COLORS = { 1: '#F59E0B', 2: '#94A3B8', 3: '#B45309' };

// ── Podium (top 3) ────────────────────────────────────────────
function Podium({ top3 }) {
  if (!top3.length) return null;
  // Sắp xếp: [2nd, 1st, 3rd] để hiển thị podium
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <View style={S.podiumWrap}>
      {order.map(user => {
        const isFirst = user.rank === 1;
        const rnkColor = RANK_COLORS[user.rank] || '#64748B';
        return (
          <View key={user.email} style={[S.podiumItem, isFirst && S.podiumItemFirst]}>
            {isFirst && <Text style={S.crown}>👑</Text>}
            <View style={[S.podiumAvatar, {
              backgroundColor: AVATAR_COLORS[(user.rank - 1) % AVATAR_COLORS.length],
              width: isFirst ? 64 : 52, height: isFirst ? 64 : 52,
              borderRadius: isFirst ? 32 : 26,
            }]}>
              <Text style={[S.podiumAvatarText, { fontSize: isFirst ? 20 : 16 }]}>
                {getInitials(user.name)}
              </Text>
              <View style={[S.rankBadge, { backgroundColor: rnkColor }]}>
                <Text style={S.rankBadgeText}>{user.rank}</Text>
              </View>
            </View>
            <Text style={[S.podiumName, isFirst && { fontSize: 14 }]} numberOfLines={1}>
              {user.name?.split(' ').pop() || user.email?.split('@')[0]}
            </Text>
            <Text style={[S.podiumRevenue, { color: rnkColor, fontSize: isFirst ? 16 : 13 }]}>
              {fmtVND(user.revenue)}
            </Text>
            <Text style={S.podiumOrders}>{user.orderCount} đơn</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function LeaderboardView() {
  const { userDetail } = useContext(UserDetailContext);
  const [filter, setFilter] = useState('month');
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRanking = useCallback(async () => {
    if (!userDetail) return;
    setLoading(true);
    try {
      const range = getRange(filter);

      // Lấy tất cả user đã verified (trừ admin)
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs
        .map(d => ({ ...d.data(), docId: d.id }))
        .filter(u =>
          u.verified &&
          (u.role || u.member || '').toLowerCase() !== 'admin'
        );

      let result = [];

      if (!range) {
        // ── Toàn thời gian: đọc revenueTotal từ db/users ───
        // Nhanh, chính xác, không double-count
        result = users
          .map(u => {
            const total = u.revenueTotal || 0;
            if (!total) return null;
            return {
              email: u.email,
              name: u.name || u.email,
              revenue: total,
              orderCount: (u.revenueOrders || []).length,
              role: u.role || u.member || '',
            };
          })
          .filter(Boolean);

      } else {
        // ── Lọc theo ngày/tháng: scan orders ─────────────
        result = await Promise.all(
          users.map(async (user) => {
            try {
              const email = user.email;
              if (!email) return null;

              const custSnap = await getDocs(
                query(collection(db, 'customers'), where('createdBy', '==', email))
              );
              const phones = custSnap.docs.map(d => d.data().phone).filter(Boolean);
              if (!phones.length) return null;

              let totalRevenue = 0;
              let orderCount = 0;

              await Promise.all(phones.map(async (phone) => {
                try {
                  const snap = await getDoc(doc(db, 'orders', phone));
                  if (!snap.exists()) return;
                  // Chỉ tính đơn đã thanh toán trong khoảng thời gian
                  const orders = (snap.data().orders || []).filter(o =>
                    o.status === 'Đã thanh toán' && inRange(o.createdAt, range)
                  );
                  orders.forEach(o => {
                    totalRevenue += (o.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
                    orderCount++;
                  });
                } catch (_) { }
              }));

              if (!totalRevenue) return null;
              return {
                email,
                name: user.name || email,
                revenue: totalRevenue,
                orderCount,
                role: user.role || user.member || '',
              };
            } catch (_) { return null; }
          })
        );
        result = result.filter(Boolean);
      }

      result.sort((a, b) => b.revenue - a.revenue);
      result.forEach((u, i) => { u.rank = i + 1; });
      setRanking(result);
    } catch (e) {
      console.error('Lỗi fetch leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, userDetail]);

  // Auto-refresh khi focus
  useFocusEffect(
    useCallback(() => { fetchRanking(); }, [fetchRanking])
  );

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const myRank = ranking.find(u => u.email === userDetail?.email);
  const maxRev = ranking[0]?.revenue || 1;
  const filterCfg = FILTERS.find(f => f.key === filter);

  const renderRow = ({ item }) => {
    const isMe = item.email === userDetail?.email;
    const rnkColor = RANK_COLORS[item.rank] || '#64748B';
    return (
      <View style={[S.rankRow, isMe && S.rankRowMe]}>
        {/* Rank number */}
        <Text style={[S.rankNum, { color: rnkColor }]}>{item.rank}</Text>

        {/* Avatar */}
        <View style={[S.rankAvatar, {
          backgroundColor: AVATAR_COLORS[(item.rank - 1) % AVATAR_COLORS.length],
        }]}>
          <Text style={S.rankAvatarText}>{getInitials(item.name)}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[S.rankName, isMe && { color: '#2563EB' }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isMe && (
              <View style={S.meBadge}>
                <Text style={S.meBadgeText}>Bạn</Text>
              </View>
            )}
          </View>
          <Text style={S.rankSub}>{item.orderCount} đơn hàng · {item.role}</Text>
          {/* Progress bar — web only */}
          {isWeb && (
            <View style={S.barWrap}>
              <View style={[S.barFill, {
                width: `${Math.max(4, (item.revenue / maxRev) * 100)}%`,
                backgroundColor: AVATAR_COLORS[(item.rank - 1) % AVATAR_COLORS.length],
              }]} />
            </View>
          )}
        </View>

        {/* Revenue */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[S.rankRevenue, { color: rnkColor }]}>{fmtVND(item.revenue)}</Text>
          {isWeb && (
            <Text style={S.rankRevenueFull}>{fmt(item.revenue)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={S.root}>
      <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />

      <View style={S.container}>
        {/* Header */}
        <View style={S.header}>
          <View>
            {!isWeb && <Text style={S.headerSub}>RANKINGS</Text>}
            <Text style={S.headerTitle}>Bảng xếp hạng</Text>
            <Text style={S.headerDesc}>Doanh thu cá nhân · {filterCfg?.label}</Text>
          </View>
          {/* Refresh */}
          <TouchableOpacity
            style={S.refreshBtn}
            onPress={fetchRanking}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={S.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[S.filterTab, filter === f.key && S.filterTabActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={f.icon} size={13} color={filter === f.key ? '#fff' : '#64748B'} />
              <Text style={[S.filterTabText, filter === f.key && S.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* My rank banner */}
        {myRank && !loading && (
          <View style={S.myRankBanner}>
            <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
            <Text style={S.myRankText}>
              Thứ hạng của bạn:{' '}
              <Text style={{ fontWeight: '800', color: '#2563EB' }}>#{myRank.rank}</Text>
              {'  ·  '}{fmt(myRank.revenue)}
            </Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={S.loadingWrap}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={S.loadingText}>Đang tính toán doanh thu...</Text>
          </View>
        ) : ranking.length === 0 ? (
          <View style={S.empty}>
            <View style={S.emptyIcon}>
              <Ionicons name="trophy-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={S.emptyTitle}>Chưa có dữ liệu</Text>
            <Text style={S.emptySub}>
              Không có đơn hàng nào trong {filterCfg?.label?.toLowerCase()}
            </Text>
          </View>
        ) : (
          <FlatList
            data={rest}
            keyExtractor={item => item.email}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
            ListHeaderComponent={() => (
              <>
                {/* Podium top 3 */}
                <View style={S.podiumCard}>
                  <Podium top3={top3} />
                  {/* Tổng số người */}
                  <Text style={S.podiumTotal}>
                    {ranking.length} nhân viên có doanh thu · {filterCfg?.label}
                  </Text>
                </View>

                {/* Table header */}
                {rest.length > 0 && (
                  <View style={S.tableHeader}>
                    <Text style={[S.thCell, { width: 28 }]}>#</Text>
                    <View style={{ width: 36 }} />
                    <Text style={[S.thCell, { flex: 1 }]}>Nhân viên</Text>
                    {isWeb && <Text style={[S.thCell, { flex: 2 }]}>Tiến độ</Text>}
                    <Text style={[S.thCell, { width: 80, textAlign: 'right' }]}>Doanh thu</Text>
                  </View>
                )}
              </>
            )}
            renderItem={renderRow}
          />
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.05 },
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isWeb ? 20 : 14 },
  headerSub: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: isWeb ? 28 : 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  headerDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterTabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTabTextActive: { color: '#FFFFFF' },

  // My rank
  myRankBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  myRankText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // Loading / empty
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: '#94A3B8' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Podium
  podiumCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: isWeb ? 32 : 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  podiumWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: isWeb ? 40 : 20 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumItemFirst: { marginBottom: 0 },
  crown: { fontSize: 22, marginBottom: 4 },
  podiumAvatar: { alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
  podiumAvatarText: { color: '#FFFFFF', fontWeight: '800' },
  rankBadge: { position: 'absolute', bottom: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F8FAFC' },
  rankBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  podiumName: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 2 },
  podiumRevenue: { fontWeight: '800', letterSpacing: -0.3 },
  podiumOrders: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  podiumTotal: { textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 16 },

  // Table
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: isWeb ? 14 : 4, paddingVertical: 8, marginBottom: 4, gap: 10 },
  thCell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },

  // Rank rows
  rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  rankRowMe: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  rankNum: { width: 24, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rankName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rankSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  barWrap: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  barFill: { height: '100%', borderRadius: 2 },
  rankRevenue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  rankRevenueFull: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  meBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  meBadgeText: { fontSize: 10, color: '#2563EB', fontWeight: '700' },
});