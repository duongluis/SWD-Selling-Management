// app/(tabs)/team.jsx
import BgWatermark from '@/components/Main/BgWatermark';
import UserDetail from '@/components/UI/UserDetail';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator,
    Platform, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtPhone } from '../../components/Utils/formatters';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

// Map role hiển thị
const ROLE_DISPLAY = {
    'đại lý': 'Đại lý',
    'Đối tác': 'Đối tác',
    'cộng tác viên': 'CTV',
    'admin': 'Admin',
};

// Sắp xếp thứ tự role: Đại lý > Đối tác > CTV
const ROLE_ORDER = { 'đại lý': 1, 'Đối tác': 2, 'cộng tác viên': 3 };

function MemberCard({ member, onPress }) {
    const roleLabel = ROLE_DISPLAY[member.role] || member.role || '—';
    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(member)} activeOpacity={0.7}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {(member.name || member.email || '?')[0].toUpperCase()}
                </Text>
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.name} numberOfLines={1}>{member.name || member.companyName || '—'}</Text>
                <Text style={styles.email} numberOfLines={1}>{member.email}</Text>
                <View style={styles.metaRow}>
                    <Ionicons name="call-outline" size={12} color="#94A3B8" />
                    <Text style={styles.metaText}>{fmtPhone(member.phone)}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                    </View>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
        </TouchableOpacity>
    );
}

export default function TeamView() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null); // state cho panel chi tiết

    const fetchTeam = useCallback(async () => {
        if (!userDetail?.email) return;
        setError(null);
        try {
            const q = query(collection(db, 'users'), where('advisor', '==', userDetail.email));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            // Sắp xếp theo role
            data.sort((a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99));
            setMembers(data);
        } catch (err) {
            console.error(err);
            setError('Không thể tải danh sách');
        } finally {
            setLoading(false);
        }
    }, [userDetail?.email]);

    useFocusEffect(
        useCallback(() => {
            fetchTeam();
        }, [fetchTeam])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTeam();
        setRefreshing(false);
    };

    // Nhóm theo role
    const grouped = members.reduce((acc, m) => {
        const role = m.role || 'other';
        if (!acc[role]) acc[role] = [];
        acc[role].push(m);
        return acc;
    }, {});

    const roleSections = Object.entries(grouped).map(([role, items]) => ({
        title: ROLE_DISPLAY[role] || role,
        data: items,
    }));

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchTeam}>
                    <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Render nội dung danh sách và panel chi tiết (giống users.jsx)
    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <BgWatermark />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Đội ngũ của tôi</Text>
                <Text style={styles.headerSub}>
                    {members.length} thành viên trực thuộc
                </Text>
            </View>

            <View style={styles.contentRow}>
                {/* Danh sách thành viên */}
                <View style={styles.listContainer}>
                    <ScrollView
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {members.length === 0 ? (
                            <View style={styles.empty}>
                                <Ionicons name="people-outline" size={64} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>Chưa có thành viên</Text>
                                <Text style={styles.emptyDesc}>
                                    Khi bạn giới thiệu người khác, họ sẽ xuất hiện tại đây.
                                </Text>
                            </View>
                        ) : (
                            roleSections.map(section => (
                                <View key={section.title} style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>{section.title}</Text>
                                        <Text style={styles.sectionCount}>{section.data.length}</Text>
                                    </View>
                                    {section.data.map(member => (
                                        <MemberCard key={member.id} member={member} onPress={setSelectedMember} />
                                    ))}
                                </View>
                            ))
                        )}
                        <View style={{ height: insets.bottom + 20 }} />
                    </ScrollView>
                </View>

                {/* Panel chi tiết (chỉ hiển thị trên web, mobile thì có thể dùng modal nhưng giữ đơn giản) */}
                {isWeb && selectedMember && (
                    <UserDetail
                        user={selectedMember}
                        onClose={() => setSelectedMember(null)}
                        onUpdated={(updated) => {
                            // Cập nhật lại danh sách nếu cần
                            setMembers(prev => prev.map(m => m.email === updated.email ? updated : m));
                            setSelectedMember(updated);
                        }}
                    />
                )}
            </View>

            {/* Trên mobile: khi chọn member, điều hướng sang màn chi tiết (có thể dùng modal nếu muốn) */}
            {!isWeb && selectedMember && (
                <UserDetail
                    user={selectedMember}
                    onClose={() => setSelectedMember(null)}
                    onUpdated={(updated) => {
                        setMembers(prev => prev.map(m => m.email === updated.email ? updated : m));
                        setSelectedMember(updated);
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    headerSub: { fontSize: 14, color: '#64748B', marginTop: 4 },
    contentRow: { flex: 1, flexDirection: isWeb ? 'row' : 'column' },
    listContainer: { flex: 1, minWidth: 0 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    sectionCount: { fontSize: 13, fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#2563EB' },
    cardContent: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    email: { fontSize: 12, color: '#64748B', marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    metaText: { fontSize: 12, color: '#94A3B8' },
    roleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    roleBadgeText: { fontSize: 10, fontWeight: '600', color: '#475569' },
    loadingText: { marginTop: 12, color: '#94A3B8' },
    errorText: { marginTop: 12, color: '#EF4444', textAlign: 'center', marginHorizontal: 24 },
    retryBtn: { marginTop: 16, backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: '#FFF', fontWeight: '600' },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748B' },
    emptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
});