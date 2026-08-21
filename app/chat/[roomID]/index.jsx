// app/chat/[roomId]/index.jsx
import BgWatermark from '@/components/Main/BgWatermark';
import {
    markRoomAsRead, sendMessage, subscribeMessages,
} from '@/components/Utils/chatService';
import { productItems } from '@/components/Utils/orderItems';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/components/Main/TabScreenLayout';


// ── Helpers ───────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const hashColor = (str) => AVATAR_COLORS[
    (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
];

function formatVND(amount) {
    if (!amount && amount !== 0) return '—';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
}

function formatDate(val) {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ order }) {
    const items = productItems(order);
    const total = items.reduce((sum, it) => sum + (it.price || it.basePrice || 0) * (it.qty || 1), 0);

    return (
        <View style={OC.card}>
            <View style={OC.header}>
                <View style={OC.headerLeft}>
                    <Ionicons name="receipt-outline" size={14} color="#2563EB" />
                    <Text style={OC.orderId}>ORDER#{order.id}</Text>
                </View>
                <View style={[OC.statusBadge, { backgroundColor: order.status === 'Đã thanh toán' ? '#D1FAE5' : '#FEF3C7' }]}>
                    <Text style={[OC.statusText, { color: order.status === 'Đã thanh toán' ? '#065F46' : '#92400E' }]}>
                        {order.status || 'Chờ xử lý'}
                    </Text>
                </View>
            </View>

            <View style={OC.divider} />

            <View style={OC.infoRow}>
                <View style={OC.infoCol}>
                    <Text style={OC.infoLabel}>KHÁCH HÀNG</Text>
                    <View style={OC.infoLine}>
                        <Ionicons name="person-outline" size={12} color="#64748B" />
                        <Text style={OC.infoVal}>{order.customer || '—'}</Text>
                    </View>
                    {!!order.address && (
                        <View style={OC.infoLine}>
                            <Ionicons name="location-outline" size={12} color="#64748B" />
                            <Text style={OC.infoAddr} numberOfLines={2}>{order.address}</Text>
                        </View>
                    )}
                </View>
                <View style={OC.infoCol}>
                    <Text style={OC.infoLabel}>NGÀY TẠO</Text>
                    <Text style={OC.infoVal}>{formatDate(order.createdAt)}</Text>
                </View>
            </View>

            <View style={OC.divider} />

            <View style={OC.sectionHeader}>
                <Ionicons name="water-outline" size={13} color="#2563EB" />
                <Text style={OC.sectionTitle}>Sản phẩm</Text>
                <View style={OC.badge}><Text style={OC.badgeText}>{items.length}</Text></View>
            </View>

            {items.map((item, idx) => (
                <View key={idx} style={OC.itemRow}>
                    <View style={OC.itemLeft}>
                        <View style={OC.itemIcon}>
                            <Ionicons name="water-outline" size={12} color="#2563EB" />
                        </View>
                        <View>
                            <Text style={OC.itemName}>{item.name}</Text>
                            <Text style={OC.itemSub}>x{item.qty || 1} · {formatVND(item.price || item.basePrice)}</Text>
                        </View>
                    </View>
                    <Text style={OC.itemTotal}>{formatVND((item.price || item.basePrice || 0) * (item.qty || 1))}</Text>
                </View>
            ))}

            <View style={OC.totalRow}>
                <Text style={OC.totalLabel}>Tổng cộng</Text>
                <Text style={OC.totalVal}>{formatVND(total)}</Text>
            </View>
        </View>
    );
}

// ── Bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isMe, prevSender }) {
    const isSystem = msg.type === 'system' || msg.type === 'status_update';
    const isOrder = msg.type === 'order_ref';
    const showAvatar = !isMe && !isSystem && prevSender !== msg.sender;
    const showSenderName = !isMe && !isSystem && prevSender !== msg.sender;

    const _dt = msg.createdAt?.toDate
        ? msg.createdAt.toDate()
        : msg.createdAt ? new Date(msg.createdAt) : null;
    const timeStr = _dt
        ? _dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '';
    const dateStr = _dt
        ? _dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : '';

    if (isSystem) {
        return (
            <View style={B.systemWrap}>
                <View style={[B.systemBubble, msg.type === 'status_update' && B.statusBubble]}>
                    <Text style={[B.systemText, msg.type === 'status_update' && B.statusText]}>
                        {msg.text}
                    </Text>
                    <Text style={B.systemTime}>{dateStr} {timeStr}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[B.row, isMe && B.rowMe]}>
            {!isMe && (
                <View style={B.avatarCol}>
                    {showAvatar ? (
                        <View style={[B.avatar, { backgroundColor: hashColor(msg.sender) }]}>
                            <Text style={B.avatarText}>{getInitials(msg.senderName)}</Text>
                        </View>
                    ) : <View style={B.avatarSpacer} />}
                </View>
            )}

            <View style={[B.bubbleCol, isMe && B.bubbleColMe]}>
                {showSenderName && <Text style={B.senderName}>{msg.senderName}</Text>}

                {isOrder ? (
                    <View style={[B.orderWrap, isMe && B.orderWrapMe]}>
                        <OrderCard order={msg.orderData} />
                        <Text style={[B.time, isMe && B.timeMe]}>{dateStr} {timeStr}</Text>
                    </View>
                ) : (
                    <>
                        <View style={[B.bubble, isMe ? B.bubbleMe : B.bubbleThem]}>
                            <Text style={[B.msgText, isMe && B.msgTextMe]}>{msg.text}</Text>
                        </View>
                        <Text style={[B.time, isMe && B.timeMe]}>{dateStr} {timeStr}</Text>
                    </>
                )}
            </View>
        </View>
    );
}

// ── Order Mention Menu ────────────────────────────────────────
function OrderMentionMenu({ orders, query, onSelect, onDismiss }) {
    const filtered = orders.filter(o => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            o.id?.toLowerCase().includes(q) ||
            o.customer?.toLowerCase().includes(q) ||
            o.address?.toLowerCase().includes(q)
        );
    });

    if (filtered.length === 0) return null;

    return (
        <View style={M.container}>
            <View style={M.header}>
                <Ionicons name="receipt-outline" size={13} color="#2563EB" />
                <Text style={M.headerText}>Chọn đơn hàng</Text>
                <TouchableOpacity onPress={onDismiss} style={M.closeBtn}>
                    <Ionicons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
            </View>
            <ScrollView
                style={M.list}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={true}
            >
                {filtered.map((order) => (
                    <TouchableOpacity
                        key={order.id}
                        style={M.item}
                        onPress={() => onSelect(order)}
                        activeOpacity={0.7}
                    >
                        <View style={M.itemIcon}>
                            <Ionicons name="receipt-outline" size={14} color="#2563EB" />
                        </View>
                        <View style={M.itemInfo}>
                            <Text style={M.itemTitle}>ORDER#{order.id}</Text>
                            <Text style={M.itemSub} numberOfLines={1}>
                                {[order.customer, order.address, formatDate(order.createdAt)]
                                    .filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                        <View style={[M.statusDot, {
                            backgroundColor: order.status === 'Đã thanh toán' ? '#10B981' : '#F59E0B'
                        }]} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function ChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { userDetail } = useContext(UserDetailContext);
    const { isDesktop } = useLayout();

    const isAdmin = userDetail?.role === 'admin';
    const myEmail = userDetail?.email || '';
    const myName = userDetail?.name || myEmail;

    const roomId = params.roomID || params.roomId || '';
    const orderId = params.orderId || '';

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(!!roomId);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatRef = useRef(null);

    // ── # mention state ───────────────────────────────────────
    const [orders, setOrders] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');

    // ── Room user email (admin cần biết đây là phòng của ai) ─
    const [roomUserEmail, setRoomUserEmail] = useState('');



    // ── Fetch room info để lấy userEmail của khách (chỉ admin) ─
    useEffect(() => {
        if (!isAdmin || !roomId) return;

        const fetchRoomUser = async () => {
            try {
                const roomDoc = await getDoc(doc(db, 'chatRooms', roomId));
                if (roomDoc.exists()) {
                    const data = roomDoc.data();
                    // Ưu tiên field userEmail, fallback tìm member không phải admin
                    const targetEmail =
                        data.userEmail ||
                        (data.members || []).find(m => m !== myEmail) ||
                        '';
                    setRoomUserEmail(targetEmail);
                    console.log('[room] userEmail for orders:', targetEmail);
                }
            } catch (e) {
                console.warn('Fetch room user error:', e);
            }
        };
        fetchRoomUser();
    }, [isAdmin, roomId, myEmail]);

    // ── Fetch orders ──────────────────────────────────────────
    // Admin → lấy đơn của khách trong phòng (roomUserEmail)
    // Non-admin → lấy đơn của chính mình (myEmail)
    useEffect(() => {
        const targetEmail = isAdmin ? roomUserEmail : myEmail;
        if (!targetEmail) return;

        const fetchOrders = async () => {
            try {
                const q = query(
                    collection(db, 'orders'),
                    where('createdBy', '==', targetEmail),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log('[orders] targetEmail:', targetEmail, 'fetched:', list.length, list);
                setOrders(list);
            } catch (e) {
                console.warn('Fetch orders error:', e);
            }
        };
        fetchOrders();
    }, [isAdmin, roomUserEmail, myEmail]);

    // ── Subscribe messages ────────────────────────────────────
    useEffect(() => {
        if (!roomId) { setLoading(false); return; }
        setLoading(true);
        const timeout = setTimeout(() => setLoading(false), 5000);
        let unsub;
        try {
            unsub = subscribeMessages(
                roomId,
                (msgs) => {
                    clearTimeout(timeout);
                    setMessages(msgs);
                    setLoading(false);
                    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
                },
                (error) => {
                    clearTimeout(timeout);
                    setLoading(false);
                    console.warn('Chat error:', error.code);
                }
            );
        } catch (e) {
            console.error('subscribeMessages error:', e);
            clearTimeout(timeout);
            setLoading(false);
        }
        markRoomAsRead(roomId, myEmail).catch(() => { });
        return () => { clearTimeout(timeout); unsub?.(); };
    }, [roomId, myEmail]);

    // ── Handle text input → detect # ─────────────────────────
    const handleInputChange = (text) => {
        setInput(text);

        const hashIdx = text.lastIndexOf('#');
        if (hashIdx === -1) {
            setShowMenu(false);
            return;
        }

        const afterHash = text.slice(hashIdx + 1);
        const hasSpace = afterHash.includes(' ') && afterHash.trim().includes(' ');
        if (hasSpace) {
            setShowMenu(false);
            return;
        }

        setMentionQuery(afterHash.trim());
        setShowMenu(true);
    };

    // ── Khi chọn order từ menu ────────────────────────────────
    const handleSelectOrder = async (order) => {
        setShowMenu(false);

        const hashIdx = input.lastIndexOf('#');
        const cleanedInput = input.slice(0, hashIdx).trim();
        setInput(cleanedInput);

        setSending(true);
        try {
            await sendMessage({
                roomId,
                text: `ORDER#${order.id}`,
                type: 'order_ref',
                orderData: {
                    id: order.id,
                    customer: order.customer,
                    address: order.address,
                    createdAt: order.createdAt,
                    status: order.status,
                    items: productItems(order),
                },
                senderEmail: myEmail,
                senderName: myName,
            });
        } catch (e) {
            console.error('Send order ref error:', e);
        } finally {
            setSending(false);
        }
    };

    const handleDismissMenu = () => setShowMenu(false);

    // ── Send text ─────────────────────────────────────────────
    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setInput('');
        setShowMenu(false);
        setSending(true);
        try {
            await sendMessage({ roomId, text, senderEmail: myEmail, senderName: myName });
        } catch (e) { console.error(e); }
        finally { setSending(false); }
    };

    const renderMsg = ({ item, index }) => {
        const isMe = item.sender === myEmail;
        const prev = index > 0 ? messages[index - 1] : null;
        return <MessageBubble msg={item} isMe={isMe} prevSender={prev?.sender} />;
    };

    // Hint hiển thị khi có orders sẵn, chưa mở menu
    const showMentionHint = orders.length > 0 && !showMenu;

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />

            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.replace('(tabs)/chatList')} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={S.headerInfo}>
                    <View style={S.headerIcon}>
                        <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                    </View>
                    <View>
                        <Text style={S.headerTitle}>
                            {roomId.startsWith('support_') ? 'Hỗ trợ khách hàng' : `Đơn hàng #${orderId}`}
                        </Text>
                        <View style={S.onlineDot}>
                            <View style={S.dot} />
                            <Text style={S.onlineText}>
                                {roomId.startsWith('support_') ? 'Phòng hỗ trợ chung' : 'Chat với admin'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {loading ? (
                    <View style={S.loadWrap}>
                        <ActivityIndicator color="#2563EB" />
                        <Text style={S.loadText}>Đang tải tin nhắn...</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        renderItem={renderMsg}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={S.msgList}
                        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            <View style={S.emptyWrap}>
                                <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
                                <Text style={S.emptyText}>Chưa có tin nhắn nào</Text>
                                <Text style={S.emptySub}>Gửi tin nhắn đầu tiên để bắt đầu</Text>
                            </View>
                        }
                    />
                )}

                {/* # Order Mention Menu — hiển thị cho cả admin lẫn non-admin */}
                {showMenu && (
                    <OrderMentionMenu
                        orders={orders}
                        query={mentionQuery}
                        onSelect={handleSelectOrder}
                        onDismiss={handleDismissMenu}
                    />
                )}

                {/* Input bar */}
                <View style={[S.inputBar, { paddingBottom: insets.bottom + 8 }]}>
                    {showMentionHint && (
                        <Text style={S.mentionHint}>
                            Gõ <Text style={S.mentionHintHash}>#</Text> để đính kèm đơn hàng
                        </Text>
                    )}
                    <View style={S.inputWrap}>
                        <TextInput
                            style={S.input}
                            value={input}
                            onChangeText={handleInputChange}
                            placeholder="Nhập tin nhắn..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            maxLength={500}
                            onKeyPress={isDesktop ? (e) => {
                                if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            } : undefined}
                            blurOnSubmit={false}
                        />
                        <TouchableOpacity
                            style={[S.sendBtn, (!input.trim() || sending) && S.sendBtnDisabled]}
                            onPress={handleSend}
                            disabled={!input.trim() || sending}
                            activeOpacity={0.8}
                        >
                            {sending
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="send" size={18} color="#fff" />
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

// Styles giữ nguyên toàn bộ như cũ...

// ── Order Card Styles ─────────────────────────────────────────
const OC = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', minWidth: 260, maxWidth: 300 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#EFF6FF' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    orderId: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusText: { fontSize: 10, fontWeight: '600' },
    divider: { height: 1, backgroundColor: '#E2E8F0' },
    infoRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
    infoCol: { flex: 1 },
    infoLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4 },
    infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 2 },
    infoVal: { fontSize: 12, color: '#0F172A', fontWeight: '500', flex: 1 },
    infoAddr: { fontSize: 11, color: '#64748B', flex: 1, lineHeight: 15 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },
    badge: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
    itemSub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
    itemTotal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0F172A', paddingHorizontal: 14, paddingVertical: 12 },
    totalLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    totalVal: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

// ── Mention Menu Styles ───────────────────────────────────────
const M = StyleSheet.create({
    container: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', maxHeight: 260, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569' },
    closeBtn: { padding: 2 },
    list: { maxHeight: 210 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    itemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    itemSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
});

// ── Bubble Styles ─────────────────────────────────────────────
const B = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, paddingHorizontal: 12 },
    rowMe: { flexDirection: 'row-reverse' },
    avatarCol: { width: 32, marginRight: 6, alignItems: 'center' },
    avatarSpacer: { width: 32 },
    avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    bubbleCol: { maxWidth: '75%' },
    bubbleColMe: { alignItems: 'flex-end' },
    senderName: { fontSize: 11, color: '#64748B', marginBottom: 2, marginLeft: 4, fontWeight: '600' },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 2 },
    bubbleMe: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
    bubbleThem: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
    msgText: { fontSize: 14, color: '#0F172A', lineHeight: 20 },
    msgTextMe: { color: '#FFFFFF' },
    time: { fontSize: 10, color: '#94A3B8', marginLeft: 4 },
    timeMe: { textAlign: 'right', marginRight: 4 },
    orderWrap: { marginBottom: 2 },
    orderWrapMe: { alignItems: 'flex-end' },
    // System
    systemWrap: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 20 },
    systemBubble: { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center' },
    statusBubble: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    systemText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 17 },
    statusText: { color: '#2563EB' },
    systemTime: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});

// ── Screen Styles ─────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F1F5F9' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    onlineDot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
    onlineText: { fontSize: 11, color: '#64748B' },
    loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    loadText: { fontSize: 13, color: '#94A3B8' },
    msgList: { paddingVertical: 12, paddingBottom: 8 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
    emptyText: { fontSize: 15, fontWeight: '600', color: '#374151' },
    emptySub: { fontSize: 13, color: '#94A3B8' },
    inputBar: { backgroundColor: '#FFFFFF', paddingTop: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    mentionHint: { fontSize: 11, color: '#94A3B8', paddingBottom: 4, paddingHorizontal: 2 },
    mentionHintHash: { color: '#2563EB', fontWeight: '700' },
    inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
    input: { flex: 1, fontSize: 14, color: '#0F172A', maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});