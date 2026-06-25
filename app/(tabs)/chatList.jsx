// app/chatList/index.jsx

import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import { timeAgo } from '@/components/Utils/formatters';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { query as _query, collection, getDocs, onSnapshot, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';

const ORDER_TYPE_CFG = {
    buon: { label: 'Đơn buôn', color: '#2563EB', bg: '#EFF6FF' },
    le: { label: 'Đơn lẻ', color: '#8B5CF6', bg: '#F5F3FF' },
};

// Hàm lấy thông tin khách hàng từ members (loại bỏ admin)
// Trả về { email, displayName }
// Ưu tiên: contactName (nếu là company), fallback name/companyName, cuối cùng là email
const getCustomerFromMembers = async (members, myEmail) => {
    const candidateEmails = members.filter(m => m !== myEmail);
    if (candidateEmails.length === 0) return { email: null, displayName: null };

    // Lấy thông tin user từ Firestore
    const usersSnap = await getDocs(_query(collection(db, 'users'), where('email', 'in', candidateEmails)));
    const users = usersSnap.docs.map(d => d.data());

    // Tìm user không phải admin
    const nonAdmin = users.find(u => (u.role || '').toLowerCase() !== 'admin');
    if (nonAdmin) {
        let displayName = '';
        // Nếu là công ty / hộ kinh doanh, ưu tiên contactName
        if (nonAdmin.bizModel === 'company' && nonAdmin.contactName) {
            displayName = nonAdmin.contactName + " - " + nonAdmin.companyName;
        } else {
            displayName = nonAdmin.name || nonAdmin.companyName || '';
        }
        if (!displayName) displayName = nonAdmin.email;
        return { email: nonAdmin.email, displayName };
    }
    // Fallback: lấy email đầu tiên
    return { email: candidateEmails[0], displayName: candidateEmails[0] };
};

function RoomCard({ item, myEmail, onPress, isAdmin, customerInfo }) {
    const unread = item.unreadCount?.[myEmail] || 0;
    const isSupportRoom = item.type === 'support' || item.roomId?.startsWith('support_');

    let title = '';
    let subtitle = '';
    let leftIcon = 'chatbubbles-outline';
    let leftIconColor = '#2563EB';

    if (isSupportRoom) {
        if (isAdmin && customerInfo?.displayName) {
            title = customerInfo.displayName;
            subtitle = 'Phòng hỗ trợ chung';
        } else {
            title = 'Chăm sóc khách hàng';
            subtitle = 'Hỗ trợ 24/7';
        }
        leftIcon = 'headset-outline';
        leftIconColor = '#10B981';
    } else {
        const typeCfg = ORDER_TYPE_CFG[item.orderType] || ORDER_TYPE_CFG.le;
        title = `Đơn hàng #${item.orderId}`;
        subtitle = item.createdByName || item.createdBy || '';
        leftIcon = 'receipt-outline';
        leftIconColor = '#2563EB';
        if (item.orderType) {
            subtitle = (
                <View style={[S.typePill, { backgroundColor: typeCfg.bg, marginTop: 2 }]}>
                    <Text style={[S.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                </View>
            );
        }
    }

    return (
        <TouchableOpacity
            style={[S.card, unread > 0 && S.cardUnread]}
            onPress={() => onPress(item)}
            activeOpacity={0.75}
        >
            <View style={S.avatar}>
                <Ionicons name={leftIcon} size={20} color={leftIconColor} />
                {unread > 0 && (
                    <View style={S.badge}>
                        <Text style={S.badgeText}>{unread}</Text>
                    </View>
                )}
            </View>
            <View style={S.info}>
                <View style={S.topRow}>
                    <Text style={[S.title, unread > 0 && S.titleBold]} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={S.time}>{timeAgo(item.lastAt)}</Text>
                </View>
                <Text style={[S.lastMsg, unread > 0 && S.lastMsgBold]} numberOfLines={1}>
                    {item.lastMessage || 'Chưa có tin nhắn'}
                </Text>
                {typeof subtitle === 'string' ? (
                    <Text style={S.creator} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : (
                    subtitle
                )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
        </TouchableOpacity>
    );
}

export default function ChatListScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const myEmail = userDetail?.email || '';
    const isAdmin = role === 'admin' || role === 'giamdoc';
    const { isDesktop } = useLayout();
    const [rooms, setRooms] = useState([]);
    const [customerMap, setCustomerMap] = useState({}); // roomId -> { email, displayName }
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const searchKeys = ['orderId', 'createdByName', 'createdBy', 'userEmail', 'userName'];
    const { query, setQuery, result } = useSearch(rooms, searchKeys);

    useEffect(() => {
        if (!myEmail) return;
        setLoading(true);

        const q = isAdmin
            ? _query(collection(db, 'chatRooms'))
            : _query(collection(db, 'chatRooms'), where('members', 'array-contains', myEmail));

        const unsub = onSnapshot(
            q,
            async (snap) => {
                const roomList = snap.docs
                    .map(d => ({ ...d.data(), roomId: d.id }))
                    .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
                setRooms(roomList);

                if (isAdmin) {
                    const newMap = {};
                    for (const room of roomList) {
                        const isSupport = room.type === 'support' || room.roomId?.startsWith('support_');
                        if (isSupport && room.members && room.members.length) {
                            const { email, displayName } = await getCustomerFromMembers(room.members, myEmail);
                            newMap[room.roomId] = { email, displayName };
                        }
                    }
                    setCustomerMap(newMap);
                }
                setLoading(false);
                setRefreshing(false);
            },
            (err) => {
                console.error('ChatList onSnapshot error:', err.code, err.message);
                setLoading(false);
                setRefreshing(false);
            }
        );

        return () => unsub();
    }, [myEmail, isAdmin]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        setRooms(prev => [...prev]);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount?.[myEmail] || 0), 0);
    const searchPlaceholder = isAdmin
        ? 'Tìm theo tên, email, mã đơn...'
        : 'Tìm đơn hàng, mã đơn...';

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Phòng chat"
                subtitle={totalUnread > 0 ? `${totalUnread} tin nhắn chưa đọc` : `${rooms.length} phòng`}
                searchValue={query}
                onSearchChange={setQuery}
                searchPlaceholder={searchPlaceholder}
            />

            {loading ? (
                <EmptyState loading />
            ) : result.length === 0 ? (
                <EmptyState
                    empty
                    icon="chatbubbles-outline"
                    title="Chưa có phòng chat"
                    subtitle="Phòng chat tự động tạo khi có đơn hàng hoặc liên hệ hỗ trợ"
                />
            ) : (
                <FlatList
                    data={result}
                    keyExtractor={item => item.roomId}
                    renderItem={({ item }) => (
                        <RoomCard
                            item={item}
                            myEmail={myEmail}
                            isAdmin={isAdmin}
                            customerInfo={customerMap[item.roomId]}
                            onPress={(room) => {
                                router.push({
                                    pathname: '/chat/[roomID]',
                                    params: {
                                        roomID: room.roomId,
                                        orderId: room.orderId || '',
                                    },
                                });
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: isDesktop ? 32 : 16, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    showsVerticalScrollIndicator={true}
                />
            )}
        </TabScreenLayout>
    );
}

const S = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    cardUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
    avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff' },
    badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    info: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    title: { fontSize: 14, fontWeight: '500', color: '#374151', flex: 1, marginRight: 8 },
    titleBold: { fontWeight: '800', color: '#0F172A' },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, alignSelf: 'flex-start' },
    typePillText: { fontSize: 10, fontWeight: '700' },
    time: { fontSize: 11, color: '#94A3B8' },
    lastMsg: { fontSize: 13, color: '#64748B', marginBottom: 3 },
    lastMsgBold: { color: '#374151', fontWeight: '600' },
    creator: { fontSize: 11, color: '#94A3B8' },
});