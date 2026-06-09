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
import { getPriceField, getRole, isAdmin, isCTV } from '@/components/Utils/roleHelper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';
import { THEME } from '@/components/Styles/theme';
import { db } from '@/config/firebaseConfig';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

const TYPE_CFG = {
  buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
  le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

const STATUS_CFG = {
  'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
  'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
};

// Thêm map hiển thị paymentMethod
const PAYMENT_CFG = {
  customer: { label: 'Khách hàng', icon: 'person-outline', c: '#0891B2', bg: '#ECFEFF' },
  company: { label: 'Doanh nghiệp', icon: 'business-outline', c: '#7C3AED', bg: '#F5F3FF' },
};

const getStatusCfg = (s) => STATUS_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const canShowCost = (userDetail, role) => {
  if (isAdmin(role)) return true;
  return userDetail?.advisor == null;
};

const getItemCost = (p, priceField, productPrices) =>
  PARSE(productPrices[p.name]?.[priceField] ?? 0);

const getCostPriceField = (order, role, advisorRoles) => {
  if (isAdmin(role)) return 'price';
  const creatorRole = advisorRoles[order?.createdBy];
  if (creatorRole) return getPriceField(creatorRole);
  return getPriceField(role);
};

// ── Traverse lên advisor cao nhất ────────────────────────────
const getRootAdvisorRole = async (userEmail) => {
  let currentEmail = userEmail;
  let visited = new Set();

  while (currentEmail) {
    if (visited.has(currentEmail)) break; // tránh vòng lặp
    visited.add(currentEmail);

    const snap = await getDoc(doc(db, 'users', currentEmail));
    if (!snap.exists()) break;

    const data = snap.data();
    const advisor = data?.advisor;

    if (!advisor) {
      // Đây là người cao nhất, lấy role của họ
      return getRole(data);
    }

    currentEmail = advisor;
  }

  return 'daily'; // fallback
};

// ── Bảng tiêu đề ─────────────────────────────────────────────
function TableHeader({ showCost, tableStyles }) {
  return (
    <View style={tableStyles.head}>
      <View style={COL.lead} />
      <View style={COL.order}><Text style={tableStyles.th}>Đơn hàng</Text></View>
      <View style={COL.date}><Text style={tableStyles.thCenter}>Ngày</Text></View>
      <View style={COL.sub}><Text style={tableStyles.thCenter}>Hình thức thanh toán</Text></View>
      {showCost && <View style={COL.cost}><Text style={tableStyles.thCenter}>Tiền nhập</Text></View>}
      {showCost && <View style={COL.amount}><Text style={tableStyles.thCenter}>Tổng giá trị</Text></View>}
      <View style={COL.status}><Text style={[tableStyles.th, tableStyles.thCenter]}>Trạng thái</Text></View>
      <View style={COL.trail} />
    </View>
  );
}

// ── Dòng dữ liệu đơn hàng ────────────────────────────────────
// Sửa OrderRow — đổi phần hiển thị pCount → paymentMethod
function OrderRow({ item, index, isActive, onPress, showCost, role, advisorRoles, productPrices, tableStyles }) {
  const tcfg = TYPE_CFG[item.orderType];
  const pcfg = PAYMENT_CFG[item.paymentMethod] || { label: item.paymentMethod || '—', c: '#64748B', bg: '#F1F5F9' };
  const total = (item.items || []).reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);
  const isCancelled = (item.status || '').includes('hủy') || item.status === 'CANCELLED';
  const avatarColor = isCancelled ? '#94A3B8' : AVATAR_COLORS[index % AVATAR_COLORS.length];
  const scfg = getStatusCfg(item.status);

  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const priceField = getCostPriceField(item, role, advisorRoles);
  const totalCostRow = (item.items || []).reduce((s, p) =>
    s + getItemCost(p, priceField, productPrices) * PARSE(p.qty || 1), 0
  );

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
        <Text style={ROW.cellMuted} numberOfLines={1}>{date}</Text>
      </View>

      {/* Cột thanh toán */}
      <View style={COL.sub}>
        <View style={[ROW.paymentBadge, { backgroundColor: pcfg.bg }]}>
          <Text style={[ROW.paymentText, { color: pcfg.c }]} numberOfLines={1}>{pcfg.label}</Text>
        </View>
      </View>

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

  const { query, setQuery } = useSearch(data, ['id', 'customer']);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { styles: cardStyles, isDesktop } = useCardStyles();
  const { styles: tableStyles } = useTableStyles();

  const [advisorRoles, setAdvisorRoles] = useState({});
  const [productPrices, setProductPrices] = useState({});

  const showCostField = useMemo(
    () => canShowCost(userDetail, role),
    [userDetail?.advisor, role]
  );

  useEffect(() => {
    const fetchProductPrices = async () => {
      try {
        const snap = await getDocs(collection(db, 'productPrice'));
        const map = {};
        snap.docs.forEach(d => { map[d.id] = d.data(); });
        setProductPrices(map);
      } catch (_) { }
    };
    fetchProductPrices();
  }, []);

  // ── Fetch advisor roles (thay useEffect cũ) ──────────────────
  useEffect(() => {
    if (!data.length) return;

    const creators = [...new Set(data.map(o => o.createdBy).filter(Boolean))];
    if (!creators.length) return;

    const fetchAdvisorRoles = async () => {
      const roles = {};
      await Promise.all(creators.map(async (email) => {
        roles[email] = await getRootAdvisorRole(email);
      }));
      setAdvisorRoles(roles); // key: createdBy email → root role
    };

    fetchAdvisorRoles();
  }, [data]);

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
    data
      .filter(o => o.status === 'Đã thanh toán')
      .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + PARSE(p.price) * PARSE(p.qty || 1), 0), 0)
    , [data]);

  const totalCost = useMemo(() => {
    if (!showCostField) return 0;
    return data
      .filter(o => !['Đã hủy', 'CANCELLED'].includes(o.status))
      .reduce((sum, o) => {
        const priceField = getCostPriceField(o, role, advisorRoles);
        return sum + (o.items || []).reduce((s, p) =>
          s + getItemCost(p, priceField, productPrices) * PARSE(p.qty || 1), 0
        );
      }, 0);
  }, [data, role, advisorRoles, productPrices]);

  const statCards = [
    { icon: 'receipt-outline', label: 'Đơn hàng', value: String(stats.total || 0), color: THEME.colors.primary, bg: THEME.colors.primaryLight },
    { icon: 'cube-outline', label: 'Đơn buôn', value: String(data.filter(o => o.orderType === 'buon').length), color: THEME.colors.success, bg: THEME.colors.successLight },
    { icon: 'home-outline', label: 'Đơn lẻ', value: String(data.filter(o => o.orderType === 'le').length), color: THEME.colors.purple, bg: THEME.colors.purpleLight },
    { icon: 'cash-outline', label: 'Doanh thu', value: fmtCurrency(totalRevenue), color: THEME.colors.warning, bg: THEME.colors.warningLight },
    ...(showCostField ? [{ icon: 'pricetag-outline', label: 'Tiền nhập', value: fmtCurrency(totalCost), color: '#0891B2', bg: '#ECFEFF' }] : []),
  ];

  const handlePress = (item) => {
    if (isDesktop) {
      setSelected(p => p?.id === item.id ? null : item);
    } else {
      router.push({ pathname: '/OrderView/[orderID]', params: { orderID: item.id, orderParam: JSON.stringify(item) } });
    }
  };

  console.log('userDetail.advisor:', userDetail?.advisor, '| showCostField:', showCostField);
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

          {loading && !refreshing ? (
            <EmptyState loading />
          ) : filtered.length === 0 ? (
            <EmptyState
              empty
              icon="receipt-outline"
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
                  role={role}
                  advisorRoles={advisorRoles}
                  productPrices={productPrices}
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
  sub: { flex: 1.5, minWidth: 140 },
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
  cellAmount: { fontSize: 13, fontWeight: '500', color: THEME.colors.textPrimary, textAlign: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'center' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  textStrike: { textDecorationLine: 'line-through', color: THEME.colors.textMuted },
  textMuted: { color: THEME.colors.textMuted },
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'center' },
  paymentText: { fontSize: 11, fontWeight: '600' },
  cellMuted: { fontSize: 11, color: THEME.colors.textMuted, alignSelf: 'center' }
});