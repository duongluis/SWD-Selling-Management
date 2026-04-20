import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// ── Helpers ──────────────────────────────────────────────────
const ROLE_CONFIG = {
    'đại lý': { color: '#2563EB', bg: '#EFF6FF', icon: 'storefront-outline', label: 'Đại lý' },
    'dealer': { color: '#2563EB', bg: '#EFF6FF', icon: 'storefront-outline', label: 'Đại lý' },
    'nhà phân phối': { color: '#7C3AED', bg: '#F5F3FF', icon: 'car-outline', label: 'Nhà phân phối' },
    'distributor': { color: '#7C3AED', bg: '#F5F3FF', icon: 'car-outline', label: 'Nhà phân phối' },
    'cộng tác viên': { color: '#059669', bg: '#ECFDF5', icon: 'people-outline', label: 'Cộng tác viên' },
    'ctv': { color: '#059669', bg: '#ECFDF5', icon: 'people-outline', label: 'Cộng tác viên' },
};

const getRoleCfg = (role) =>
    ROLE_CONFIG[(role || '').toLowerCase()] ||
    { color: '#64748B', bg: '#F1F5F9', icon: 'person-outline', label: role || 'Chưa rõ' };

const getInitials = (name) => {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

// ── Info Row ─────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }) {
    if (!value) return null;
    return (
        <View style={S.infoRow}>
            <View style={S.infoIcon}>
                <Ionicons name={icon} size={14} color={color || '#64748B'} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={S.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

// ── User Detail Panel ─────────────────────────────────────────
function UserDetailPanel({ user, onClose, onApprove, onReject, loading }) {
    const roleCfg = getRoleCfg(user.role || user.member);
    const isVerified = user.verified === true;

    return (
        <View style={[S.detailPanel, isWeb && S.detailPanelWeb]}>

            {/* Panel header */}
            <View style={S.detailHeader}>
                <Text style={S.detailTitle}>Chi tiết tài khoản</Text>
                <TouchableOpacity onPress={onClose} style={S.detailCloseBtn}>
                    <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

                {/* Identity */}
                <View style={S.detailIdentity}>
                    <View style={[S.detailAvatar, { backgroundColor: roleCfg.color }]}>
                        <Text style={S.detailAvatarText}>{getInitials(user.name)}</Text>
                    </View>
                    <Text style={S.detailName}>{user.name || '—'}</Text>
                    <Text style={S.detailEmail}>{user.email}</Text>
                    <View style={[S.rolePill, { backgroundColor: roleCfg.bg }]}>
                        <Ionicons name={roleCfg.icon} size={12} color={roleCfg.color} />
                        <Text style={[S.rolePillText, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                    </View>
                    {isVerified ? (
                        <View style={S.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={S.verifiedBadgeText}>Đã xác thực</Text>
                        </View>
                    ) : (
                        <View style={S.pendingBadge}>
                            <Ionicons name="time-outline" size={14} color="#F59E0B" />
                            <Text style={S.pendingBadgeText}>Chờ xác thực</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={S.detailCard}>
                    <Text style={S.detailCardTitle}>Thông tin cá nhân</Text>
                    <InfoRow icon="call-outline" label="Số điện thoại" value={user.phone} color="#2563EB" />
                    <InfoRow icon="location-outline" label="Địa chỉ" value={user.address} />
                    <InfoRow icon="calendar-outline" label="Ngày đăng ký" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'} />
                    <InfoRow icon="document-text-outline" label="Ghi chú" value={user.note} />
                </View>

                {/* Action buttons — chỉ khi chưa verify */}
                {!isVerified && (
                    <View style={S.actionRow}>
                        <TouchableOpacity
                            style={[S.rejectBtn, loading && { opacity: 0.6 }]}
                            onPress={onReject}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                            <Text style={S.rejectBtnText}>Từ chối</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[S.approveBtn, loading && { opacity: 0.6 }]}
                            onPress={onApprove}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                            }
                            <Text style={S.approveBtnText}>{loading ? 'Đang xử lý...' : 'Chấp thuận'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function UserView() {
    const { userDetail } = useContext(UserDetailContext);

    const [tab, setTab] = useState('unverified');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null); // user đang xem detail
    const [actionLoading, setActionLoading] = useState(false);

    const role = (userDetail?.role || userDetail?.member || '').toLowerCase();
    const isAdmin = role === 'admin';

    const fetchUsers = async () => {
        try {
            const snap = await getDocs(collection(db, 'users'));
            const data = snap.docs
                .map(d => ({ ...d.data(), docId: d.id }))
                .filter(u => (u.role || u.member || '').toLowerCase() !== 'admin');
            setUsers(data);
        } catch (e) {
            console.error('Lỗi fetch users:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { if (isAdmin) fetchUsers(); }, []);

    if (!isAdmin) {
        return (
            <View style={S.forbidden}>
                <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
                <Text style={S.forbiddenTitle}>Không có quyền truy cập</Text>
                <Text style={S.forbiddenSub}>Chỉ Admin mới xem được trang này</Text>
            </View>
        );
    }

    const verified = users.filter(u => u.verified === true);
    const unverified = users.filter(u => !u.verified);

    const activeList = (tab === 'verified' ? verified : unverified)
        .filter(u =>
            (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.phone || '').includes(search)
        );

    // ── Approve ───────────────────────────────────────────────
    const handleApprove = () => {
        Alert.alert(
            '✅ Chấp thuận tài khoản',
            `Xác thực tài khoản "${selected?.name}"?`,
            [
                { text: 'Huỷ', style: 'cancel' },
                {
                    text: 'Chấp thuận',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await updateDoc(doc(db, 'users', selected.email), {
                                verified: true,
                                verifiedAt: new Date().toISOString(),
                            });
                            setUsers(prev => prev.map(u =>
                                u.email === selected.email ? { ...u, verified: true } : u
                            ));
                            setSelected(prev => ({ ...prev, verified: true }));
                            Alert.alert('✅ Thành công', `Đã xác thực "${selected.name}"`);
                        } catch (e) {
                            Alert.alert('Lỗi', e.message);
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Reject ────────────────────────────────────────────────
    const handleReject = () => {
        Alert.alert(
            '❌ Từ chối tài khoản',
            `Từ chối tài khoản "${selected?.name}"?`,
            [
                { text: 'Huỷ', style: 'cancel' },
                {
                    text: 'Từ chối',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await updateDoc(doc(db, 'users', selected.email), {
                                verified: false,
                                rejected: true,
                                rejectedAt: new Date().toISOString(),
                            });
                            setUsers(prev => prev.filter(u => u.email !== selected.email));
                            setSelected(null);
                            Alert.alert('Đã từ chối', `Tài khoản "${selected.name}" đã bị từ chối.`);
                        } catch (e) {
                            Alert.alert('Lỗi', e.message);
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // ── User Card ─────────────────────────────────────────────
    const renderUser = ({ item, index }) => {
        const cfg = getRoleCfg(item.role || item.member);
        const isSelected = selected?.email === item.email;
        return (
            <TouchableOpacity
                style={[S.userCard, isSelected && S.userCardSelected]}
                onPress={() => setSelected(item)}
                activeOpacity={0.7}
            >
                <View style={[S.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={S.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <View style={S.userInfo}>
                    <Text style={S.userName}>{item.name || 'Chưa có tên'}</Text>
                    <Text style={S.userEmail} numberOfLines={1}>{item.email}</Text>
                    <Text style={S.userPhone}>{item.phone || '—'}</Text>
                </View>
                <View style={S.userMeta}>
                    <View style={[S.roleBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[S.roleBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {item.verified ? (
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    ) : (
                        <View style={S.pendingDot} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const TABS = [
        { key: 'unverified', label: 'Chờ xác thực', count: unverified.length, color: '#F59E0B' },
        { key: 'verified', label: 'Đã xác thực', count: verified.length, color: '#059669' },
    ];

    return (
        <View style={S.container}>

            {/* ── LEFT / MAIN panel ── */}
            <View style={[S.listPanel, selected && isWeb && S.listPanelNarrow]}>

                {/* Header */}
                <View style={S.header}>
                    <View>
                        <Text style={S.headerTitle}>Quản lý tài khoản</Text>
                        <Text style={S.headerSub}>{users.length} người dùng</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setRefreshing(true); fetchUsers(); }}
                        style={S.refreshBtn}
                    >
                        <Ionicons name="refresh-outline" size={17} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <View style={S.statsRow}>
                    {[
                        { label: 'Chờ xác thực', count: unverified.length, color: '#F59E0B' },
                        { label: 'Đã xác thực', count: verified.length, color: '#059669' },
                        { label: 'Tổng', count: users.length, color: '#2563EB' },
                    ].map(s => (
                        <View key={s.label} style={[S.statCard, { borderLeftColor: s.color }]}>
                            <Text style={S.statNum}>{s.count}</Text>
                            <Text style={S.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Search */}
                <View style={S.searchWrap}>
                    <Ionicons name="search-outline" size={15} color="#94A3B8" />
                    <TextInput
                        style={S.searchInput}
                        placeholder="Tìm tên, email, SĐT..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View style={S.tabRow}>
                    {TABS.map(t => (
                        <TouchableOpacity
                            key={t.key}
                            style={[S.tab, tab === t.key && S.tabActive]}
                            onPress={() => { setTab(t.key); setSelected(null); }}
                        >
                            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
                            <View style={[S.tabBadge, { backgroundColor: tab === t.key ? t.color : '#E2E8F0' }]}>
                                <Text style={[S.tabBadgeText, { color: tab === t.key ? '#fff' : '#64748B' }]}>{t.count}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* List */}
                {loading ? (
                    <View style={S.loadingWrap}>
                        <ActivityIndicator color="#2563EB" />
                        <Text style={S.loadingText}>Đang tải...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={activeList}
                        keyExtractor={(item, i) => item.email || String(i)}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} />}
                        contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
                        renderItem={renderUser}
                        ListEmptyComponent={
                            <View style={S.empty}>
                                <View style={S.emptyIcon}>
                                    <Ionicons name="people-outline" size={28} color="#94A3B8" />
                                </View>
                                <Text style={S.emptyText}>
                                    {search ? 'Không tìm thấy kết quả' : tab === 'unverified' ? 'Không có tài khoản chờ xác thực' : 'Chưa có tài khoản được xác thực'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* ── RIGHT / DETAIL panel ── */}
            {selected && (
                // Web: hiện bên phải inline
                // Mobile: hiện overlay toàn màn
                <UserDetailPanel
                    user={selected}
                    onClose={() => setSelected(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    loading={actionLoading}
                />
            )}
        </View>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', flexDirection: isWeb ? 'row' : 'column' },

    // List panel
    listPanel: { flex: 1, paddingHorizontal: isWeb ? 24 : 16, paddingTop: isWeb ? 24 : 30 },
    listPanelNarrow: { flex: isWeb ? 1.2 : 1 },

    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
    headerTitle: { fontSize: isWeb ? 22 : 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

    // Stats — dùng màu border trái theo tông sidebar
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: '#E2E8F0' },
    statNum: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: '600', letterSpacing: 0.3 },

    // Search
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },

    // Tabs — active dùng màu sidebar #0F172A
    tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    tabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#FFFFFF' },
    tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 20, minWidth: 20, alignItems: 'center' },
    tabBadgeText: { fontSize: 10, fontWeight: '700' },

    // User card — selected dùng màu blue accent giống sidebar
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
    userCardSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF', borderWidth: 1.5 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
    userInfo: { flex: 1 },
    userName: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 1 },
    userEmail: { fontSize: 11, color: '#64748B' },
    userPhone: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    userMeta: { alignItems: 'flex-end', gap: 5 },
    roleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    roleBadgeText: { fontSize: 10, fontWeight: '700' },
    pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 },
    loadingText: { fontSize: 13, color: '#94A3B8' },
    empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

    forbidden: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    forbiddenTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
    forbiddenSub: { fontSize: 14, color: '#94A3B8' },

    // ── Detail panel — tông tối giống sidebar ──────────────────
    detailPanel: {
        backgroundColor: '#0F172A',              // ← màu sidebar
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
        padding: 16,
        maxHeight: isWeb ? undefined : '75%',
    },
    detailPanelWeb: {
        width: 300,
        borderTopWidth: 0,
        borderLeftWidth: 1,
        borderLeftColor: '#1E293B',              // ← border sidebar
        maxHeight: undefined,
    },
    detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    detailTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },          // ← text sáng
    detailCloseBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },

    detailIdentity: { alignItems: 'center', paddingVertical: 20, gap: 6, borderBottomWidth: 1, borderBottomColor: '#1E293B', marginBottom: 14 },
    detailAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    detailAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    detailName: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },           // ← text sáng
    detailEmail: { fontSize: 12, color: '#64748B' },
    rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    rolePillText: { fontSize: 12, fontWeight: '700' },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#064E3B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    verifiedBadgeText: { fontSize: 12, color: '#34D399', fontWeight: '600' },           // ← xanh lá sáng trên nền tối
    pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#451A03', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    pendingBadgeText: { fontSize: 12, color: '#FCD34D', fontWeight: '600' },           // ← vàng sáng trên nền tối

    detailCard: { marginBottom: 14 },
    detailCardTitle: { fontSize: 10, fontWeight: '700', color: '#334155', letterSpacing: 0.8, marginBottom: 10 },

    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    infoIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    infoLabel: { fontSize: 10, color: '#475569', marginBottom: 2 },
    infoValue: { fontSize: 13, color: '#E2E8F0', fontWeight: '600' },           // ← text sáng trên nền tối

    // Action buttons — reject giữ đỏ, approve dùng blue accent
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#7F1D1D', backgroundColor: '#1C0A0A' },
    rejectBtnText: { color: '#F87171', fontWeight: '700', fontSize: 13 },
    approveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563EB', shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 10, elevation: 4 },
    approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});