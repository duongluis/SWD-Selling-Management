// app/(tabs)/customer.jsx
import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import CustomerDetail from '@/components/UI/CustomerDetail';
import StatBar from '@/components/UI/StatBar';
import { fmtDate, fmtPhone, getInitials } from '@/components/Utils/formatters';
import { canAdd, isCTV } from '@/components/Utils/roleHelper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet, Text, TouchableOpacity, View
} from 'react-native';

import { useLayout } from '@/components/Main/TabScreenLayout';
import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

function TableHead({ tableStyles }) {
  const { isDesktop } = useLayout();
  if (!isDesktop) return null;
  return (
    <View style={tableStyles.head}>
      <View style={{ width: 46 }} />
      <Text style={[tableStyles.th, { flex: 2 }]}>Khách hàng</Text>
      <Text style={[tableStyles.th, { flex: 1 }]}>Điện thoại</Text>
      <Text style={[tableStyles.th, { flex: 1 }]}>Ngày tạo</Text>
      <Text style={[tableStyles.th, { flex: 1.2 }]}>Tạo bởi</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

function CustomerRow({ item, index, isActive, onPress, tableStyles }) {
  const color = COLORS[index % COLORS.length];
  const { isDesktop } = useLayout();
  return (
    <TouchableOpacity
      style={[tableStyles.row, isActive && tableStyles.rowActive]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      {isActive && <View style={tableStyles.leftAccent} />}
      <View style={[R.avatar, { backgroundColor: color + '20' }]}>
        <Text style={[R.avatarText, { color }]}>{getInitials(item.name)}</Text>
      </View>
      <View style={[R.col, { flex: 2 }]}>
        <Text style={R.name} numberOfLines={1}>{item.name || '—'}</Text>
        {!isDesktop && <Text style={R.sub}>{item.phone || '—'}</Text>}
      </View>
      {isDesktop && <Text style={[R.col, R.txt, { flex: 1 }]}>{fmtPhone(item.phone)}</Text>}
      {isDesktop && <Text style={[R.col, R.sub2, { flex: 1 }]}>{fmtDate(item.createdAt)}</Text>}
      {isDesktop && (
        <View style={[R.col, { flex: 1.2 }]}>
          <Text style={R.createdBy} numberOfLines={1}>{item.createdBy || '—'}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
    </TouchableOpacity>
  );
}
const R = StyleSheet.create({
  avatar: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 13, fontWeight: '800' },
  col: { paddingHorizontal: 4 },
  name: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  sub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  txt: { fontSize: 13, color: '#374151' },
  sub2: { fontSize: 12, color: '#94A3B8' },
  createdBy: { fontSize: 11, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
});

export default function CustomerScreen() {
  const router = useRouter();
  const { data, loading, refreshing, refresh, stats, role } = useScreenData('customers');
  const { query, setQuery, result } = useSearch(data, ['name', 'phone', 'email']);
  const [selected, setSelected] = useState(null);
  const { isDesktop } = useLayout();
  const { styles: cardStyles } = useCardStyles();
  const { styles: tableStyles } = useTableStyles();

  useFocusEffect(useCallback(() => {
    if (isCTV(role)) router.replace('/customerCTV');
  }, [role]));

  const statCards = [
    { icon: 'people-outline', label: 'Tổng khách hàng', value: String(stats.total || 0), color: '#2563EB', bg: '#EFF6FF' },
  ];

  const handlePress = (item) => {
    if (isDesktop) {
      setSelected(p => p?.docId === item.docId ? null : item);
    } else {
      router.push({ pathname: '/CustomerView/[customerID]', params: { customerid: item.docId, customerParam: JSON.stringify(item) } });
    }
  };

  return (
    <TabScreenLayout>
      <ScreenHeader
        title="Khách hàng"
        subtitle={`${stats.total || 0} khách hàng`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Tìm tên, SĐT..."
        actionLabel={canAdd(role) && isDesktop ? ' Thêm khách hàng' : undefined}
        actionIcon="add"
        onAction={canAdd(role) ? () => router.push('/addCustomer') : undefined}
      />
      <StatBar stats={statCards} />

      <View style={cardStyles.splitLayout}>
        <View style={cardStyles.card}>
          <TableHead tableStyles={tableStyles} />
          {loading && !refreshing ? <EmptyState loading /> :
            result.length === 0 ? (
              <EmptyState empty icon="people-outline"
                title={query ? 'Không tìm thấy' : 'Chưa có khách hàng'}
                actionLabel={canAdd(role) ? 'Thêm khách hàng' : undefined}
                onAction={canAdd(role) ? () => router.push('/addCustomer') : undefined}
              />
            ) : (
              <FlatList
                data={result}
                keyExtractor={(item, i) => item.docId || String(i)}
                renderItem={({ item, index }) => (
                  <CustomerRow
                    item={item} index={index}
                    isActive={selected?.docId === item.docId}
                    onPress={handlePress}
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
          <CustomerDetail
            customer={selected}
            onClose={() => setSelected(null)}
            onEdit={() => { setSelected(null); router.push({ pathname: '/editCustomer/[customerID]', params: { customerId: selected.docId } }); }}
          />
        )}
      </View>
    </TabScreenLayout>
  );
}