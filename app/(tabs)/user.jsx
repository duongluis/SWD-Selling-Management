// app/(tabs)/user.jsx

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
    FlatList, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { useLayout } from '@/components/Main/TabScreenLayout';
import { useCardStyles } from '@/components/Styles/cardStyles';
import { useTableStyles } from '@/components/Styles/tableStyles';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

const ROLE_GRID_CFG = {
    'đại lý': { label: 'Đại lý', c: '#2563EB', bg: '#EFF6FF' },
    'cộng tác viên': { label: 'CTV', c: '#7C3AED', bg: '#F5F3FF' },
    'Đối tác': { label: 'Đối tác', c: '#059669', bg: '#ECFDF5' },
    'admin': { label: 'Admin', c: '#64748B', bg: '#F1F5F9' },
};
const rcfg = r => ROLE_GRID_CFG[(r || '').toLowerCase()] || ROLE_GRID_CFG[r] || { label: r || '—', c: '#64748B', bg: '#F1F5F9' };

const FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'unverified', label: 'Chờ duyệt' },
    { key: 'verified', label: 'Đã xác minh' },
];

function TableHead({ tableStyles, isDesktop }) {
    if (!isDesktop) return null;
    return (
        <View style={tableStyles.head}>
            <View style={{ width: 46 }} />
            <Text style={[tableStyles.th, { flex: 2 }]}>Người dùng</Text>
            <Text style={[tableStyles.th, { flex: 1 }]}>Vai trò</Text>
            <Text style={[tableStyles.th, { flex: 1 }]}>Ngày tạo</Text>
            <Text style={[tableStyles.th, { flex: 1 }]}>Trạng thái</Text>
            <View style={{ width: 20 }} />
        </View>
    );
}

function UserRow({ item, index, isActive, onPress, tableStyles, isDesktop }) {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const role = rcfg(item.role || item.member);
    return (
        <TouchableOpacity
            style={[tableStyles.row, isActive && tableStyles.rowActive, item.locked ? styles.rowLocked : !item.verified && styles.rowPending]}
            onPress={() => onPress(item)}
            activeOpacity={0.72}
        >
            {isActive && <View style={tableStyles.leftAccent} />}
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
            {isDesktop && (
                <View style={[R.col, { flex: 1 }]}>
                    <View style={[R.rolePill, { backgroundColor: role.bg }]}>
                        <Text style={[R.roleText, { color: role.c }]}>{role.label}</Text>
                    </View>
                </View>
            )}
            {/* Ngày tạo */}
            {isDesktop && <Text style={[R.col, R.colSub, { flex: 1 }]}>{fmtDate(item.createdAt)}</Text>}
            {/* Status */}
            <View style={[R.col, { flex: isDesktop ? 1 : undefined }]}>
                {item.locked ? (
                    <View style={[R.pill, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="lock-closed" size={13} color="#DC2626" />
                        <Text style={[R.pillText, { color: '#DC2626' }]}>Bị khóa</Text>
                    </View>
                ) : item.verified ? (
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

    const { isDesktop } = useLayout();
    const { styles: cardStyles } = useCardStyles();
    const { styles: tableStyles } = useTableStyles();

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

    const handlePress = (item) => {
        setSelected(p => p?.email === item.email ? null : item);
    };

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

            <View style={cardStyles.splitLayout}>
                <View style={cardStyles.card}>
                    <TableHead tableStyles={tableStyles} isDesktop={isDesktop} />
                    {loading && !refreshing ? <EmptyState loading /> :
                        filtered.length === 0 ? (
                            <EmptyState empty icon="people-outline" title={query ? 'Không tìm thấy' : 'Không có người dùng'} />
                        ) : (
                            <FlatList
                                data={filtered}
                                keyExtractor={(item) => item.email || item.docId}
                                renderItem={({ item, index }) => (
                                    <UserRow
                                        item={item} index={index}
                                        isActive={selected?.email === item.email}
                                        onPress={handlePress}
                                        tableStyles={tableStyles}
                                        isDesktop={isDesktop}
                                    />
                                )}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                                contentContainerStyle={tableStyles.listContainer}
                            />
                        )}
                </View>

                {/* Desktop view: Hiện split-panel bên phải */}
                {isDesktop && selected && (
                    <UserDetail
                        user={selected}
                        onClose={() => setSelected(null)}
                        onUpdated={u => { setSelected(u); refresh(); }}
                    />
                )}
            </View>

            {/* Mobile view: Hiện UserDetail dạng Modal lớp phủ phía dưới */}
            {!isDesktop && selected && (
                <Modal visible={!!selected} animationType="slide" transparent>
                    <View style={styles.modalBackdrop}>
                        <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)} />
                        <View style={styles.modalContent}>
                            <UserDetail
                                user={selected}
                                onClose={() => setSelected(null)}
                                onUpdated={u => { setSelected(u); refresh(); }}
                            />
                        </View>
                    </View>
                </Modal>
            )}
        </TabScreenLayout>
    );
}

const styles = StyleSheet.create({
    rowPending: { borderLeftWidth: 3, borderLeftColor: '#FDE68A' },
    rowLocked: { borderLeftWidth: 3, borderLeftColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { height: '80%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
});