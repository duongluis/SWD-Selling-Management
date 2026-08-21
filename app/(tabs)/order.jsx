// app/(tabs)/order.jsx

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import OrderDetail from '@/components/UI/OrderDetail';
import StatBar from '@/components/UI/StatBar';
import { fmtCurrency, getInitials } from '@/components/Utils/formatters';
import { productItems, productTotal } from '@/components/Utils/orderItems';
import { canAdd, getPriceField, getRole, isAdmin, isAdminOrGD } from '@/components/Utils/roleHelper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';
import { THEME } from '@/components/Styles/theme';
import { db } from '@/config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
// Ngày giao đơn không hợp lệ (thiếu/sai định dạng) → coi như cũ nhất (0),
// tránh NaN làm Array.sort xếp lệch vị trí ngẫu nhiên
const toOrderTime = (createdAt) => {
  const t = new Date(createdAt || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const TYPE_CFG = {
  buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
  le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

const STATUS_CFG = {
  'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  // Don le - tên mới
  'Chờ xử lý': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang xử lý': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã xử lý': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
  // Don le - tên cũ (backward compat cho đơn đã tạo trước)
  'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã lắp đặt': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
  // Don buon
  'Chờ giao hàng': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Đang giao hàng': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  'Đã giao hàng': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
  'Chờ thanh toán': { c: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
  'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
  'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
  'PENDING': { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' },
};

// Thêm map hiển thị paymentMethod
const PAYMENT_CFG = {
  customer: { label: 'Khách hàng', icon: 'person-outline', c: '#0891B2', bg: '#ECFEFF' },
  company: { label: 'Người bán', icon: 'business-outline', c: '#7C3AED', bg: '#F5F3FF' },
};

const getStatusCfg = (s) => STATUS_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const getItemCost = (p, priceField) => {
  if (!priceField) return 0;
  return PARSE(p[priceField] ?? p.basePrice ?? 0);
};

const getCostPriceField = (order, role, rootAdvisorRoles) => {
  // if (isAdmin(role)) return 'price';// admin xem giá gốc

  if (order?.rootAdvisor && rootAdvisorRoles[order.rootAdvisor]) {
    return getPriceField(rootAdvisorRoles[order.rootAdvisor]);
  }

  return 0;
  // return getPriceField(role); // fallback
};

const canShowCost = (userDetail, role) => {
  if (isAdminOrGD(role)) return true;
  return userDetail?.advisor == null;
};

// ── Bảng tiêu đề ─────────────────────────────────────────────
function TableHeader({ role, showCost, showCreator, tableStyles }) {
  return (
    <View style={tableStyles.head}>
      <View style={COL.lead} />
      <View style={COL.order}><Text style={tableStyles.th}>Đơn hàng</Text></View>
      <View style={COL.date}><Text style={tableStyles.thCenter}>Ngày</Text></View>
      {showCreator && <View style={COL.creator}><Text style={tableStyles.thCenter}>Người tạo</Text></View>}
      <View style={COL.sub}><Text style={tableStyles.thCenter}>Hình thức thanh toán</Text></View>
      {showCost && <View style={COL.cost}><Text style={tableStyles.thCenter}>{isAdminOrGD(role) ? 'Doanh thu' : 'Tiền nhập'}</Text></View>}
      <View style={COL.amount}><Text style={tableStyles.thCenter}>Tổng giá trị</Text></View>
      <View style={COL.status}><Text style={[tableStyles.th, tableStyles.thCenter]}>Trạng thái</Text></View>
      <View style={COL.trail} />
    </View>
  );
}

function TotalRow({ totalCost, totalRevenue, showCost, showCreator, tableStyles }) {
  if (!showCost) return null;
  return (
    <View style={[tableStyles.head, { backgroundColor: '#F0F9FF', borderBottomWidth: 1, borderBottomColor: '#BFDBFE', marginBottom: 0, borderRadius: 0 }]}>
      <View style={COL.lead} />
      <View style={COL.order}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Tổng cộng</Text>
      </View>
      <View style={COL.date} />
      {showCreator && <View style={COL.creator} />}
      <View style={COL.sub} />
      <View style={COL.cost}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0891B2', textAlign: 'right' }}>
          {fmtCurrency(totalCost)}
        </Text>
      </View>
      <View style={COL.amount}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#2563EB', textAlign: 'right' }}>
          {fmtCurrency(totalRevenue)}
        </Text>
      </View>
      <View style={COL.status} />
      <View style={COL.trail} />
    </View>
  );
}

// ── Dòng dữ liệu đơn hàng ────────────────────────────────────
function OrderRow({ item, index, isActive, onPress, showCost, role, advisorRoles, tableStyles, showCreator, creatorNames }) {
  const tcfg = TYPE_CFG[item.orderType];
  const pcfg = PAYMENT_CFG[item.paymentMethod] || { label: item.paymentMethod || '—', c: '#64748B', bg: '#F1F5F9' };
  const total = productTotal(item);   // doanh thu sản phẩm, không gồm dịch vụ
  const isCancelled = (item.status || '').includes('hủy') || item.status === 'CANCELLED';
  const avatarColor = isCancelled ? '#94A3B8' : AVATAR_COLORS[index % AVATAR_COLORS.length];
  const scfg = getStatusCfg(item.status);


  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const priceField = getCostPriceField(item, role, advisorRoles);
  const totalCostRow = productItems(item).reduce((s, p) =>
    s + getItemCost(p, priceField) * PARSE(p.qty || 1), 0
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

      {showCreator && (
        <View style={COL.creator}>
          {/* Tên người tạo hay dài (họ tên đầy đủ) → cho xuống tối đa 2 dòng thay vì
              cắt cụt 1 dòng. Row không đặt height cố định nên tự cao thêm. */}
          <Text style={[ROW.cellMuted, ROW.cellCreator]} numberOfLines={2}>
            {creatorNames[item.createdBy] || item.createdBy?.split('@')[0] || '—'}
          </Text>
        </View>
      )}

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


      <View style={COL.amount}>
        <Text style={[ROW.cellAmount, isCancelled && ROW.textMuted]} numberOfLines={1}>
          {fmtCurrency(total)}
        </Text>
      </View>


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
  const [paymentFilter, setPaymentFilter] = useState('all');

  const { styles: cardStyles, isDesktop } = useCardStyles();
  const { styles: tableStyles } = useTableStyles();

  const [advisorRoles, setAdvisorRoles] = useState({});

  const [creatorNames, setCreatorNames] = useState({});
  const showCreator = isAdmin(role) || role === 'daily';

  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = gần nhất trước, 'asc' = xa nhất trước
  const [showSort, setShowSort] = useState(false);

  // Đếm số filter đang active
  const activeFilterCount = [
    paymentFilter !== 'all',
    statusFilter !== 'all',
    yearFilter !== 'all',
    monthFilter !== 'all',
  ].filter(Boolean).length;

  // Tạo danh sách năm từ data
  const yearOptions = useMemo(() => {
    const years = [...new Set(
      data.map(o => o.createdAt?.slice(0, 4)).filter(Boolean)
    )].sort((a, b) => b - a);
    return [{ key: 'all', label: 'Tất cả năm' }, ...years.map(y => ({ key: y, label: y }))];
  }, [data]);

  const monthOptions = [
    { key: 'all', label: 'Tất cả tháng' },
    ...Array.from({ length: 12 }, (_, i) => ({
      key: String(i + 1).padStart(2, '0'),
      label: `Tháng ${i + 1}`,
    })),
  ];

  const showCostField = useMemo(
    () => canShowCost(userDetail, role),
    [userDetail?.advisor, role]
  );


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter(o => {
      const creatorName = (creatorNames[o.createdBy] || '').toLowerCase();
      // const creatorEmail = (o.createdBy || '').toLowerCase();

      const ms = !q ||
        (o.customer || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        // creatorEmail.includes(q) ||          // ✅ tìm theo email người tạo
        creatorName.includes(q);             // ✅ tìm theo tên/nickname người tạo


      const mt = typeFilter === 'all' || o.orderType === typeFilter;
      let mst = true;
      if (statusFilter === 'processing') mst = ['Chờ lắp đặt', 'Đang lắp đặt', 'Chờ xử lý', 'Đang xử lý'].includes(o.status);
      else if (statusFilter !== 'all') mst = o.status === statusFilter;

      const createdAt = o.createdAt || '';
      const my = yearFilter === 'all' || createdAt.startsWith(yearFilter);
      const mm = monthFilter === 'all' || createdAt.slice(5, 7) === monthFilter;
      const mp = paymentFilter === 'all' || o.paymentMethod === paymentFilter;

      return ms && mt && mst && my && mm && mp;
    }).sort((a, b) => sortOrder === 'asc'
      ? toOrderTime(a.createdAt) - toOrderTime(b.createdAt)
      : toOrderTime(b.createdAt) - toOrderTime(a.createdAt));
  }, [data, query, typeFilter, statusFilter, yearFilter, monthFilter, paymentFilter, creatorNames, sortOrder]);


  const totalCostFiltered = useMemo(() => {
    if (!showCostField) return 0;
    return filtered
      .filter(o => !['Đã hủy', 'CANCELLED'].includes(o.status))
      .reduce((sum, o) => {
        const priceField = getCostPriceField(o, role, advisorRoles);
        return sum + productItems(o).reduce((s, p) =>
          s + getItemCost(p, priceField) * PARSE(p.qty || 1), 0
        );
      }, 0);
  }, [filtered, role, advisorRoles, showCostField]); // ← bỏ productPrices

  useEffect(() => {
    if (!data.length || !showCreator) return;
    const creators = [...new Set(data.map(o => o.createdBy).filter(Boolean))];
    if (!creators.length) return;

    const fetchCreatorNames = async () => {
      const names = {};
      await Promise.all(creators.map(async (email) => {
        try {
          const snap = await getDoc(doc(db, 'users', email));
          if (snap.exists()) {
            const u = snap.data();
            names[email] = isAdmin(role) ? u.nickname || u.name || email : u.name;

          }
        } catch (_) { }
      }));
      setCreatorNames(names);
    };
    fetchCreatorNames();
  }, [data, role]);

  const totalRevenueFiltered = useMemo(() =>
    filtered.reduce((s, o) => s + productTotal(o), 0)
    , [filtered]);

  useEffect(() => {
    if (!data.length) return;

    // Lấy unique rootAdvisors từ data (thay vì createdBy)
    const rootAdvisors = [...new Set(data.map(o => o.rootAdvisor).filter(Boolean))];
    if (!rootAdvisors.length) return;

    const fetchRootAdvisorRoles = async () => {
      const roles = {};
      await Promise.all(rootAdvisors.map(async (email) => {
        try {
          const snap = await getDoc(doc(db, 'users', email));
          if (snap.exists()) {
            roles[email] = getRole(snap.data()); // lấy role trực tiếp, không traverse
          }
        } catch (_) { }
      }));
      setAdvisorRoles(roles); // key: rootAdvisor email → role
    };

    fetchRootAdvisorRoles();
  }, [data]);

  useEffect(() => {
    if (selected) {
      const latest = data.find(o => o.id === selected.id);
      if (latest) {
        setSelected(latest);
      } else {

        setSelected(null);
      }
    }
  }, [data]);


  const totalRevenue = useMemo(() =>
    data
      .filter(o => o.status === 'Đã thanh toán')
      .reduce((s, o) => s + productTotal(o), 0)
    , [data]);

  const totalCost = useMemo(() => {
    if (!showCostField) return 0;
    return data
      .filter(o => !['Đã hủy', 'CANCELLED'].includes(o.status))
      .reduce((sum, o) => {
        const priceField = getCostPriceField(o, role, advisorRoles);
        return sum + productItems(o).reduce((s, p) =>
          s + getItemCost(p, priceField) * PARSE(p.qty || 1), 0
        );
      }, 0);
  }, [data, role, advisorRoles]); // ← bỏ productPrices

  const isAdminOrGDRole = isAdminOrGD(role);
  // Giá sản phẩm đã bao gồm VAT → tách VAT theo công thức: VAT = DT/1.08*0.08, DT chưa VAT = DT/1.08
  const vatAmount = totalCost / 1.08 * 0.08;
  const revenueExVat = totalCost / 1.08;

  const statCards = [
    { icon: 'receipt-outline', label: 'Đơn hàng', value: String(stats.total || 0), color: THEME.colors.primary, bg: THEME.colors.primaryLight },
    { icon: 'cube-outline', label: 'Đơn buôn', value: String(data.filter(o => o.orderType === 'buon').length), color: THEME.colors.success, bg: THEME.colors.successLight },
    { icon: 'home-outline', label: 'Đơn lẻ', value: String(data.filter(o => o.orderType === 'le').length), color: THEME.colors.purple, bg: THEME.colors.purpleLight },
    ...(!isAdminOrGDRole ? [{ icon: 'cash-outline', label: 'Doanh thu', value: fmtCurrency(totalRevenue), color: THEME.colors.warning, bg: THEME.colors.warningLight }] : []),
    ...(showCostField ? [{ icon: 'pricetag-outline', label: isAdminOrGDRole ? 'Doanh thu (VAT)' : 'Tiền nhập', value: fmtCurrency(totalCost), color: '#0891B2', bg: '#ECFEFF' }] : []),
    ...(isAdminOrGDRole ? [
      { icon: 'calculator-outline', label: 'VAT', value: fmtCurrency(vatAmount), color: '#DC2626', bg: '#FEF2F2' },
      { icon: 'trending-down-outline', label: 'Doanh thu (chưa VAT)', value: fmtCurrency(revenueExVat), color: '#7C3AED', bg: '#F5F3FF' },
    ] : []),
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
        actionLabel={isDesktop ? ' Tạo đơn hàng' : undefined}
        actionIcon="add"
        canAccess={canAdd(role)}
        onAction={() => router.push('/addOrder')}
      />

      {/* ── StatBar: luôn full width, không nằm trong ScrollView ── */}
      <StatBar stats={statCards} />

      {/* ── Filter Button + Dropdown ── */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, zIndex: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Nút Filter */}
          <TouchableOpacity
            style={[FF.filterBtn, activeFilterCount > 0 && FF.filterBtnActive]}
            onPress={() => setShowFilter(p => !p)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={activeFilterCount > 0 ? '#fff' : '#64748B'}
            />
            <Text style={[FF.filterBtnText, activeFilterCount > 0 && { color: '#fff' }]}>
              Bộ lọc
            </Text>
            {activeFilterCount > 0 && (
              <View style={FF.filterBadge}>
                <Text style={FF.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
            <Ionicons
              name={showFilter ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={activeFilterCount > 0 ? '#fff' : '#64748B'}
            />
          </TouchableOpacity>

          {/* Nút Sắp xếp theo ngày giao đơn */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={FF.filterBtn}
              onPress={() => setShowSort(p => !p)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-vertical-outline" size={15} color="#64748B" />
              <Text style={FF.filterBtnText}>
                {sortOrder === 'asc' ? 'Xa nhất trước' : 'Gần nhất trước'}
              </Text>
              <Ionicons name={showSort ? 'chevron-up' : 'chevron-down'} size={13} color="#64748B" />
            </TouchableOpacity>

            {showSort && (
              <View style={[FF.dropdown, { position: 'absolute', top: '100%', left: 0, minWidth: 200 }]}>
                {[
                  { key: 'asc', label: 'Ngày giao gần nhất → xa nhất', icon: 'arrow-down-outline' },
                  { key: 'desc', label: 'Ngày giao xa nhất → gần nhất', icon: 'arrow-up-outline' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[FF.chip, sortOrder === opt.key && FF.chipActive, { marginBottom: 4, justifyContent: 'flex-start', gap: 6, flexDirection: 'row', alignItems: 'center' }]}
                    onPress={() => { setSortOrder(opt.key); setShowSort(false); }}
                  >
                    <Ionicons name={opt.icon} size={13} color={sortOrder === opt.key ? '#fff' : '#64748B'} />
                    <Text style={[FF.chipText, sortOrder === opt.key && FF.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Reset nếu có filter active */}
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={FF.resetBtn}
              onPress={() => {
                setPaymentFilter('all');
                setStatusFilter('all');
                setYearFilter('all');
                setMonthFilter('all');
                setSelected(null);
              }}
            >
              <Ionicons name="close-circle" size={14} color="#EF4444" />
              <Text style={FF.resetText}>Xoá lọc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown panel */}
        {showFilter && (
          <View style={FF.dropdown}>

            {/* Hình thức thanh toán */}
            <View style={FF.filterRow}>
              <Text style={FF.groupLabel}>Loại</Text>
              <View style={FF.chipRow}>
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'customer', label: 'Khách hàng' },
                  { key: 'company', label: 'Người bán' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[FF.chip, paymentFilter === opt.key && FF.chipActive]}
                    onPress={() => { setPaymentFilter(opt.key); setSelected(null); }}
                  >
                    <Text style={[FF.chipText, paymentFilter === opt.key && FF.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Trạng thái */}
            <View style={FF.filterRow}>
              <Text style={FF.groupLabel}>Trạng thái</Text>
              <View style={FF.chipRow}>
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'Chờ xác nhận', label: 'Chờ xác nhận' },
                  { key: 'processing', label: 'Đang xử lý' },
                  { key: 'Chờ thanh toán', label: 'Chờ thanh toán' },
                  { key: 'Đã thanh toán', label: 'Đã thanh toán' },
                  { key: 'Đã hủy', label: 'Đã hủy' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[FF.chip, statusFilter === opt.key && FF.chipActive]}
                    onPress={() => { setStatusFilter(opt.key); setSelected(null); }}
                  >
                    <Text style={[FF.chipText, statusFilter === opt.key && FF.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Năm + Tháng cùng hàng */}
            <View style={FF.filterRow}>
              <Text style={FF.groupLabel}>Năm / Tháng</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={FF.chipRow}>
                  {yearOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[FF.chip, yearFilter === opt.key && FF.chipActive]}
                      onPress={() => { setYearFilter(opt.key); setSelected(null); }}
                    >
                      <Text style={[FF.chipText, yearFilter === opt.key && FF.chipTextActive]}>
                        {opt.label === 'Tất cả năm' ? 'Tất cả' : opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={FF.divider} />
                  {monthOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[FF.chip, monthFilter === opt.key && FF.chipActive]}
                      onPress={() => { setMonthFilter(opt.key); setSelected(null); }}
                    >
                      <Text style={[FF.chipText, monthFilter === opt.key && FF.chipTextActive]}>
                        {opt.label === 'Tất cả tháng' ? 'Tất cả' : `T${parseInt(opt.key)}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

          </View>
        )}
      </View>



      <View style={cardStyles.splitLayout}>
        <View style={cardStyles.card}>
          {isDesktop && (
            <>
              <TableHeader role={role} showCost={showCostField} showCreator={showCreator} tableStyles={tableStyles} />
              <TotalRow
                totalCost={totalCostFiltered}
                totalRevenue={totalRevenueFiltered}
                showCost={showCostField}
                showCreator={showCreator}
                tableStyles={tableStyles}
              />

            </>
          )}
          {loading && !refreshing ? (
            <EmptyState loading />
          ) : filtered.length === 0 ? (
            <EmptyState
              empty
              icon="receipt-outline"
              title={query ? 'Không tìm thấy' : 'Chưa có đơn hàng'}
              actionLabel={'Tạo đơn hàng'}
              canAdd={canAdd(role)}
              onAction={() => router.push('/addOrder')}
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

                  tableStyles={tableStyles}
                  showCreator={showCreator}
                  creatorNames={creatorNames}
                />
              )}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
              showsVerticalScrollIndicator={true}
              indicatorStyle="black"
              style={{ flex: 1 }}
              contentContainerStyle={tableStyles.listContainer}
            />
          )}
        </View>

        {isDesktop && selected && (
          <OrderDetail
            order={selected}
            role={role}
            onClose={() => setSelected(null)}
            onUpdated={updated => {
              if (updated?._deleted) {
                // Không set selected = updated (order đã xoá) — để useEffect ở trên
                // hoặc onClose (đã gọi từ OrderDetail) xử lý việc đóng panel.
                setSelected(null);
                refresh();
                return;
              }
              setSelected(updated);
              refresh();
            }}
          />
        )}
      </View>
    </TabScreenLayout >
  );
}

const COL = {
  lead: { width: 36 },
  order: { flex: 2, minWidth: 160 },
  date: { flex: 1, minWidth: 90 },
  sub: { flex: 1.5, minWidth: 140 },
  cost: { width: 105, flexShrink: 0, alignItems: 'flex-end', paddingRight: 8 },
  amount: { width: 115, flexShrink: 0, alignItems: 'flex-end', paddingRight: 8 },
  status: { width: 135, flexShrink: 0 },
  trail: { width: 20 },
  creator: { width: 140, flexShrink: 0 },
};

const ROW = StyleSheet.create({
  avatar: { height: 36, borderRadius: THEME.radius.sm, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  orderId: { fontSize: 13, fontWeight: '700', color: THEME.colors.textPrimary },
  customer: { fontSize: 12, color: THEME.colors.textSecondary },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: THEME.radius.sm },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cellAmount: {
    fontSize: 13, fontWeight: '500',
    color: THEME.colors.textPrimary,
    textAlign: 'right',   // ← đổi từ 'center' → 'right'
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, textAlign: 'center' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  textStrike: { textDecorationLine: 'line-through', color: THEME.colors.textMuted },
  textMuted: { color: THEME.colors.textMuted },
  paymentBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'center',  // ← căn giữa trong cột
  },
  paymentText: { fontSize: 11, fontWeight: '600' },
  cellCreator: { lineHeight: 14 },
  cellMuted: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    width: '100%',        // ← đảm bảo textAlign có tác dụng
  },
});
// Thêm StyleSheet YF
const YF = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#1E3A8A', borderColor: '#1E3A8A',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#fff' },
});


const FF = StyleSheet.create({
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterBtnActive: {
    backgroundColor: '#1E3A8A', borderColor: '#1E3A8A',
  },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterBadge: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#1E3A8A' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  resetText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  dropdown: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,                     // ← giảm gap giữa các row
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },

  // Mới: mỗi nhóm là 1 hàng ngang label + chips
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  groupLabel: {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.5,
    width: 62,                  // ← fixed width để các chips thẳng hàng
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4,   // ← nhỏ hơn chút
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#fff' },

  // Mới: ngăn cách giữa năm và tháng
  divider: {
    width: 1, backgroundColor: '#E2E8F0',
    marginHorizontal: 4, alignSelf: 'stretch',
  },
});
