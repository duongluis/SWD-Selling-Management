import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// ── Time filter helpers ───────────────────────────────────────
const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth(); // 0-indexed
const thisQ = Math.ceil((thisMonth + 1) / 3);
const lastQ = thisQ === 1 ? 4 : thisQ - 1;
const lastQYear = thisQ === 1 ? thisYear - 1 : thisYear;

const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
};

const FILTERS = [
  { key: 'all', label: 'Toàn thời gian' },
  { key: 'month', label: 'Tháng này' },
  { key: 'quarter', label: 'Quý này' },
  { key: 'lastQ', label: 'Quý trước' },
];

const getRange = (key) => {
  switch (key) {
    case 'month':
      return {
        start: new Date(thisYear, thisMonth, 1),
        end: new Date(thisYear, thisMonth + 1, 0, 23, 59, 59),
      };
    case 'quarter': {
      const qStart = (thisQ - 1) * 3;
      return {
        start: new Date(thisYear, qStart, 1),
        end: new Date(thisYear, qStart + 3, 0, 23, 59, 59),
      };
    }
    case 'lastQ': {
      const qStart = (lastQ - 1) * 3;
      return {
        start: new Date(lastQYear, qStart, 1),
        end: new Date(lastQYear, qStart + 3, 0, 23, 59, 59),
      };
    }
    default:
      return null; // all time
  }
};

const fmtVND = (n) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(0)}K`;
};

const getInitials = (name) =>
  (name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#EC4899'];
const RANK_COLORS = { 1: '#F59E0B', 2: '#94A3B8', 3: '#B45309' };

// ── Podium ───────────────────────────────────────────────────
function Podium({ top3 }) {
  if (top3.length === 0) return null;
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <View style={styles.podiumWrap}>
      {order.map((user, idx) => {
        const isFirst = user.rank === 1;
        const rnkColor = RANK_COLORS[user.rank] || '#64748B';
        return (
          <View key={user.email} style={[styles.podiumItem, isFirst && styles.podiumItemFirst]}>
            {isFirst && <Text style={styles.crownEmoji}>👑</Text>}
            <View style={[styles.podiumAvatar, {
              backgroundColor: AVATAR_COLORS[(user.rank - 1) % AVATAR_COLORS.length],
              width: isFirst ? 64 : 52, height: isFirst ? 64 : 52, borderRadius: isFirst ? 32 : 26,
            }]}>
              <Text style={[styles.podiumAvatarText, { fontSize: isFirst ? 20 : 16 }]}>
                {getInitials(user.name)}
              </Text>
              <View style={[styles.rankBadge, { backgroundColor: rnkColor }]}>
                <Text style={styles.rankBadgeText}>{user.rank}</Text>
              </View>
            </View>
            <Text style={[styles.podiumName, isFirst && { fontSize: 14 }]} numberOfLines={1}>
              {user.name?.split(' ').pop() || user.email?.split('@')[0]}
            </Text>
            <Text style={[styles.podiumRevenue, { color: rnkColor, fontSize: isFirst ? 15 : 13 }]}>
              {fmtVND(user.revenue)}
            </Text>
            <Text style={styles.podiumOrders}>{user.orderCount} đơn</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function LeaderboardView() {
  const { userDetail } = useContext(UserDetailContext);
  const [filter, setFilter] = useState('quarter');
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        // Lấy tất cả users
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs
          .map(d => ({ ...d.data(), docId: d.id }))
          .filter(u => u.verified && (u.role || u.member || '').toLowerCase() !== 'admin');

        const range = getRange(filter);
        const result = [];

        for (const user of users) {
          const email = user.email;
          const custList = (user.customer || []);
          const phones = custList.map(c => c.phone).filter(Boolean);

          let totalRevenue = 0;
          let orderCount = 0;

          for (const phone of phones) {
            try {
              const snap = await getDoc(doc(db, 'orders', phone));
              if (!snap.exists()) continue;
              const orders = snap.data().orders || [];
              const filtered = range
                ? orders.filter(o => inRange(o.createdAt, range.start, range.end))
                : orders;
              filtered.forEach(o => {
                const val = (o.items || []).reduce((s, p) => s + p.price * p.qty, 0);
                totalRevenue += val;
                orderCount++;
              });
            } catch (_) { }
          }

          if (totalRevenue > 0) {
            result.push({
              email,
              name: user.name || email,
              revenue: totalRevenue,
              orderCount,
              role: user.role || user.member || '',
            });
          }
        }

        result.sort((a, b) => b.revenue - a.revenue);
        result.forEach((u, i) => { u.rank = i + 1; });
        setRanking(result);
      } catch (e) {
        console.error('Lỗi fetch leaderboard:', e);
      } finally {
        setLoading(false);
      }
    };

    if (userDetail) fetchRanking();
  }, [filter, userDetail]);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const myRank = ranking.find(u => u.email === userDetail?.email);
  const maxRev = ranking[0]?.revenue || 1;

  const renderRow = ({ item }) => {
    const isMe = item.email === userDetail?.email;
    const trendColor = item.rank <= 3 ? RANK_COLORS[item.rank] : '#64748B';
    return (
      <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
        <Text style={[styles.rankNum, { color: trendColor }]}>{item.rank}</Text>
        <View style={[styles.rankAvatar, {
          backgroundColor: AVATAR_COLORS[(item.rank - 1) % AVATAR_COLORS.length],
        }]}>
          <Text style={styles.rankAvatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.rankName, isMe && { color: Colors.LightBlue }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isMe && (
              <View style={styles.meBadge}>
                <Text style={styles.meBadgeText}>Bạn</Text>
              </View>
            )}
          </View>
          <Text style={styles.rankOrders}>{item.orderCount} đơn hàng</Text>
          {isWeb && (
            <View style={styles.rankBar}>
              <View style={[styles.rankBarFill, {
                width: `${(item.revenue / maxRev) * 100}%`,
                backgroundColor: AVATAR_COLORS[(item.rank - 1) % AVATAR_COLORS.length],
              }]} />
            </View>
          )}
        </View>
        <Text style={[styles.rankRevenue, { color: trendColor }]}>
          {fmtVND(item.revenue)}
        </Text>
      </View>
    );
  };

  const filterLabel = FILTERS.find(f => f.key === filter);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          {!isWeb && <Text style={styles.headerSub}>RANKINGS</Text>}
          <Text style={styles.headerTitle}>Bảng xếp hạng</Text>
          <Text style={styles.headerDesc}>Doanh thu · {filterLabel?.label}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank badge */}
      {myRank && (
        <View style={styles.myRankBanner}>
          <Ionicons name="person-circle-outline" size={16} color={Colors.LightBlue} />
          <Text style={styles.myRankText}>
            Thứ hạng của bạn: <Text style={{ fontWeight: '800', color: Colors.LightBlue }}>#{myRank.rank}</Text>
            {'  '}·{'  '}{fmtVND(myRank.revenue)} doanh thu
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.LightBlue} size="large" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : ranking.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="trophy-outline" size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
          <Text style={styles.emptySub}>Không có doanh thu trong {filterLabel?.label?.toLowerCase()}</Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.email}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
          ListHeaderComponent={
            <>
              {/* Podium top 3 */}
              <View style={styles.podiumCard}>
                <Podium top3={top3} />
              </View>

              {/* Table header */}
              {rest.length > 0 && (
                <View style={styles.tableHeader}>
                  <Text style={[styles.thCell, { width: 28 }]}>#</Text>
                  <Text style={[styles.thCell, { flex: 1 }]}>Nhân viên</Text>
                  {isWeb && <Text style={[styles.thCell, { flex: 2 }]}>Tiến độ</Text>}
                  <Text style={[styles.thCell, { width: 90, textAlign: 'right' }]}>Doanh thu</Text>
                </View>
              )}
            </>
          }
          renderItem={renderRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isWeb ? 24 : 14 },
  headerSub: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: isWeb ? 28 : 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  headerDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },

  filterScroll: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: isWeb ? 'nowrap' : 'wrap' },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterTabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTabTextActive: { color: '#FFFFFF' },

  myRankBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.BlueSky, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: Colors.LightBlue + '44' },
  myRankText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: '#94A3B8' },

  // Podium
  podiumCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: isWeb ? 32 : 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  podiumWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: isWeb ? 40 : 20 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumItemFirst: { marginBottom: 0 },
  crownEmoji: { fontSize: 22, marginBottom: 4 },
  podiumAvatar: { alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
  podiumAvatarText: { color: '#FFFFFF', fontWeight: '800' },
  rankBadge: { position: 'absolute', bottom: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F8FAFC' },
  rankBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  podiumName: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 2 },
  podiumRevenue: { fontWeight: '800', letterSpacing: -0.3 },
  podiumOrders: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Table
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: isWeb ? 14 : 4, paddingVertical: 8, marginBottom: 4 },
  thCell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },

  rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  rankRowMe: { borderColor: Colors.LightBlue, backgroundColor: Colors.BlueSky },
  rankNum: { width: 24, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rankName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rankOrders: { fontSize: 11, color: '#64748B', marginTop: 1 },
  rankBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  rankBarFill: { height: '100%', borderRadius: 2 },
  rankRevenue: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
  meBadge: { backgroundColor: Colors.LightBlue + '22', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  meBadgeText: { fontSize: 10, color: Colors.LightBlue, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});