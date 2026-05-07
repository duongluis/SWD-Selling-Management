// app/(tabs)/users.jsx — table style

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import FilterChips from '@/components/UI/FilterChips';
import StatBar from '@/components/UI/StatBar';
import UserDetail from '@/components/UI/UserDetail';
import { fmtDate, getInitials } from '@/components/Utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    FlatList, Platform, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const isWeb = Platform.OS === 'web';
const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

const ROLE_CFG = {
    'đại lý': { label: 'Đại lý', c: '#2563EB', bg: '#EFF6FF' },
    'cộng tác viên': { label: 'CTV', c: '#7C3AED', bg: '#F5F3FF' },
    'Đối tác': { label: 'Đối tác', c: '#059669', bg: '#ECFDF5' },
    'admin': { label: 'Admin', c: '#64748B', bg: '#F1F5F9' },
};
const rcfg = r => ROLE_CFG[(r || '').toLowerCase()] || ROLE_CFG[r] || { label: r || '—', c: '#64748B', bg: '#F1F5F9' };

const FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unverified', label: 'Chờ duyệt' },
    { key: 'verified', label: 'Đã xác minh' },
];

function TableHead() {
    if (!isWeb) return null;
    return (
        <View style={T.head}>
            <View style={{ width: 46 }} />
            <Text style={[T.hcell, { flex: 2 }]}>Người dùng</Text>
            <Text style={[T.hcell, { flex: 1 }]}>Vai trò</Text>
            <Text style={[T.hcell, { flex: 1 }]}>Ngày tạo</Text>
            <Text style={[T.hcell, { flex: 1 }]}>Trạng thái</Text>
            <View style={{ width: 20 }} />
        </View>
    );
}
const T = StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    hcell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.06, paddingHorizontal: 4 },
});

function UserRow({ item, index, isActive, onPress }) {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const role = rcfg(item.role || item.member);
    return (
        <TouchableOpacity
            style={[R.row, isActive && R.rowActive, !item.verified && R.rowPending]}
            onPress={() => onPress(item)}
            activeOpacity={0.72}
        >
            {isActive && <View style={R.leftBar} />}
            {/* Avatar */}
            <View style={[R.avatar, { backgroundColor: color + '22' }]}>
                <Text style={[R.avatarText, { color }]}>{getInitials(item.name || item.companyName)}</Text>
                {!item.verified && <View style={R.pendingDot} />}
            </View>
            {/* Tên + email */}
            <View style={[R.col, { flex: 2 }]}>
                <Text style={R.name} numberOfLines={1}>{item.name || item.companyName || '—'}</Text>
                <Text style={R.sub} numberOfLines={1}>{item.email}</Text>
            </View>
            {/* Vai trò */}
            {isWeb && (
                <View style={[R.col, { flex: 1 }]}>
                    <View style={[R.rolePill, { backgroundColor: role.bg }]}>
                        <Text style={[R.roleText, { color: role.c }]}>{role.label}</Text>
                    </View>
                </View>
            )}
            {/* Ngày tạo */}
            {isWeb && <Text style={[R.col, R.colSub, { flex: 1 }]}>{fmtDate(item.createdAt)}</Text>}
            {/* Verified */}
            <View style={[R.col, { flex: isWeb ? 1 : undefined }]}>
                {item.verified ? (
                    <View style={[R.pill, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                        <Text style={[R.pillText, { color: '#16A34A' }]}>Đã duyệt</Text>
                    </View>
                ) : (
                    <View style={[R.pill, { backgroundColor: '#FFFBEB' }]}>
                        <Ionicons name="time" size={13} color="#D97706" />
                        <Text style={[R.pillText, { color: '#D97706' }]}>Chờ duyệt</Text>
                    </View>
                )}
            </View>
            <Ionicons name="chevron-forward" size={14} color={isActive ? '#2563EB' : '#CBD5E1'} />
        </TouchableOpacity>
    );
}
const R = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10, position: 'relative' },
    rowActive: { backgroundColor: '#F0F7FF' },
    rowPending: { borderLeftWidth: 3, borderLeftColor: '#FDE68A' },
    leftBar: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 3, backgroundColor: '#2563EB', borderRadius: 2 },
    avatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
    avatarText: { fontSize: 13, fontWeight: '800' },
    pendingDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B', borderWidth: 1.5, borderColor: '#fff' },
    col: { paddingHorizontal: 4 },
    colSub: { fontSize: 12, color: '#94A3B8' },
    name: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    sub: { fontSize: 11, color: '#64748B', marginTop: 1 },
    rolePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    roleText: { fontSize: 11, fontWeight: '700' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    pillText: { fontSize: 11, fontWeight: '700' },
});

export default function UsersScreen() {
    const router = useRouter();
    const { data, loading, refreshing, refresh, stats, role } = useScreenData('users');
    const { query, setQuery, result } = useSearch(data, ['name', 'email', 'phone']);
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);

    const filtered = useMemo(() =>
        filter === 'all' ? result
            : filter === 'verified' ? result.filter(u => u.verified)
                : result.filter(u => !u.verified)
        , [result, filter]);

    const statCards = [
        { icon: 'people-outline', label: 'Tổng', value: String(stats.total || 0), color: '#2563EB', bg: '#EFF6FF' },
        { icon: 'checkmark-circle-outline', label: 'Đã duyệt', value: String(stats.verified || 0), color: '#16A34A', bg: '#DCFCE7' },
        { icon: 'time-outline', label: 'Chờ duyệt', value: String(stats.unverified || 0), color: '#D97706', bg: '#FFFBEB' },
    ];

    if (role !== 'admin') return (
        <TabScreenLayout>
            <EmptyState empty icon="lock-closed-outline" title="Không có quyền truy cập" />
        </TabScreenLayout>
    );

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Người dùng"
                subtitle={`${stats.unverified || 0} chờ duyệt · ${stats.total || 0} tổng`}
                searchValue={query}
                onSearchChange={setQuery}
                searchPlaceholder="Tìm tên, email..."
            />
            <StatBar stats={statCards} />
            <FilterChips options={FILTERS} value={filter} onChange={f => { setFilter(f); setSelected(null); }} />

            <View style={{ flex: 1, flexDirection: 'row' }}>
                <View style={WRAP.card}>
                    <TableHead />
                    {loading && !refreshing ? <EmptyState loading /> :
                        filtered.length === 0 ? (
                            <EmptyState empty icon="people-outline" title={query ? 'Không tìm thấy' : 'Không có người dùng'} />
                        ) : (
                            <FlatList
                                data={filtered}
                                keyExtractor={item => item.email || item.docId}
                                renderItem={({ item, index }) => (
                                    <UserRow item={item} index={index}
                                        isActive={selected?.email === item.email}
                                        onPress={setSelected}
                                    />
                                )}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                                contentContainerStyle={{ paddingBottom: isWeb ? 60 : 100 }}
                            />
                        )}
                </View>
                {isWeb && selected && (
                    <UserDetail
                        user={selected}
                        onClose={() => setSelected(null)}
                        onUpdated={u => { setSelected(u); refresh(); }}
                    />
                )}
            </View>
        </TabScreenLayout>
    );
}

const WRAP = StyleSheet.create({
    card: {
        flex: 1, backgroundColor: '#fff',
        borderRadius: isWeb ? 14 : 0, borderWidth: 1, borderColor: '#E2E8F0',
        overflow: 'hidden', margin: isWeb ? 16 : 0, marginTop: 0,
        shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
});