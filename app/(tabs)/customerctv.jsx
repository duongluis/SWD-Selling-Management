// app/(tabs)/customerCTV.jsx

import { useScreenData } from '@/components/Hooks/useScreenData';
import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout, { useLayout } from '@/components/Main/TabScreenLayout';
import CtvDetail from '@/components/UI/ctvDetail'; // ← default import, không phải named
import StatBar from '@/components/UI/StatBar';
import { getInitials } from '@/components/Utils/formatters';
import { canAddCTV, getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react'; // ← thêm useState
import {
    FlatList, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';

const CONSULT_STATUS_CFG = {
    success: { color: '#059669', bg: '#ECFDF5', label: 'Thành công' },
    failed: { color: '#EF4444', bg: '#FEF2F2', label: 'Thất bại' },
    pending: { color: '#2563EB', bg: '#EFF6FF', label: 'Đang tư vấn' },
    none: { color: '#94A3B8', bg: '#F1F5F9', label: 'Chưa tư vấn' },
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

function ConsultCard({ item, index, statusKey, onPress }) {
    const cfg = CONSULT_STATUS_CFG[statusKey] || CONSULT_STATUS_CFG.none;
    return (
        <TouchableOpacity style={C.card} onPress={() => onPress(item)} activeOpacity={0.75}>
            <View style={[C.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={C.avatarText}>{getInitials(item.name)}</Text>
            </View>
            <View style={C.info}>
                <Text style={C.name}>{item.name || '—'}</Text>
                <Text style={C.phone}>{item.phone || '—'}</Text>
            </View>
            <View style={[C.statusPill, { backgroundColor: cfg.bg }]}>
                <View style={[C.statusDot, { backgroundColor: cfg.color }]} />
                <Text style={[C.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
        </TouchableOpacity>
    );
}

export default function CustomerCTVScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const { data: consultList, loading, refreshing, refresh, stats } = useScreenData('consults');
    const { query, setQuery, result } = useSearch(consultList, ['name', 'phone']);
    const { isDesktop } = useLayout();

    const role = getRole(userDetail);
    const [selected, setSelected] = useState(null);  // ← tách ra dòng riêng

    const canAccess = canAddCTV(role) && isDesktop;
    const consultMap = Object.fromEntries(consultList.map(c => [c.docId, c.status || 'none']));

    const statCards = [
        { icon: 'people-outline', label: 'Tổng', value: String(stats.total || 0), color: '#2563EB', bg: '#EFF6FF' },
        { icon: 'checkmark-circle-outline', label: 'Thành công', value: String(stats.success || 0), color: '#10B981', bg: '#ECFDF5' },
        { icon: 'close-circle-outline', label: 'Thất bại', value: String(stats.failed || 0), color: '#EF4444', bg: '#FEF2F2' },
    ];

    const handlePress = (item) => {
        if (isDesktop) {
            setSelected(p => p?.docId === item.docId ? null : item);
        } else {
            router.push({
                pathname: '/CustomerView/[customerID]',
                params: { customerid: item?.docId, customerParam: JSON.stringify(item) },
            });
        }
    };

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Khách hàng của tôi"
                subtitle={`${stats.total || 0} khách hàng đã tư vấn`}
                searchValue={query}
                onSearchChange={setQuery}
                searchPlaceholder="Tìm tên, SĐT..."
                canAccess={canAccess}
                actionLabel="Thêm tư vấn"
                actionIcon="add"
                onAction={() => router.push('/addConsult')}
            />

            <StatBar stats={statCards} />

            {/* ── Split layout: danh sách + panel ── */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    {loading ? (
                        <EmptyState loading />
                    ) : result.length === 0 ? (
                        <EmptyState
                            empty
                            icon="people-outline"
                            title={query ? 'Không tìm thấy' : 'Chưa có khách hàng'}
                            subtitle="Bấm Thêm tư vấn để bắt đầu"
                            actionLabel="Thêm tư vấn"
                            onAction={() => router.push('/addConsult')}
                            canAdd={canAccess}

                        />
                    ) : (
                        <FlatList
                            data={result}
                            keyExtractor={(item, i) => item.docId || String(i)}
                            renderItem={({ item, index }) => (
                                <ConsultCard
                                    item={item}
                                    index={index}
                                    statusKey={consultMap[item.docId] || 'none'}
                                    onPress={handlePress}
                                />
                            )}
                            contentContainerStyle={{
                                paddingHorizontal: isDesktop ? 32 : 16,
                                paddingBottom: 100,
                            }}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                            showsVerticalScrollIndicator={true}
                        />
                    )}
                </View>

                {/* Panel detail — chỉ hiện desktop khi đã chọn */}
                {isDesktop && selected && (
                    <CtvDetail
                        customer={selected}
                        onClose={() => setSelected(null)}
                        onUpdated={(updated) => setSelected(updated)}
                        /* consults dùng static fetch (không realtime) nên phải refresh tay */
                        onDeleted={() => { setSelected(null); refresh(); }}
                    />
                )}
            </View>
        </TabScreenLayout>
    );
}

const C = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    info: { flex: 1 },
    name: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    phone: { fontSize: 12, color: '#64748B', marginTop: 1 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
});