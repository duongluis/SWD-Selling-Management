import { useSearch } from '@/components/Hooks/useSearch';
import EmptyState from '@/components/Main/EmptyState';
import ScreenHeader from '@/components/Main/ScreenHeader';
import TabScreenLayout from '@/components/Main/TabScreenLayout';
import { timeAgo } from '@/components/Utils/formatters';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { query as _query, collection, onSnapshot, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
    FlatList, Platform, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const ORDER_TYPE_CFG = {
    buon: { label: 'Đơn buôn', color: '#2563EB', bg: '#EFF6FF' },
    le: { label: 'Đơn lẻ', color: '#8B5CF6', bg: '#F5F3FF' },
};

function RoomCard({ item, myEmail, onPress }) {
    const unread = item.unreadCount?.[myEmail] || 0;
    const typeCfg = ORDER_TYPE_CFG[item.orderType] || ORDER_TYPE_CFG.le;
    return (
        <TouchableOpacity style={[S.card, unread > 0 && S.cardUnread]}
            onPress={() => onPress(item)} activeOpacity={0.75}>
            <View style={S.avatar}>
                <Ionicons name="receipt-outline" size={20} color="#2563EB" />
                {unread > 0 && (
                    <View style={S.badge}><Text style={S.badgeText}>{unread}</Text></View>
                )}
            </View>
            <View style={S.info}>
                <View style={S.topRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Text style={[S.title, unread > 0 && S.titleBold]}>Đơn #{item.orderId}</Text>
                        <View style={[S.typePill, { backgroundColor: typeCfg.bg }]}>
                            <Text style={[S.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                        </View>
                    </View>
                    <Text style={S.time}>{timeAgo(item.lastAt)}</Text>
                </View>
                <Text style={[S.lastMsg, unread > 0 && S.lastMsgBold]} numberOfLines={1}>
                    {item.lastMessage || 'Chưa có tin nhắn'}
                </Text>
                <Text style={S.creator}>{item.createdByName || item.createdBy}</Text>
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
    const isAdmin = role === 'admin';

    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { query, setQuery, result } = useSearch(rooms, ['orderId', 'createdByName', 'createdBy']);

    // ✅ useEffect trực tiếp — không qua useCallback, tránh nhầm tên biến
    useEffect(() => {
        if (!myEmail) return;
        setLoading(true);

        // ✅ dùng _query (alias của Firestore query), không phải query string từ useSearch
        const q = isAdmin
            ? _query(collection(db, 'chatRooms'))
            : _query(collection(db, 'chatRooms'), where('members', 'array-contains', myEmail));

        const unsub = onSnapshot(
            q,
            (snap) => {
                setRooms(
                    snap.docs
                        .map(d => ({ ...d.data(), roomId: d.id }))
                        .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
                );
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
        unsubRef.current?.();
        subscribe();
        // onSnapshot tự realtime, chỉ cần trigger re-render
        setRooms(prev => [...prev]);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

                        {' '}{item.createdByName || item.createdBy}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
        );
    };

    const totalUnread = rooms.reduce((sum, r) => sum + getUnread(r), 0);

    return (
        <TabScreenLayout>
            <ScreenHeader
                title="Phòng chat"
                subtitle={totalUnread > 0 ? `${totalUnread} tin nhắn chưa đọc` : `${rooms.length} phòng`}
                searchValue={query}
                onSearchChange={setQuery}
                searchPlaceholder="Tìm đơn hàng, người tạo..."
                leftSlot={
                    <TouchableOpacity style={BK.btn} onPress={() => router.replace('/(tabs)/home')}>
                        <Ionicons name="arrow-back" size={20} color="#0F172A" />
                    </TouchableOpacity>
                }
            />

            {loading ? <EmptyState loading /> :
                result.length === 0 ? (
                    <EmptyState empty icon="chatbubbles-outline"
                        title="Chưa có phòng chat"
                        subtitle="Phòng chat tự tạo khi có đơn hàng mới"
                    />
                ) : (
                    <FlatList
                        data={result}
                        keyExtractor={item => item.roomId}
                        renderItem={({ item }) => (
                            <RoomCard
                                item={item}
                                myEmail={myEmail}
                                onPress={(room) => {
                                    console.log('Navigate to room:', room.roomId, 'orderId:', room.orderId); // ← debug
                                    router.push({
                                        pathname: '/chat/[roomID]',
                                        params: {
                                            roomID: room.roomId,   // ← ID của document Firestore (vd: "order_xxx")
                                            orderId: room.orderId,
                                        },
                                    });
                                }}
                            />
                        )}
                        contentContainerStyle={{ paddingHorizontal: isWeb ? 32 : 16, paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                        showsVerticalScrollIndicator={false}
                    />
                )}
        </TabScreenLayout>
    );
}

const BK = StyleSheet.create({
    btn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
});

const S = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    cardUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
    avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff' },
    badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    info: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    title: { fontSize: 14, fontWeight: '500', color: '#374151' },
    titleBold: { fontWeight: '800', color: '#0F172A' },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    typePillText: { fontSize: 10, fontWeight: '700' },
    time: { fontSize: 11, color: '#94A3B8' },
    lastMsg: { fontSize: 13, color: '#64748B', marginBottom: 3 },
    lastMsgBold: { color: '#374151', fontWeight: '600' },
    creator: { fontSize: 11, color: '#94A3B8' },
});