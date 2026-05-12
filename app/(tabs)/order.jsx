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

//code 1 
function TableHeader() {
  if (!isWeb) return null;
  return (
    <View style={[WRAP_BASE, TH.row]}>
      <View style={COL.lead} />
      <View style={COL.order}><Text style={TH.cell}>Đơn hàng</Text></View>
      <View style={COL.date}><Text style={TH.cell}>Ngày</Text></View>
      <View style={COL.sub}><Text style={TH.cell}>Sản phẩm</Text></View>
      <View style={COL.amount}><Text style={[TH.cell, TH.cellRight]}>Tổng tiền</Text></View>
      <View style={COL.status}><Text style={[TH.cell, TH.cellCenter]}>Trạng thái</Text></View>
      <View style={COL.trail} />
    </View>
  );
}

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


  // ── 3. ROW ── (cùng số children, cùng COL với header)
  return (
    <TouchableOpacity
      style={[WRAP_BASE, ROW.wrap, isActive && ROW.wrapActive, isCancelled && ROW.wrapCancelled]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      {isActive && <View style={ROW.leftAccent} />}

      {/* 1. avatar (COL.lead) */}
      <View style={[COL.lead, ROW.avatar, { backgroundColor: avatarColor + '22' }]}>
        <Text style={[ROW.avatarText, { color: avatarColor }]}>
          {getInitials(item.customer)}
        </Text>
      </View>

      {/* 2. order (COL.order) */}
      <View style={COL.order}>
        <View style={ROW.nameRow}>
          <Text
            style={[ROW.orderId, isCancelled && ROW.textStrike]}
            numberOfLines={1}
          >
            Đơn hàng #{item.id}
          </Text>
          {tcfg && (
            <View style={[ROW.badge, { backgroundColor: tcfg.bg }]}>
              <Text style={[ROW.badgeText, { color: tcfg.c }]}>{tcfg.label}</Text>
            </View>
          )}
        </View>
        <Text
          style={[ROW.customer, isCancelled && ROW.textMuted]}
          numberOfLines={1}
        >
          {item.customer}
        </Text>
      </View>

      {/* 3. date */}
      <View style={COL.date}>
        <Text style={ROW.cellMuted} numberOfLines={1}>{date}</Text>
      </View>

      {/* 4. sub */}
      <View style={COL.sub}>
        <Text style={ROW.cellMuted} numberOfLines={1}>{pCount} sản phẩm</Text>
      </View>

      {/* 5. amount */}
      <View style={COL.amount}>
        <Text
          style={[ROW.cellAmount, isCancelled && ROW.textMuted]}
          numberOfLines={1}
        >
          {fmtCurrency(total)}
        </Text>
      </View>

      {/* 6. status */}
      <View style={COL.status}>
        <View style={[ROW.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}>
          <View style={[ROW.dot, { backgroundColor: cfg.c }]} />
          <Text style={[ROW.statusLabel, { color: cfg.c }]} numberOfLines={1}>
            {item.status || 'PENDING'}
          </Text>
        </View>
      </View>

      {/* 7. trail (chevron) */}
      <View style={COL.trail}>
        <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
      </View>
    </TouchableOpacity>
  );
}

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

// ── 1. SINGLE SOURCE OF TRUTH cho layout ──
const COL = {
  lead: { width: 36 },                         // ô avatar
  order: { flex: 2, minWidth: 160 },            // ← minWidth giữ responsive
  date: { flex: 1, minWidth: 90 },
  sub: { flex: 1, minWidth: 90 },
  amount: { flex: 1, minWidth: 110 },
  status: { width: 130 },
  trail: { width: 20 },
};

const WRAP_BASE = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingHorizontal: isWeb ? 20 : 14,
};

// ── 4. STYLES — bỏ hết flex/width trong style (đã ở COL) ──
const TH = StyleSheet.create({
  row: {
    backgroundColor: '#F8FAFC', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0'
  },
  cell: {
    fontSize: 11, fontWeight: '700', color: '#64748B',
    letterSpacing: 0.5, textTransform: 'uppercase'
  },
  cellRight: { textAlign: 'center' },
  cellCenter: { textAlign: 'center' },
});

const ROW = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9',
    position: 'relative'
  },
  wrapActive: { backgroundColor: '#F0F7FF' },
  wrapCancelled: { opacity: 0.6 },
  leftAccent: {
    position: 'absolute', left: 0, top: 4, bottom: 4,
    width: 3, backgroundColor: '#2563EB', borderRadius: 2
  },

  // avatar — KHÔNG có width (đã ở COL.lead), chỉ style visual
  avatar: {
    height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { fontSize: 12, fontWeight: '800' },

  // order column
  nameRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 2
  },
  orderId: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  customer: { fontSize: 12, color: '#64748B' },
  badge: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 6, flexShrink: 0
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // data cells
  cellMuted: { fontSize: 12, color: '#94A3B8', textAlign: 'left' },
  cellAmount: {
    fontSize: 13, fontWeight: '500',
    color: '#0F172A', textAlign: 'center'
  },
  // status
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, alignSelf: 'center'
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },

  textStrike: { textDecorationLine: 'line-through', color: '#94A3B8' },
  textMuted: { color: '#94A3B8' },
});