// app/chatList/index.jsx
// Danh sách phòng chat — có thể đặt ở tab hoặc mở từ màn order/home

import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    collection,
    onSnapshot, query, where
} from 'firebase/firestore';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, Image, Platform,
    RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png');

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min}p trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

const ORDER_TYPE_CFG = {
    buon: { label: 'Đơn buôn', color: '#2563EB', bg: '#EFF6FF' },
    le: { label: 'Đơn lẻ', color: '#8B5CF6', bg: '#F5F3FF' },
};

export default function ChatListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);

    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const unsubRef = useRef(null);

    const myEmail = userDetail?.email || '';
    const isAdmin = (userDetail?.role || userDetail?.member || '').toLowerCase() === 'admin';

    const subscribe = useCallback(() => {
        if (!myEmail) return;

        // Admin xem tất cả rooms, user chỉ xem rooms có mình
        const q = isAdmin
            ? query(collection(db, 'chatRooms'))
            : query(collection(db, 'chatRooms'), where('members', 'array-contains', myEmail));

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map(d => ({ ...d.data(), roomId: d.id }))
                .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
            setRooms(data);
            setLoading(false);
            setRefreshing(false);
        }, (err) => {
            console.error('chatRooms snapshot error:', err);
            setLoading(false);
            setRefreshing(false);
        });

        unsubRef.current = unsub;
        return unsub;
    }, [myEmail, isAdmin]);

    useEffect(() => {
        const unsub = subscribe();
        return () => unsub?.();
    }, [subscribe]);

    useFocusEffect(useCallback(() => {
        // Re-subscribe khi focus lại màn hình
        unsubRef.current?.();
        subscribe();
    }, [subscribe]));

    const handleRefresh = () => {
        setRefreshing(true);
        unsubRef.current?.();
        subscribe();
    };

    const getUnread = (room) =>
        (room.unreadCount?.[myEmail] || 0);

    const renderRoom = ({ item }) => {
        const typeCfg = ORDER_TYPE_CFG[item.orderType] || ORDER_TYPE_CFG.le;
        const unread = getUnread(item);
        const isUnread = unread > 0;

        return (
            <TouchableOpacity
                style={[S.roomCard, isUnread && S.roomCardUnread]}
                onPress={() => router.push({
                    pathname: '/chat/[roomID]',
                    params: { roomId: item.roomId, orderId: item.orderId },
                })}
                activeOpacity={0.75}
            >
                {/* Avatar icon */}
                <View style={S.roomAvatar}>
                    <Ionicons name="receipt-outline" size={20} color="#2563EB" />
                    {isUnread && <View style={S.unreadBadge}><Text style={S.unreadBadgeText}>{unread}</Text></View>}
                </View>

                {/* Info */}
                <View style={S.roomInfo}>
                    <View style={S.roomTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Text style={[S.roomTitle, isUnread && S.roomTitleBold]} numberOfLines={1}>
                                Đơn #{item.orderId}
                            </Text>
                            <View style={[S.typePill, { backgroundColor: typeCfg.bg }]}>
                                <Text style={[S.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                            </View>
                        </View>
                        <Text style={S.roomTime}>{timeAgo(item.lastAt)}</Text>
                    </View>

                    <Text style={[S.lastMsg, isUnread && S.lastMsgBold]} numberOfLines={1}>
                        {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>

                    {/* Creator info */}
                    <Text style={S.roomCreator}>
                        <Ionicons name="person-outline" size={10} color="#94A3B8" />
                        {' '}{item.createdByName || item.createdBy}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
        );
    };

    const totalUnread = rooms.reduce((sum, r) => sum + getUnread(r), 0);

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }]}>
            <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />

            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.headerTitle}>Phòng chat đơn hàng</Text>
                    {totalUnread > 0 && (
                        <Text style={S.headerSub}>{totalUnread} tin nhắn chưa đọc</Text>
                    )}
                </View>
                <TouchableOpacity
                    style={S.refreshBtn}
                    onPress={handleRefresh}
                    disabled={refreshing}
                >
                    <Ionicons name="refresh-outline" size={17} color="#64748B" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={S.loadWrap}>
                    <ActivityIndicator color="#2563EB" size="large" />
                    <Text style={S.loadText}>Đang tải...</Text>
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={item => item.roomId}
                    renderItem={renderRoom}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: isWeb ? 32 : 16, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListEmptyComponent={
                        <View style={S.empty}>
                            <View style={S.emptyIcon}>
                                <Ionicons name="chatbubbles-outline" size={36} color="#CBD5E1" />
                            </View>
                            <Text style={S.emptyTitle}>Chưa có phòng chat nào</Text>
                            <Text style={S.emptySub}>Phòng chat tự tạo khi có đơn hàng mới</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: { position: 'absolute', width: '80%', height: '60%', top: '20%', left: '10%', opacity: 0.04 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: isWeb ? 32 : 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 12, color: '#EF4444', marginTop: 1, fontWeight: '600' },
    refreshBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    loadText: { fontSize: 13, color: '#94A3B8' },
    // Room card
    roomCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    roomCardUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
    roomAvatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 },
    unreadBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff' },
    unreadBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    roomInfo: { flex: 1 },
    roomTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    roomTitle: { fontSize: 14, fontWeight: '500', color: '#374151' },
    roomTitleBold: { fontWeight: '800', color: '#0F172A' },
    typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    typePillText: { fontSize: 10, fontWeight: '700' },
    roomTime: { fontSize: 11, color: '#94A3B8' },
    lastMsg: { fontSize: 13, color: '#64748B', marginBottom: 3 },
    lastMsgBold: { color: '#374151', fontWeight: '600' },
    roomCreator: { fontSize: 11, color: '#94A3B8' },
    // Empty
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
    emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});