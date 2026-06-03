// app/(tabs)/service.jsx — table style with type filter, responsive split-view

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import { showAlert } from '@/components/Main/showAlert';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import ServiceDetail from '@/components/UI/ServiceDetail';
import StatBar from '@/components/UI/StatBar';
import { getSupportRoomId, sendSystemMessage } from '@/components/Utils/chatService';
import { fmtDate } from '@/components/Utils/formatters';
import { isCTV } from '@/components/Utils/roleHelper';
import { isServiceStatusLocked, syncOrderStatusFromService } from '@/components/Utils/syncOrderStatus';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions, FlatList, Modal,
  Pressable, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';
import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';


const AVATAR_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

const STATUS_CFG = {
  'Chờ xử lý': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  'Đang xử lý': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
  'Hoàn thành': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
  'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
};
const scfg = s => STATUS_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };
const STATUS_OPTIONS = ['Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Đã hủy'];

function SvcQuickMenu({ status, onSelect, style }) {
  return (
    <View style={[QM.menu, style]}>
      {STATUS_OPTIONS.map(st => {
        const cfg = scfg(st);
        const active = st === status;
        return (
          <TouchableOpacity key={st}
            style={[QM.item, active && { backgroundColor: cfg.bg }]}
            onPress={() => onSelect(st)}
          >
            <View style={[QM.dot, { backgroundColor: cfg.c }]} />
            <Text style={[QM.text, { color: active ? cfg.c : '#374151', fontWeight: active ? '700' : '500' }]}>{st}</Text>
            {active && <Ionicons name="checkmark" size={13} color={cfg.c} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const QM = StyleSheet.create({
  menu: { position: 'absolute', zIndex: 999, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 180, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 13 },
});

const TYPE_CFG = {
  INSTALLATION: { icon: 'build-outline', label: 'Lắp đặt', c: '#7C3AED', bg: '#F5F3FF' },
  DELIVERY: { icon: 'car-outline', label: 'Giao hàng', c: '#2563EB', bg: '#EFF6FF' },
  MAINTENANCE: { icon: 'construct-outline', label: 'Bảo dưỡng', c: '#EA580C', bg: '#FFF7ED' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Chờ xử lý', label: 'Chờ xử lý' },
  { key: 'Đang xử lý', label: 'Đang xử lý' },
  { key: 'Hoàn thành', label: 'Hoàn thành' },
  { key: 'Đã hủy', label: 'Đã hủy' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  ...Object.entries(TYPE_CFG).map(([key, cfg]) => ({ key, label: cfg.label })),
];

function TableHead({ tableStyles, isDesktop }) {
  if (!isDesktop) return null;
  return (
    <View style={tableStyles.head}>
      <View style={{ width: 42 }} />
      <Text style={[tableStyles.th, { flex: 1.8 }]}>Dịch vụ</Text>
      <Text style={[tableStyles.th, { flex: 1 }]}>Khách hàng</Text>
      <Text style={[tableStyles.th, { flex: 0.8 }]}>Loại</Text>
      <Text style={[tableStyles.th, { flex: 0.8 }]}>Ngày tạo</Text>
      <Text style={[tableStyles.th, { flex: 1 }]}>Trạng thái</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

function ServiceRow({ item, index, isActive, onPress, isAdmin, onStatusPress, tableStyles, isDesktop }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const tcfg = TYPE_CFG[item.type] || TYPE_CFG.INSTALLATION;
  const scf = scfg(item.status);
  const pillRef = useRef(null);
  const canQuick = isAdmin && !isServiceStatusLocked(item.status);

  const handleStatusPillPress = () => {
    pillRef.current?.measure((_fx, _fy, w, h, pageX, pageY) => {
      const sw = Dimensions.get('window').width;
      onStatusPress?.(item, { top: pageY + h + 4, right: sw - pageX - w });
    });
  };

  return (
    <TouchableOpacity
      style={[tableStyles.row, isActive && tableStyles.rowActive]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      {isActive && <View style={tableStyles.leftAccent} />}
      <View style={[R.avatar, { backgroundColor: color + '22' }]}>
        <Ionicons name={tcfg.icon} size={17} color={color} />
      </View>
      <View style={[R.col, { flex: 1.8 }]}>
        <Text style={R.id} numberOfLines={1}>#{item.id.slice(0, 9) || item.docId?.slice(-6)}</Text>
        {item.orderId && <Text style={R.sub}>Đơn: #{item.orderId}</Text>}
      </View>
      {isDesktop && <Text style={[R.col, R.colText, { flex: 1 }]} numberOfLines={1}>{item.customer || '—'}</Text>}
      {isDesktop && (
        <View style={[R.col, { flex: 0.8 }]}>
          <View style={[R.typePill, { backgroundColor: tcfg.bg }]}>
            <Text style={[R.typeText, { color: tcfg.c }]}>{tcfg.label}</Text>
          </View>
        </View>
      )}
      {isDesktop && <Text style={[R.col, R.colSub, { flex: 0.8 }]}>{fmtDate(item.createdAt)}</Text>}
      <View style={[R.col, { flex: isDesktop ? 1 : undefined }]}>
        {canQuick ? (
          <TouchableOpacity ref={pillRef} onPress={handleStatusPillPress} activeOpacity={0.75} style={{ alignSelf: 'flex-start' }}>
            <View style={[R.pill, R.pillClickable, { backgroundColor: scf.bg, borderColor: scf.bd }]}>
              <View style={[R.dot, { backgroundColor: scf.c }]} />
              <Text style={[R.pillText, { color: scf.c }]}>{item.status || 'Chờ xử lý'}</Text>
              <Ionicons name="chevron-down" size={10} color={scf.c} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[R.pill, { backgroundColor: scf.bg }]}>
            <View style={[R.dot, { backgroundColor: scf.c }]} />
            <Text style={[R.pillText, { color: scf.c }]}>{item.status || 'Chờ xử lý'}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
    </TouchableOpacity>
  );
}
const R = StyleSheet.create({
  avatar: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  col: { paddingHorizontal: 4 },
  colText: { fontSize: 13, color: '#374151' },
  colSub: { fontSize: 12, color: '#94A3B8' },
  id: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  sub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  typeText: { fontSize: 11, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  pillClickable: { borderWidth: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
});

export default function ServiceScreen() {
  const router = useRouter();
  const { data, loading, refreshing, refresh, stats, role } = useScreenData('services');
  const { query, setQuery, result: searchResult } = useSearch(data, ['id', 'customer'], 'status');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [quickMenu, setQuickMenu] = useState(null);
  const isAdmin = role === 'admin';

  const { isDesktop } = useLayout(); // dùng isDesktop từ useLayout
  const { styles: tableStyles } = useTableStyles();
  const { styles: cardStyles } = useCardStyles();

  const filteredData = useMemo(() => {
    let filtered = searchResult;
    if (statusFilter !== 'all') filtered = filtered.filter(item => item.status === statusFilter);
    if (typeFilter !== 'all') filtered = filtered.filter(item => item.type === typeFilter);
    return filtered;
  }, [searchResult, statusFilter, typeFilter]);

  const statCards = [
    { icon: 'build-outline', label: 'Tổng DV', value: String(stats.total || 0), color: '#8B5CF6', bg: '#F5F3FF' },
    { icon: 'checkmark-circle-outline', label: 'Hoàn thành', value: String(stats.done || 0), color: '#16A34A', bg: '#DCFCE7' },
    { icon: 'time-outline', label: 'Chờ xử lý', value: String(stats.pending || 0), color: '#D97706', bg: '#FFFBEB' },
  ];

  const handlePress = item => {
    if (isDesktop) {
      setSelected(p => p?.docId === item.docId ? null : item);
    } else {
      router.push({ pathname: '/ServiceView/[serviceID]', params: { serviceID: item.docId, serviceParam: JSON.stringify(item) } });
    }
  };

  const handleStatusPress = (item, pos) => setQuickMenu({ item, pos });
  const handleQuickStatusChange = (newStatus) => {
    const item = quickMenu?.item;
    setQuickMenu(null);
    if (!item || newStatus === item.status) return;
    showAlert('Cập nhật trạng thái', `Chuyển sang "${newStatus}"?`, async () => {
      try {
        await updateDoc(doc(db, 'service', item.docId), { status: newStatus });
        syncOrderStatusFromService({ type: item.type, orderId: item.orderId, phone: item.phone }, newStatus);
        const creatorEmail = item.createdBy;
        if (creatorEmail) {
          const roomId = getSupportRoomId(creatorEmail);
          const message = `🔧 **Cập nhật dịch vụ:** Dịch vụ #${item.id || item.docId.slice(-6)} (Khách: ${item.customer}) đã được cập nhật trạng thái thành: **${newStatus}**`;
          await sendSystemMessage(roomId, message);
        }
        refresh();
      } catch (e) { showAlert('Lỗi', e.message); }
    });
  };

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Dịch vụ"
        subtitle={`${stats.total || 0} dịch vụ`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Tìm dịch vụ, khách hàng..."
        actionLabel={!isCTV(role) && isDesktop ? ' Đăng ký dịch vụ' : undefined}
        actionIcon="add"
        onAction={!isCTV(role) ? () => router.push('/addService') : undefined}
      />
      <StatBar stats={statCards} />
      <FilterChips options={STATUS_FILTERS} value={statusFilter} onChange={f => { setStatusFilter(f); setSelected(null); }} />
      <FilterChips options={TYPE_FILTERS} value={typeFilter} onChange={f => { setTypeFilter(f); setSelected(null); }} />

      <View style={cardStyles.splitLayout}>
        <View style={cardStyles.card}>
          <TableHead tableStyles={tableStyles} isDesktop={isDesktop} />
          {loading && !refreshing ? <EmptyState loading /> :
            filteredData.length === 0 ? (
              <EmptyState empty icon="build-outline"
                title={query ? 'Không tìm thấy' : 'Chưa có dịch vụ'}
                actionLabel={!isCTV(role) ? 'Tạo dịch vụ' : undefined}
                onAction={!isCTV(role) ? () => router.push('/addService') : undefined}
              />
            ) : (
              <FlatList
                data={filteredData}
                keyExtractor={(item, i) => item.docId || String(i)}
                renderItem={({ item, index }) => (
                  <ServiceRow
                    item={item} index={index}
                    isActive={selected?.docId === item.docId}
                    onPress={handlePress}
                    isAdmin={isAdmin}
                    onStatusPress={handleStatusPress}
                    tableStyles={tableStyles}
                    isDesktop={isDesktop}
                  />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={tableStyles.listContainer}
              />
            )}
        </View>
        {isDesktop && selected && (
          <ServiceDetail
            service={selected}
            onClose={() => setSelected(null)}
            onUpdated={u => { setSelected(u); refresh(); }}
          />
        )}
      </View>

      <Modal visible={!!quickMenu} transparent animationType="fade" onRequestClose={() => setQuickMenu(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'transparent' }} onPress={() => setQuickMenu(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <SvcQuickMenu
              status={quickMenu?.item?.status}
              onSelect={handleQuickStatusChange}
              style={{ top: quickMenu?.pos?.top, right: quickMenu?.pos?.right }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </TabScreenLayout>
  );
}