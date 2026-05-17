import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    FlatList, Modal, Platform, Pressable,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
    markAllNotificationsRead,
    markNotificationRead,
    subscribeNotifications,
} from '../Utils/chatService';

const PANEL_WIDTH = 340;

// ── Helpers ───────────────────────────────────────────────────
const NOTIF_CONFIG = {
    new_order: { icon: 'receipt-outline', color: '#2563EB', bg: '#EFF6FF' },
    order_update: { icon: 'refresh-circle-outline', color: '#F59E0B', bg: '#FFFBEB' },
    new_message: { icon: 'chatbubble-outline', color: '#8B5CF6', bg: '#F5F3FF' },
    added_to_room: { icon: 'people-circle-outline', color: '#059669', bg: '#ECFDF5' },
};
const getCfg = (type) =>
    NOTIF_CONFIG[type] || { icon: 'notifications-outline', color: '#64748B', bg: '#F1F5F9' };

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ── Tab content ───────────────────────────────────────────────
function NotifTabs({ notifs, onPress, unread }) {
    const [tab, setTab] = useState('all');
    const displayed = tab === 'unread' ? notifs.filter(n => !n.read) : notifs;

    const renderItem = ({ item }) => {
        const cfg = getCfg(item.type);
        return (
            <TouchableOpacity
                style={[P.item, !item.read && P.itemUnread]}
                onPress={() => onPress(item)}
                activeOpacity={0.75}
            >
                <View style={[P.icon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                </View>
                <View style={P.content}>
                    <Text style={[P.title, !item.read && P.titleBold]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={P.body} numberOfLines={2}>{item.body}</Text>
                    <Text style={P.time}>{timeAgo(item.createdAt)}</Text>
                </View>
                {!item.read && <View style={P.dot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View>
            <View style={P.tabRow}>
                {[
                    { key: 'all', label: 'Tất cả', count: notifs.length },
                    { key: 'unread', label: 'Chưa đọc', count: unread },
                ].map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[P.tab, tab === t.key && P.tabActive]}
                        onPress={() => setTab(t.key)}
                        activeOpacity={0.8}
                    >
                        <Text style={[P.tabText, tab === t.key && P.tabTextActive]}>{t.label}</Text>
                        {t.count > 0 && (
                            <View style={[P.tabBadge, tab === t.key && P.tabBadgeActive]}>
                                <Text style={[P.tabBadgeText, tab === t.key && P.tabBadgeTextActive]}>
                                    {t.count}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {displayed.length === 0 ? (
                <View style={P.empty}>
                    <Ionicons name="notifications-off-outline" size={30} color="#CBD5E1" />
                    <Text style={P.emptyText}>
                        {tab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={displayed}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 380 }}
                />
            )}
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function NotificationPanel({ bellColor = '#0F172A', bellSize = 22 }) {
    const { userDetail } = useContext(UserDetailContext);
    const router = useRouter();
    const bellRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState([]);
    const [panelPos, setPanelPos] = useState({ top: 60, right: 16 });

    const email = userDetail?.email || null;

    // ✅ Subscribe — tự cleanup khi email thành null (đăng xuất)
    useEffect(() => {
        if (!email) {
            // Đăng xuất → reset state + đóng panel
            setNotifs([]);
            setOpen(false);
            return;
        }
        const unsub = subscribeNotifications(email, (items) => {
            // Guard thêm: chỉ set nếu email vẫn còn hợp lệ
            setNotifs(items);
        });
        return () => unsub();
    }, [email]);

    const unread = notifs.filter(n => !n.read).length;

    const handleBellPress = () => {
        if (!email) return; // Không mở nếu đã đăng xuất
        bellRef.current?.measure((x, y, w, h, pageX, pageY) => {
            const right = Platform.OS === 'web'
                ? window.innerWidth - pageX - w
                : 16;
            setPanelPos({ top: pageY + h + 8, right });
        });
        setOpen(p => !p);
    };

    const handleNotifPress = async (notif) => {
        setOpen(false);
        if (!email) return;                 // ✅ Guard
        if (!notif.read) {
            markNotificationRead(email, notif.id).catch(() => { });
        }

        // 🆕 Sử dụng path nếu có
        if (notif.path) {
            router.push(notif.path);
            return;
        }

        // ⏺ Giữ lại logic cũ để tương thích ngược
        if (notif.roomId && notif.orderId) {
            router.push({
                pathname: '/chat/[roomID]',
                params: { roomId: notif.roomId, orderId: notif.orderId },
            });
        } else if (notif.orderId) {
            router.push('/(tabs)/order');
        }
    };

    const handleMarkAll = () => {
        if (!email) return; // ✅ Guard
        markAllNotificationsRead(email);
    };

    // Không render gì nếu chưa đăng nhập
    if (!email) return null;

    return (
        <>
            {/* Bell */}
            <TouchableOpacity
                ref={bellRef}
                style={P.bellWrap}
                onPress={handleBellPress}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={open ? 'notifications' : 'notifications-outline'}
                    size={bellSize}
                    color={bellColor}
                />
                {unread > 0 && (
                    <View style={P.badge}>
                        <Text style={P.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Modal panel */}
            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
                statusBarTranslucent
            >
                <Pressable style={P.backdrop} onPress={() => setOpen(false)}>
                    <Pressable
                        style={[P.panel, { top: panelPos.top, right: panelPos.right }]}
                        onPress={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <View style={P.panelHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                <Ionicons name="notifications" size={16} color="#0F172A" />
                                <Text style={P.panelTitle}>Thông báo</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {unread > 0 && (
                                    <TouchableOpacity onPress={handleMarkAll} style={P.markAllBtn}>
                                        <Text style={P.markAllText}>Đọc tất cả</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setOpen(false)} style={P.closeBtn}>
                                    <Ionicons name="close" size={16} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <NotifTabs notifs={notifs} onPress={handleNotifPress} unread={unread} />
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

// ── Styles ────────────────────────────────────────────────────
const P = StyleSheet.create({
    bellWrap: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    badge: { position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#FFFFFF' },
    badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    backdrop: { flex: 1, backgroundColor: 'transparent' },
    panel: { position: 'absolute', width: PANEL_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
    panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    panelTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    markAllBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EFF6FF' },
    markAllText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
    closeBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    tabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#FFFFFF' },
    tabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 10, backgroundColor: '#E2E8F0' },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
    tabBadgeTextActive: { color: '#FFFFFF' },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    itemUnread: { backgroundColor: '#FAFBFF' },
    icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    content: { flex: 1 },
    title: { fontSize: 13, color: '#374151', marginBottom: 2 },
    titleBold: { fontWeight: '700', color: '#0F172A' },
    body: { fontSize: 12, color: '#64748B', lineHeight: 17 },
    time: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563EB', marginTop: 6, flexShrink: 0 },
    empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});