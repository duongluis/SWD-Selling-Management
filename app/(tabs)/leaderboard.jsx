// app/(tabs)/leaderboard.jsx

import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import StatBar from '@/components/UI/StatBar';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { UserDetailContext } from '@/context/UserDetailContext';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useMemo, useState } from 'react';
import {
  FlatList, Platform, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];
const AVATAR_COLORS = ['#2563EB', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

function normalizeRole(u) {
  const r = (u.role || u.member || '').toLowerCase().trim();
  if (r === 'admin') return 'admin';
  if (r === 'đại lý' || r === 'daily') return 'daily';
  if (r === 'đối tác' || r === 'phantan') return 'phantan';
  if (r === 'cộng tác viên' || r === 'ctv' || r === 'collaborator') return 'ctv';
  return r;
}

const ROLE_LABEL = { daily: 'Đại lý', phantan: 'Đối tác', ctv: 'Cộng tác viên' };

function inPeriod(order, period) {
  if (period === 'all') return true;
  const ts = order.createdAt;
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (period === 'day') {
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  }
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === 'Q1') return d.getMonth() < 3 && d.getFullYear() === now.getFullYear();
  if (period === 'Q2') return d.getMonth() >= 3 && d.getMonth() < 6 && d.getFullYear() === now.getFullYear();
  if (period === 'Q3') return d.getMonth() >= 6 && d.getMonth() < 9 && d.getFullYear() === now.getFullYear();
  if (period === 'Q4') return d.getMonth() >= 9 && d.getFullYear() === now.getFullYear();
  return true;
}

function LeaderCard({ item, rank }) {
  const isTop3 = rank < 3;
  return (
    <View style={[L.card, isTop3 && { borderColor: RANK_COLORS[rank], borderWidth: 2 }]}>
      <View style={[L.rankBadge, { backgroundColor: isTop3 ? RANK_COLORS[rank] : '#E2E8F0' }]}>
        {isTop3
          ? <Text style={L.rankIcon}>{RANK_ICONS[rank]}</Text>
          : <Text style={L.rankNum}>{rank + 1}</Text>
        }
      </View>
      <View style={[L.avatar, { backgroundColor: AVATAR_COLORS[rank % AVATAR_COLORS.length] }]}>
        <Text style={L.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={L.info}>
        <Text style={L.name}>{item.name || item.email}</Text>
        <Text style={L.role}>{item.role || item.member}</Text>
      </View>
      <View style={L.right}>
        <Text style={[L.revenue, isTop3 && { color: RANK_COLORS[rank] }]}>
          {fmtCurrency(item.revenueTotal || 0)}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({ title }) {
  return (
    <View style={L.sectionHeader}>
      <Text style={L.sectionTitle}>{title}</Text>
    </View>
  );
}

function RoleSection({ title, data }) {
  if (!data.length) return (
    <View>
      <SectionHeader title={title} />
      <View style={{ paddingHorizontal: isWeb ? 32 : 16, paddingBottom: 8 }}>
        <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>Chưa có dữ liệu</Text>
      </View>
    </View>
  );
  return (
    <View>
      <SectionHeader title={title} />
      {data.map((item, index) => (
        <View key={item.email || index} style={{ paddingHorizontal: isWeb ? 32 : 16 }}>
          <LeaderCard item={item} rank={index} />
        </View>
      ))}
    </View>
  );
}

const PERIOD_OPTIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'day', label: 'Hôm nay' },
  { key: 'month', label: 'Tháng này' },
  { key: 'Q1', label: 'Quý 1' },
  { key: 'Q2', label: 'Quý 2' },
  { key: 'Q3', label: 'Quý 3' },
  { key: 'Q4', label: 'Quý 4' },
  { key: 'year', label: 'Năm này' },
];

export default function LeaderboardScreen() {
  const { userDetail } = useContext(UserDetailContext);
  const [allUsers, setAllUsers] = useState([]);
  const [revenueByEmail, setRevenueByEmail] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('month');

  const myRole = normalizeRole(userDetail || {});
  const isAdmin = myRole === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const [userSnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('verified', '==', true))),
        getDocs(collection(db, 'customers')),
      ]);
      const rawUsers = userSnap.docs.map(d => d.data())
        .filter(u => normalizeRole(u) !== 'admin');

      const phones = custSnap.docs.map(d => d.data().phone).filter(Boolean);
      const ordersFlat = [];
      await Promise.all(phones.slice(0, 100).map(async (phone) => {
        try {
          const s = await getDoc(doc(db, 'orders', phone));
          if (!s.exists()) return;
          (s.data().orders || []).forEach(o => {
            if (o.status !== 'Đã thanh toán' || !o.createdBy) return;
            ordersFlat.push(o);
          });
        } catch (_) { }
      }));

      setAllUsers(rawUsers);
      setAllOrders(ordersFlat);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const users = useMemo(() => {
    const rev = {};
    allOrders.forEach(o => {
      if (!inPeriod(o, periodFilter)) return;
      const val = (o.items || []).reduce((sum, p) => sum + (parseFloat(p.price || 0) * parseFloat(p.qty || 1)), 0);
      rev[o.createdBy] = (rev[o.createdBy] || 0) + val;
    });
    return allUsers
      .map(u => ({ ...u, revenueTotal: rev[u.email] || 0 }))
      .sort((a, b) => b.revenueTotal - a.revenueTotal);
  }, [allUsers, allOrders, periodFilter]);

  const displayUsers = useMemo(() => {
    if (isAdmin) return users;
    return users.filter(u => normalizeRole(u) === myRole);
  }, [users, isAdmin, myRole]);

  const dailyGroup = useMemo(() => users.filter(u => normalizeRole(u) === 'daily'), [users]);
  const phantanGroup = useMemo(() => users.filter(u => normalizeRole(u) === 'phantan'), [users]);
  const ctvGroup = useMemo(() => users.filter(u => normalizeRole(u) === 'ctv'), [users]);

  const top3Revenue = displayUsers.slice(0, 3).reduce((s, u) => s + (u.revenueTotal || 0), 0);
  const statCards = [
    { icon: 'trophy-outline', label: 'Tham gia', value: String(displayUsers.length), color: '#F59E0B', bg: '#FFFBEB' },
    { icon: 'cash-outline', label: 'Top 3 DT', value: fmtCurrency(top3Revenue), color: '#10B981', bg: '#ECFDF5' },
    { icon: 'medal-outline', label: 'Dẫn đầu', value: displayUsers[0]?.name?.split(' ').pop() || '—', color: '#2563EB', bg: '#EFF6FF' },
  ];

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Bảng xếp hạng"
        subtitle="Doanh số xuất sắc"
        showSearch={false}
      />
      <StatBar stats={statCards} />
      <FilterChips options={PERIOD_OPTIONS} value={periodFilter} onChange={setPeriodFilter} />

      {loading ? <EmptyState loading /> : (
        isAdmin ? (
          <FlatList
            data={[]}
            keyExtractor={() => ''}
            ListHeaderComponent={() => (
              <View>
                <RoleSection title={`Đại lý (${dailyGroup.length})`} data={dailyGroup} />
                <RoleSection title={`Đối tác (${phantanGroup.length})`} data={phantanGroup} />
                <RoleSection title={`Cộng tác viên (${ctvGroup.length})`} data={ctvGroup} />
              </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        ) : displayUsers.length === 0 ? (
          <EmptyState empty icon="trophy-outline"
            title="Chưa có dữ liệu"
            subtitle="Dữ liệu sẽ hiển thị khi có doanh số"
          />
        ) : (
          <FlatList
            data={displayUsers}
            keyExtractor={(item, i) => item.email || String(i)}
            renderItem={({ item, index }) => (
              <View style={{ paddingHorizontal: isWeb ? 32 : 16 }}>
                <LeaderCard item={item} rank={index} />
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </TabScreenLayout>
  );
}

const L = StyleSheet.create({
  sectionHeader: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankIcon: { fontSize: 16 },
  rankNum: { fontSize: 13, fontWeight: '800', color: '#fff' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  role: { fontSize: 12, color: '#64748B', marginTop: 1 },
  right: { alignItems: 'flex-end' },
  revenue: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  committed: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});
