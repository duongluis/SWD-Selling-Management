// app/(tabs)/leaderboard.jsx — refactored

import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import StatBar from '@/components/UI/StatBar';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import {
  FlatList, Platform, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'];
const AVATAR_COLORS = ['#2563EB', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

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
        {item.committedRevenue > 0 && (
          <Text style={L.committed}>/ {fmtCurrency(item.committedRevenue)}</Text>
        )}
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { userDetail } = useContext(UserDetailContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('verified', '==', true)));
      const data = snap.docs.map(d => d.data())
        .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin')
        .sort((a, b) => (b.revenueTotal || 0) - (a.revenueTotal || 0));
      setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const top3Revenue = users.slice(0, 3).reduce((s, u) => s + (u.revenueTotal || 0), 0);

  const statCards = [
    { icon: 'trophy-outline', label: 'Tham gia', value: String(users.length), color: '#F59E0B', bg: '#FFFBEB' },
    { icon: 'cash-outline', label: 'Top 3 DT', value: fmtCurrency(top3Revenue), color: '#10B981', bg: '#ECFDF5' },
    { icon: 'medal-outline', label: 'Dẫn đầu', value: users[0]?.name?.split(' ').pop() || '—', color: '#2563EB', bg: '#EFF6FF' },
  ];

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Bảng xếp hạng"
        subtitle="Doanh số xuất sắc"
        showSearch={false}
        leftSlot={
          <TouchableOpacity style={BK.btn} onPress={() => router.replace('/(tabs)/home')}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        }
      />

      <StatBar stats={statCards} />

      {loading ? <EmptyState loading /> :
        users.length === 0 ? (
          <EmptyState empty icon="trophy-outline"
            title="Chưa có dữ liệu"
            subtitle="Dữ liệu sẽ hiển thị khi có doanh số"
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item, i) => item.email || String(i)}
            renderItem={({ item, index }) => <LeaderCard item={item} rank={index} />}
            contentContainerStyle={{ paddingHorizontal: isWeb ? 32 : 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            showsVerticalScrollIndicator={false}
          />
        )}
    </TabScreenLayout>
  );
}

const BK = StyleSheet.create({
  btn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
});

const L = StyleSheet.create({
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