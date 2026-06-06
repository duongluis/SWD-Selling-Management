// app/(tabs)/order.jsx

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import OrderDetail from '@/components/UI/OrderDetail';
import StatBar from '@/components/UI/StatBar';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { getPriceField, isAdmin, isCTV } from '@/components/Utils/roleHelper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';
import { THEME } from '@/components/Styles/theme';

const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

const TYPE_CFG = {
  buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
  le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

// ── Status color map ─────────────────────────────────────────
const STATUS_CFG = {
  'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
  'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
};
const getStatusCfg = (s) => STATUS_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const getUserLevel = (userDetail) => {
  if (!userDetail?.advisor) return 1;
  if (userDetail?.level) return userDetail.level;
  return 2; // có advisor → tối thiểu cấp 2
};

const canShowCost = (userDetail, role) => {
  if (isAdmin(role)) return true;
  return getUserLevel(userDetail) === 1;
};

// ── Giá nhập cho cấp 2/3: lấy theo role của rootAdvisor ─────
// rootAdvisor là đại lý cấp 1 → luôn dùng price_a
// Nếu bạn lưu role của rootAdvisor vào userDetail.rootAdvisorRole thì dùng getPriceField(rootAdvisorRole)
const getCostPriceField = (userDetail, role) => {
  if (isAdmin(role)) return getPriceField(role);
  if (getUserLevel(userDetail) === 1) return getPriceField(role);
  // Cấp 2/3: giá nhập = giá mà rootAdvisor (cấp 1) bán cho họ
  // rootAdvisor thường là 'daily' → price_a
  const rootAdvisorRole = userDetail?.rootAdvisorRole || 'daily';
  return getPriceField(getRole({ role: rootAdvisorRole }));
};

// ── Bảng tiêu đề ─────────────────────────────────────────────
function TableHeader({ showCost, tableStyles }) {
  return (
    <View style={tableStyles.head}>
      <View style={COL.lead} />
      <View style={COL.order}><Text style={tableStyles.th}>Đơn hàng</Text></View>
      <View style={COL.date}><Text style={tableStyles.th}>Ngày</Text></View>
      <View style={COL.sub}><Text style={tableStyles.th}>Sản phẩm</Text></View>
      {showCost && (
        <View style={COL.cost}>
          <Text style={[tableStyles.th]}>Tiền nhập</Text>
        </View>
      )}
      {showCost && (
        <View style={COL.amount}>
          <Text style={[tableStyles.th]}>Tổng giá trị</Text>
        </View>
      )}
      <View style={COL.status}><Text style={[tableStyles.th, tableStyles.thCenter]}>Trạng thái</Text></View>
      <View style={COL.trail} />
    </View>
  );
}

// ── Dòng dữ liệu đơn hàng ────────────────────────────────────
function OrderRow({ item, index, isActive, onPress, showCost, priceField, tableStyles }) {
  const tcfg = TYPE_CFG[item.orderType];
  const total = (item.items || []).reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);
  const pCount = (item.items || []).length;
  const isCancelled = (item.status || '').includes('hủy') || item.status === 'CANCELLED';
  const avatarColor = isCancelled ? '#94A3B8' : AVATAR_COLORS[index % AVATAR_COLORS.length];
  const scfg = getStatusCfg(item.status);

  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  // Tiền nhập: ưu tiên lấy từ rootAdvisorPrice nếu có (lưu khi tạo đơn)
  // Fallback: tính từ priceField trong productPrice
  const totalCostRow = (item.items || []).reduce((s, p) => {
    const costPrice = PARSE(
      p.basePrice ??            // ✅ thêm vào đầu
      p.rootAdvisorPrice ??
      p.productPrice?.[priceField] ??
      p[priceField] ?? 0
    );
    return s + costPrice * PARSE(p.qty || 1);
  }, 0);

  return (
    <TouchableOpacity
      style={[tableStyles.row, isActive && tableStyles.rowActive, isCancelled && tableStyles.rowCancelled]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      {isActive && <View style={tableStyles.leftAccent} />}

      <View style={[COL.lead, ROW.avatar, { backgroundColor: avatarColor + '22' }]}>
        <Text style={[ROW.avatarText, { color: avatarColor }]}>{getInitials(item.customer)}</Text>
      </View>

      <View style={COL.order}>
        <View style={ROW.nameRow}>
          <Text style={[ROW.orderId, isCancelled && ROW.textStrike]} numberOfLines={1}>
            Đơn hàng #{item.id}
          </Text>
          {tcfg && (
            <View style={[ROW.badge, { backgroundColor: tcfg.bg }]}>
              <Text style={[ROW.badgeText, { color: tcfg.c }]}>{tcfg.label}</Text>
            </View>
          )}
        </View>
        <Text style={[ROW.customer, isCancelled && ROW.textMuted]} numberOfLines={1}>{item.customer}</Text>
      </View>

      <View style={COL.date}>
        <Text style={tableStyles.cellMuted} numberOfLines={1}>{date}</Text>
      </View>

      <View style={COL.sub}>
        <Text style={tableStyles.cellMuted} numberOfLines={1}>{pCount} sản phẩm</Text>
      </View>

      {/* ✅ Chỉ hiện cho cấp 1 và admin */}
      {showCost && (
        <View style={COL.cost}>
          <Text style={[ROW.cellAmount, isCancelled && ROW.textMuted]} numberOfLines={1}>
            {fmtCurrency(totalCostRow)}
          </Text>
        </View>
      )}

      {showCost && (
        <View style={COL.amount}>
          <Text style={[ROW.cellAmount, isCancelled && ROW.textMuted]} numberOfLines={1}>
            {fmtCurrency(total)}
          </Text>
        </View>
      )}

      {/* ✅ Status pill có màu */}
      <View style={COL.status}>
        <View style={[ROW.statusPill, { backgroundColor: scfg.bg, borderColor: scfg.bd }]}>
          <View style={[ROW.statusDot, { backgroundColor: scfg.c }]} />
          <Text style={[ROW.statusLabel, { color: scfg.c }]} numberOfLines={1}>
            {item.status || 'Chờ xác nhận'}
          </Text>
        </View>
      </View>

      <View style={COL.trail}>
        <Ionicons name="chevron-forward" size={14} color={isActive ? THEME.colors.primary : '#CBD5E1'} />
      </View>
    </TouchableOpacity>
  );
}

export default function OrderScreen() {
  const router = useRouter();
  const { data, loading, refreshing, refresh, stats, role, userDetail } = useScreenData('orders');

  // ✅ Xác định cấp và quyền xem giá
  const showCostField = canShowCost(userDetail, role);
  const priceField = getCostPriceField(userDetail, role);

  const { query, setQuery } = useSearch(data, ['id', 'customer']);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { styles: cardStyles, isDesktop } = useCardStyles();
  const { styles: tableStyles } = useTableStyles();

  useEffect(() => {
    if (selected) {
      const latest = data.find(o => o.id === selected.id);
      if (latest) setSelected(latest);
    }
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter(o => {
      const ms = !q || (o.customer || '').toLowerCase().includes(q) || (o.id || '').toLowerCase().includes(q);
      const mt = typeFilter === 'all' || o.orderType === typeFilter;
      let mst = true;
      if (statusFilter === 'processing') mst = ['Chờ lắp đặt', 'Đang lắp đặt'].includes(o.status);
      else if (statusFilter !== 'all') mst = o.status === statusFilter;
      return ms && mt && mst;
    });
  }, [data, query, typeFilter, statusFilter]);

  const totalRevenue = useMemo(() =>
    data.filter(o => o.status === 'Đã thanh toán')
      .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + PARSE(p.price) * PARSE(p.qty || 1), 0), 0)
    , [data]);

  // ✅ Tổng tiền nhập: chỉ tính cho cấp 1
  const totalCost = useMemo(() => {
    if (!showCostField) return 0;
    return data
      .filter(o => !['Đã hủy', 'CANCELLED'].includes(o.status))
      .reduce((sum, o) =>
        sum + (o.items || []).reduce((s, p) => {
          const costPrice = PARSE(
            p.basePrice ??        // ✅ field thực tế trong Firestore
            p.rootAdvisorPrice ??
            p.productPrice?.[priceField] ??
            p[priceField] ?? 0
          );
          return s + costPrice * PARSE(p.qty || 1);
        }, 0)
        , 0);
  }, [data, priceField, showCostField]);

  const statCards = [
    { icon: 'receipt-outline', label: 'Đơn hàng', value: String(stats.total || 0), color: THEME.colors.primary, bg: THEME.colors.primaryLight },
    { icon: 'cube-outline', label: 'Đơn buôn', value: String(data.filter(o => o.orderType === 'buon').length), color: THEME.colors.success, bg: THEME.colors.successLight },
    { icon: 'home-outline', label: 'Đơn lẻ', value: String(data.filter(o => o.orderType === 'le').length), color: THEME.colors.purple, bg: THEME.colors.purpleLight },
    { icon: 'cash-outline', label: 'Doanh thu', value: fmtCurrency(totalRevenue), color: THEME.colors.warning, bg: THEME.colors.warningLight },
    // ✅ Chỉ hiện stat tiền nhập cho cấp 1 / admin
    ...(showCostField ? [{ icon: 'pricetag-outline', label: 'Tiền nhập', value: fmtCurrency(totalCost), color: '#0891B2', bg: '#ECFEFF' }] : []),
  ];

  const handlePress = (item) => {
    if (isDesktop) {
      setSelected(p => p?.id === item.id ? null : item);
    } else {
      router.push({ pathname: '/OrderView/[orderID]', params: { orderID: item.id, orderParam: JSON.stringify(item) } });
    }
  };

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Đơn hàng"
        subtitle={`${stats.total || 0} đơn hàng`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Tìm kiếm đơn hàng..."
        actionLabel={!isCTV(role) && isDesktop ? ' Tạo đơn hàng' : undefined}
        actionIcon="add"
        onAction={!isCTV(role) ? () => router.push('/addOrder') : undefined}
      />
      <StatBar stats={statCards} />
      <FilterChips
        options={[
          { key: 'all', label: 'Tất cả' },
          { key: 'buon', label: 'Đơn buôn' },
          { key: 'le', label: 'Đơn lẻ' },
        ]}
        value={typeFilter}
        onChange={t => { setTypeFilter(t); setSelected(null); }}
      />
      <FilterChips
        options={[
          { key: 'all', label: 'Tất cả trạng thái' },
          { key: 'Chờ xác nhận', label: 'Chờ xác nhận' },
          { key: 'processing', label: 'Đang xử lý' },
          { key: 'Đã thanh toán', label: 'Đã thanh toán' },
          { key: 'Đã hủy', label: 'Đã hủy' },
        ]}
        value={statusFilter}
        onChange={s => { setStatusFilter(s); setSelected(null); }}
      />

      <View style={cardStyles.splitLayout}>
        <View style={cardStyles.card}>
          {isDesktop && <TableHeader showCost={showCostField} tableStyles={tableStyles} />}

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
                  <OrderRow
                    item={item}
                    index={index}
                    isActive={selected?.id === item.id}
                    onPress={handlePress}
                    showCost={showCostField}
                    priceField={priceField}
                    tableStyles={tableStyles}
                  />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={tableStyles.listContainer}
              />
            )}
        </View>

        {isDesktop && selected && (
          <OrderDetail
            order={selected}
            role={role}
            onClose={() => setSelected(null)}
            onUpdated={updated => { setSelected(updated); refresh(); }}
          />
        )}
      </View>
    </TabScreenLayout>
  );
}

const COL = {
  lead: { width: 36 },
  order: { flex: 2, minWidth: 160 },
  date: { flex: 1, minWidth: 90 },
  sub: { flex: 1, minWidth: 90 },
  amount: { flex: 1, minWidth: 110 },
  cost: { flex: 1, minWidth: 110 },
  status: { width: 140 },
  trail: { width: 20 },
};

const ROW = StyleSheet.create({
  avatar: { height: 36, borderRadius: THEME.radius.sm, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  orderId: { fontSize: 13, fontWeight: '700', color: THEME.colors.textPrimary },
  customer: { fontSize: 12, color: THEME.colors.textSecondary },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: THEME.radius.sm },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cellAmount: { fontSize: 13, fontWeight: '500', color: THEME.colors.textPrimary, textAlign: 'left' },

  // ✅ Status pill có màu
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'center' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },

  textStrike: { textDecorationLine: 'line-through', color: THEME.colors.textMuted },
  textMuted: { color: THEME.colors.textMuted },
});