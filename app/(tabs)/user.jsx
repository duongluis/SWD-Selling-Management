import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { showAlert } from '../../components/Main/showAlert';
import { sendApprovalEmailViaFirebase } from '../../components/Utils/firebaseMailService';
import { db } from '../../config/firebaseConfig';

const BG_IMAGE = require('../../assets/images/logo-light.png');

const isWeb = Platform.OS === 'web';

// ── Helpers ──────────────────────────────────────────────────
const ROLE_CONFIG = {
    'đại lý': { color: '#2563EB', bg: '#EFF6FF', icon: 'storefront-outline', label: 'Đại lý' },
    'dealer': { color: '#2563EB', bg: '#EFF6FF', icon: 'storefront-outline', label: 'Đại lý' },
    'đối tác': { color: '#7C3AED', bg: '#F5F3FF', icon: 'car-outline', label: 'đối tác' },
    'distributor': { color: '#7C3AED', bg: '#F5F3FF', icon: 'car-outline', label: 'đối tác' },
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

// ── Info Row (read-only) ──────────────────────────────────────
function InfoRow({ icon, label, value, color }) {
    if (!value && value !== 0) return null;
    return (
        <View style={S.editRow}>
            <View style={S.infoIcon}><Ionicons name={icon} size={14} color="#64748B" /></View>
            <View style={{ flex: 1 }}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={[S.infoValue, color && { color }]}>{value}</Text>
            </View>
        </View>
    );
}

// ── User Detail Panel ─────────────────────────────────────────
function UserDetailPanel({ user, onClose, onApprove, onReject, loading, onEdit }) {
    const roleCfg = getRoleCfg(user.role || user.member);
    const isVerified = user.verified === true;
    const isCompany = user.bizModel === 'company';
    const isIndiv = user.bizModel === 'individual';
    const isDaiLy = (user.role || user.member || '').toLowerCase().includes('đại lý');
    const needsBank = ['đối tác', 'cộng tác viên', 'ctv', 'partner'].some(r =>
        (user.role || user.member || '').toLowerCase().includes(r)
    );

    return (
        <View style={[S.detailPanel, isWeb && S.detailPanelWeb]}>
            {/* Header */}
            <View style={S.detailHeader}>
                <Text style={S.detailTitle}>Chi tiết tài khoản</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {/* Nút xem khách hàng — chỉ hiện với CTV */}
                    {['cộng tác viên', 'ctv'].some(r => (user.role || user.member || '').toLowerCase().includes(r)) && (
                        <TouchableOpacity
                            style={[S.editBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                            onPress={() => router.push({
                                pathname: '/ctvCustomers/[email]',
                                params: { email: user.email, name: user.name || user.email },
                            })}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="people-outline" size={14} color="#059669" />
                            <Text style={[S.editBtnText, { color: '#059669' }]}>Khách hàng</Text>
                        </TouchableOpacity>
                    )}
                    {/* Nút sửa — dẫn sang màn editUser */}
                    <TouchableOpacity style={S.editBtn} onPress={onEdit} activeOpacity={0.8}>
                        <Ionicons name="create-outline" size={14} color="#2563EB" />
                        <Text style={S.editBtnText}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} style={S.detailCloseBtn}>
                        <Ionicons name="close" size={18} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

                {/* ── Identity ── */}
                <View style={S.detailIdentity}>
                    <View style={[S.detailAvatar, { backgroundColor: roleCfg.color }]}>
                        <Text style={S.detailAvatarText}>{getInitials(user.name)}</Text>
                    </View>
                    <Text style={S.detailName}>{user.name || '—'}</Text>
                    <Text style={S.detailEmail}>{user.email}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                        <View style={[S.rolePill, { backgroundColor: roleCfg.bg }]}>
                            <Ionicons name={roleCfg.icon} size={12} color={roleCfg.color} />
                            <Text style={[S.rolePillText, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                        </View>
                        {user.bizModel && (
                            <View style={[S.rolePill, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name={isCompany ? 'business-outline' : 'person-outline'} size={12} color="#64748B" />
                                <Text style={[S.rolePillText, { color: '#64748B' }]}>{isCompany ? 'Công ty/HKD' : 'Cá nhân'}</Text>
                            </View>
                        )}
                    </View>
                    {isVerified ? (
                        <View style={S.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={S.verifiedBadgeText}>Đã xác thực · {user.verifiedAt ? new Date(user.verifiedAt).toLocaleDateString('vi-VN') : ''}</Text>
                        </View>
                    ) : (
                        <View style={S.pendingBadge}>
                            <Ionicons name="time-outline" size={14} color="#F59E0B" />
                            <Text style={S.pendingBadgeText}>Chờ xác thực · {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : ''}</Text>
                        </View>
                    )}
                </View>

                {/* ── Liên hệ ── */}
                <View style={S.detailCard}>
                    <Text style={S.detailCardTitle}>Thông tin liên hệ</Text>
                    <InfoRow icon="person-outline" label="Họ và tên" value={user.name} />
                    <InfoRow icon="call-outline" label="Số điện thoại" value={user.phone} color="#2563EB" />
                    <InfoRow icon="location-outline" label="Địa chỉ" value={user.address} />
                    {user.emailContact && <InfoRow icon="mail-outline" label="Email liên hệ" value={user.emailContact} />}
                    <InfoRow icon="calendar-outline" label="Ngày đăng ký"
                        value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'} />
                </View>

                {/* ── Doanh nghiệp ── */}
                {isCompany && (
                    <View style={S.detailCard}>
                        <Text style={S.detailCardTitle}>Thông tin doanh nghiệp</Text>
                        <InfoRow icon="business-outline" label="Tên công ty / HKD" value={user.companyName} />
                        <InfoRow icon="document-text-outline" label="Mã số thuế" value={user.taxCode} />
                        <InfoRow icon="location-outline" label="Địa chỉ đăng ký KD" value={user.bizAddress} />
                    </View>
                )}

                {/* ── Cá nhân ── */}
                {isIndiv && (
                    <View style={S.detailCard}>
                        <Text style={S.detailCardTitle}>Thông tin cá nhân</Text>
                        <InfoRow icon="card-outline" label="Số CCCD / CMND" value={user.cccd} />
                        {user.dob && <InfoRow icon="calendar-outline" label="Ngày sinh" value={user.dob} />}
                    </View>
                )}

                {/* ── Cam kết đại lý ── */}
                {isDaiLy && (user.committedRevenue || user.distributionType) && (
                    <View style={S.detailCard}>
                        <Text style={S.detailCardTitle}>Cam kết đại lý</Text>
                        {user.committedRevenue ? (
                            <InfoRow icon="cash-outline" label="Doanh thu cam kết"
                                value={(user.committedRevenue).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                color="#2563EB" />
                        ) : null}
                        {user.distributionType ? (
                            <InfoRow icon="git-branch-outline" label="Hình thức phân phối"
                                value={user.distributionType === 'exclusive' ? 'Độc quyền' : 'Không độc quyền'} />
                        ) : null}
                        {user.regionName ? (
                            <InfoRow icon="map-outline" label="Khu vực"
                                value={`${user.regionName}${user.province ? ` · ${user.province}` : ''}`} />
                        ) : null}
                    </View>
                )}

                {/* ── Ngân hàng ── */}
                {needsBank && user.bank && (
                    <View style={S.detailCard}>
                        <Text style={S.detailCardTitle}>Thông tin ngân hàng</Text>
                        <View style={S.bankCard}>
                            <View style={S.bankBadge}><Text style={S.bankBadgeText}>{user.bank.id}</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.bankName}>{user.bank.name}</Text>
                                <Text style={S.bankAccount}>{user.bank.accountNo}</Text>
                                <Text style={S.bankHolder}>{user.bank.accountName}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ── Admin note ── */}
                {user.adminNote ? (
                    <View style={S.detailCard}>
                        <Text style={S.detailCardTitle}>Ghi chú admin</Text>
                        <InfoRow icon="create-outline" label="Ghi chú nội bộ" value={user.adminNote} />
                    </View>
                ) : null}

                {/* ── Actions ── */}
                {!isVerified && (
                    <View style={S.actionRow}>
                        <TouchableOpacity style={[S.rejectBtn, loading && { opacity: 0.6 }]} onPress={onReject} disabled={loading} activeOpacity={0.85}>
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                            <Text style={S.rejectBtnText}>Từ chối</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[S.approveBtn, loading && { opacity: 0.6 }]} onPress={() => onApprove(user)} disabled={loading} activeOpacity={0.85}>
                            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />}
                            <Text style={S.approveBtnText}>{loading ? 'Đang xử lý...' : 'Chấp thuận & Gửi mail'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function UsersAdminScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const router = useRouter();

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
    const handleApprove = (approvedDraft) => {
        const name = approvedDraft?.name || selected?.name;
        showAlert(
            '✅ Chấp thuận tài khoản',
            `Xác thực tài khoản "${name}"?\nEmail thông báo sẽ được gửi tự động.`,
            async () => {
                setActionLoading(true);
                try {
                    await updateDoc(doc(db, 'users', selected.email), {
                        verified: true,
                        verifiedAt: new Date().toISOString(),
                        ...(approvedDraft?.name && { name: approvedDraft.name }),
                        ...(approvedDraft?.phone && { phone: approvedDraft.phone }),
                        ...(approvedDraft?.address && { address: approvedDraft.address }),
                        ...(approvedDraft?.adminNote && { adminNote: approvedDraft.adminNote }),
                        ...(approvedDraft?.companyName && { companyName: approvedDraft.companyName }),
                        ...(approvedDraft?.taxCode && { taxCode: approvedDraft.taxCode }),
                        ...(approvedDraft?.bizAddress && { bizAddress: approvedDraft.bizAddress }),
                        ...(approvedDraft?.cccd && { cccd: approvedDraft.cccd }),
                    });
                    setUsers(prev => prev.map(u =>
                        u.email === selected.email ? { ...u, ...(approvedDraft || {}), verified: true } : u
                    ));
                    setSelected(prev => ({ ...prev, ...(approvedDraft || {}), verified: true }));

                    // ✅ Gửi email qua Firebase Extension
                    await sendApprovalEmailViaFirebase({ ...selected, ...(approvedDraft || {}) });

                    showAlert('✅ Thành công', `Đã xác thực "${name}". Email thông báo đã được gửi.`);
                } catch (e) {
                    showAlert('Lỗi', e.message);
                } finally {
                    setActionLoading(false);
                }
            }
        );
    };

    const handleEdit = () => {
        if (!selected) return;
        router.push({
            pathname: '/editUser/[userEmail]',
            params: { userEmail: selected.email, userParam: JSON.stringify(selected) },
        });
    };

    // ── Reject ────────────────────────────────────────────────
    const handleReject = () => {
        showAlert(
            '❌ Từ chối tài khoản',
            `Từ chối tài khoản "${selected?.name}"?`,
            async () => {
                setActionLoading(true);
                try {
                    await updateDoc(doc(db, 'users', selected.email), {
                        verified: false,
                        rejected: true,
                        rejectedAt: new Date().toISOString(),
                    });
                    setUsers(prev => prev.filter(u => u.email !== selected.email));
                    setSelected(null);
                    showAlert('Đã từ chối', `Tài khoản "${selected.name}" đã bị từ chối.`);
                } catch (e) {
                    showAlert('Lỗi', e.message);
                } finally {
                    setActionLoading(false);
                }
            }
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
        <View style={S.root}>
            <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />
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
                    <UserDetailPanel
                        user={selected}
                        onClose={() => setSelected(null)}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onEdit={handleEdit}
                        loading={actionLoading}
                    />
                )}
            </View>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.05 },
    container: { flex: 1, backgroundColor: 'transparent', flexDirection: isWeb ? 'row' : 'column' },

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
    detailCardTitle: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.8, marginBottom: 10 },

    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#fff' },
    infoIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    infoLabel: { fontSize: 10, color: '#fff', marginBottom: 2 },
    infoValue: { fontSize: 13, color: '#E2E8F0', fontWeight: '600' },           // ← text sáng trên nền tối

    // Action buttons — reject giữ đỏ, approve dùng blue accent
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#7F1D1D', backgroundColor: '#1C0A0A' },
    rejectBtnText: { color: '#F87171', fontWeight: '700', fontSize: 13 },
    approveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563EB', shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 10, elevation: 4 },
    approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    // Edit button
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#334155' },
    editBtnText: { fontSize: 12, color: '#60A5FA', fontWeight: '600' },
    // Info rows
    editRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    // Bank
    bankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155' },
    bankBadge: { backgroundColor: '#2563EB22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    bankBadgeText: { fontSize: 12, fontWeight: '800', color: '#60A5FA' },
    bankName: { fontSize: 13, fontWeight: '700', color: '#F8FAFC' },
    bankAccount: { fontSize: 13, color: '#94A3B8', marginTop: 2, letterSpacing: 1 },
    bankHolder: { fontSize: 11, color: '#64748B', marginTop: 2 },
});