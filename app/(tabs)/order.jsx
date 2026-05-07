// app/(tabs)/order.jsx

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import StatBar from '@/components/UI/StatBar';
// ✅ Import từ component riêng — không định nghĩa inline nữa
import OrderDetail from '@/components/UI/OrderDetail';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { isCTV } from '@/components/Utils/roleHelper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList, Platform, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const isWeb = Platform.OS === 'web';
const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

// ── Status config (dùng cho row badges) ──────────────────────
const S_CFG = {
  'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã lắp đặt': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
  'Chờ thanh toán': { c: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
  'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
  'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'PENDING': { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' },
};
const scfg = (s) => S_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const TYPE_CFG = {
  buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
  le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

// ── Table Header ──────────────────────────────────────────────
function TableHeader() {
  if (!isWeb) return null;
  return (
    <View style={TH.row}>
      <View style={{ width: 46 }} />
      <Text style={[TH.cell, { flex: 2.2 }]}>Đơn hàng</Text>
      <Text style={[TH.cell, { flex: 0.9 }]}>Ngày</Text>
      <Text style={[TH.cell, { flex: 0.7 }]}>Sản phẩm</Text>
      <Text style={[TH.cell, { flex: 1.2, textAlign: 'right' }]}>Tổng tiền</Text>
      <Text style={[TH.cell, { flex: 1.2 }]}>Trạng thái</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}
const TH = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10 },
  cell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.06, textTransform: 'uppercase' },
});

// ── Order Row ─────────────────────────────────────────────────
function OrderRow({ item, index, isActive, onPress }) {
  const cfg = scfg(item.status);
  const tcfg = TYPE_CFG[item.orderType];
  const total = (item.items || []).reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);
  const pCount = (item.items || []).length;
  const isCancelled = (item.status || '').includes('hủy') || item.status === 'CANCELLED';
  const avatarColor = isCancelled ? '#94A3B8' : AVATAR_COLORS[index % AVATAR_COLORS.length];
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <TouchableOpacity
      style={[ROW.wrap, isActive && ROW.wrapActive, isCancelled && ROW.wrapCancelled]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      {isActive && <View style={ROW.leftAccent} />}
      <View style={[ROW.avatar, { backgroundColor: avatarColor + '22' }]}>
        <Text style={[ROW.avatarText, { color: avatarColor }]}>{getInitials(item.customer)}</Text>
      </View>
      <View style={ROW.mainCol}>
        <View style={ROW.idRow}>
          <Text style={[ROW.orderId, isCancelled && ROW.cancelled]}>Đơn hàng #{item.id}</Text>
          {tcfg && (
            <View style={[ROW.typePill, { backgroundColor: tcfg.bg }]}>
              <Text style={[ROW.typePillText, { color: tcfg.c }]}>{tcfg.label}</Text>
            </View>
          )}
        </View>
        <Text style={[ROW.customer, isCancelled && ROW.cancelledLight]}>{item.customer}</Text>
      </View>
      {isWeb && <Text style={[ROW.col, ROW.colDate]}>{date}</Text>}
      {isWeb && <Text style={[ROW.col, ROW.colSub]}>{pCount} sản phẩm</Text>}
      <Text style={[ROW.col, ROW.colAmount, isCancelled && ROW.cancelledLight]}>{fmtCurrency(total)}</Text>
      <View style={ROW.statusWrap}>
        <View style={[ROW.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}>
          <View style={[ROW.statusDot, { backgroundColor: cfg.c }]} />
          <Text style={[ROW.statusText, { color: cfg.c }]}>{item.status || 'PENDING'}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
    </TouchableOpacity>
  );
}

const ROW = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: isWeb ? 20 : 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10, position: 'relative' },
  wrapActive: { backgroundColor: '#F0F7FF' },
  wrapCancelled: { opacity: 0.6 },
  leftAccent: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 3, backgroundColor: '#2563EB', borderRadius: 2 },
  avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 12, fontWeight: '800' },
  mainCol: { flex: isWeb ? 2.2 : 1, minWidth: 0 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  orderId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  customer: { fontSize: 12, color: '#64748B' },
  typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  typePillText: { fontSize: 10, fontWeight: '700' },
  col: { paddingHorizontal: 2 },
  colDate: { flex: 0.9, fontSize: 12, color: '#94A3B8' },
  colSub: { flex: 0.7, fontSize: 12, color: '#94A3B8' },
  colAmount: { flex: isWeb ? 1.2 : 1, fontSize: 13, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  statusWrap: { flex: isWeb ? 1.2 : undefined, alignItems: isWeb ? 'flex-start' : 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cancelled: { textDecorationLine: 'line-through', color: '#94A3B8' },
  cancelledLight: { color: '#94A3B8' },
});

// ── Main Screen ───────────────────────────────────────────────
export default function OrderScreen() {
  const router = useRouter();
  const { data, loading, refreshing, refresh, stats, role } = useScreenData('orders');
  const { query, setQuery } = useSearch(data, ['id', 'customer']);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter(o => {
      const ms = !q || (o.customer || '').toLowerCase().includes(q) || (o.id || '').toLowerCase().includes(q);
      const mt = typeFilter === 'all' || o.orderType === typeFilter;
      return ms && mt;
    });
  }, [data, query, typeFilter]);

  const totalRevenue = useMemo(() =>
    data.filter(o => !String(o.status).includes('hủy'))
      .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + PARSE(p.price) * PARSE(p.qty || 1), 0), 0)
    , [data]);

  const statCards = [
    { icon: 'receipt-outline', label: 'Đơn hàng', value: String(stats.total || 0), color: '#2563EB', bg: '#EFF6FF' },
    { icon: 'cube-outline', label: 'Đơn buôn', value: String(data.filter(o => o.orderType === 'buon').length), color: '#059669', bg: '#ECFDF5' },
    { icon: 'home-outline', label: 'Đơn lẻ', value: String(data.filter(o => o.orderType === 'le').length), color: '#8B5CF6', bg: '#F5F3FF' },
    { icon: 'cash-outline', label: 'Doanh thu', value: fmtCurrency(totalRevenue), color: '#F59E0B', bg: '#FFFBEB' },
  ];

  const handlePress = (item) => {
    if (isWeb) setSelected(p => p?.id === item.id ? null : item);
    else router.push({ pathname: '/OrderView/[orderID]', params: { orderID: item.id, orderParam: JSON.stringify(item) } });
  };

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Đơn hàng"
        subtitle={`${stats.total || 0} đơn hàng`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Tìm kiếm đơn hàng..."
        actionLabel={!isCTV(role) && isWeb ? ' Tạo đơn hàng' : undefined}
        actionIcon="add"
        onAction={!isCTV(role) ? () => router.push('/addOrder') : undefined}
      />
      <StatBar stats={statCards} />
      <FilterChips
        options={[
          { key: 'all', label: 'Tất cả' },
          { key: 'buon', label: 'Đơn buôn' },
          { key: 'le', label: 'Đơn lẻ', count: data.filter(o => o.orderType === 'le').length },
        ]}
        value={typeFilter}
        onChange={t => { setTypeFilter(t); setSelected(null); }}
      />

      <View style={{ flex: 1, flexDirection: 'row', padding: isWeb ? 16 : 0, paddingTop: 0 }}>
        {/* List */}
        <View style={WRAP.card}>
          <TableHeader />
          {loading && !refreshing ? <EmptyState loading /> :
            filtered.length === 0 ? (
              <EmptyState empty icon="receipt-outline"
                title={query ? 'Không tìm thấy' : 'Chưa có đơn hàng'}
                actionLabel={!isCTV(role) ? 'Tạo đơn hàng' : undefined}
                onAction={!isCTV(role) ? () => router.push('/addOrder') : undefined}
              />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item, i) => item.id || String(i)}
                renderItem={({ item, index }) => (
                  <OrderRow item={item} index={index}
                    isActive={selected?.id === item.id}
                    onPress={handlePress}
                  />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: isWeb ? 60 : 100 }}
              />
            )}
        </View>

        {/* ✅ Detail panel — dùng component riêng */}
        {isWeb && selected && (
          <OrderDetail
            order={selected}
            role={role}
            onClose={() => setSelected(null)}
            onUpdated={updated => setSelected(updated)}
          />
        )}
      </View>
    </TabScreenLayout>
  );
}

const WRAP = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: isWeb ? 12 : 0, borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden', margin: isWeb ? 16 : 0, marginTop: 0,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
});