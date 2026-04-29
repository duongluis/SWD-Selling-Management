// app/chat/[roomId]/index.jsx
// Màn hình chat realtime cho 1 đơn hàng

import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView,
    Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    markRoomAsRead, sendMessage, subscribeMessages,
} from '../../../components/Utils/chatService';

const isWeb = Platform.OS === 'web';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const hashColor = (str) => AVATAR_COLORS[
    (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
];

// ── Bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isMe, prevSender }) {
    const isSystem = msg.type === 'system' || msg.type === 'status_update';
    const showAvatar = !isMe && !isSystem && prevSender !== msg.sender;
    const showSenderName = !isMe && !isSystem && prevSender !== msg.sender;

    const timeStr = msg.createdAt?.toDate
        ? msg.createdAt.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : '';

    // System message
    if (isSystem) {
        return (
            <View style={B.systemWrap}>
                <View style={[B.systemBubble, msg.type === 'status_update' && B.statusBubble]}>
                    <Text style={[B.systemText, msg.type === 'status_update' && B.statusText]}>
                        {msg.text}
                    </Text>
                    <Text style={B.systemTime}>{timeStr}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[B.row, isMe && B.rowMe]}>
            {/* Avatar bên trái cho người khác */}
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
                <View style={[B.bubble, isMe ? B.bubbleMe : B.bubbleThem]}>
                    <Text style={[B.msgText, isMe && B.msgTextMe]}>{msg.text}</Text>
                </View>
                <Text style={[B.time, isMe && B.timeMe]}>{timeStr}</Text>
            </View>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function ChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { userDetail } = useContext(UserDetailContext);

    const roomId = params.roomId || '';
    const orderId = params.orderId || '';

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatRef = useRef(null);

    const myEmail = userDetail?.email || '';
    const myName = userDetail?.name || myEmail;

    // ── Subscribe realtime messages ───────────────────────────
    useEffect(() => {
        if (!roomId) return;
        setLoading(true);

        // Timeout fallback — nếu sau 5s vẫn chưa có callback thì dừng loading
        const timeout = setTimeout(() => setLoading(false), 5000);

        let unsub;
        try {
            unsub = subscribeMessages(roomId, (msgs) => {
                clearTimeout(timeout);
                setMessages(msgs);
                setLoading(false);
                setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
            });
        } catch (e) {
            console.error('subscribeMessages error:', e);
            clearTimeout(timeout);
            setLoading(false);
        }

        // Đánh dấu đã đọc khi vào room
        markRoomAsRead(roomId, myEmail).catch(() => { });

        return () => {
            clearTimeout(timeout);
            unsub?.();
        };
    }, [roomId, myEmail]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setInput('');
        setSending(true);
        try {
            await sendMessage({ roomId, text, senderEmail: myEmail, senderName: myName });
        } catch (e) { console.error(e); }
        finally { setSending(false); }
    };

    const renderMsg = ({ item, index }) => {
        const isMe = item.sender === myEmail;
        const prev = index > 0 ? messages[index - 1] : null;
        return (
            <MessageBubble
                msg={item}
                isMe={isMe}
                prevSender={prev?.sender}
            />
        );
    };

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }]}>
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={S.headerInfo}>
                    <View style={S.headerIcon}>
                        <Ionicons name="receipt-outline" size={16} color="#2563EB" />
                    </View>
                    <View>
                        <Text style={S.headerTitle}>Đơn hàng #{orderId}</Text>
                        <View style={S.onlineDot}>
                            <View style={S.dot} />
                            <Text style={S.onlineText}>Chat với admin</Text>
                        </View>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Messages */}
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
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={S.msgList}
                        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                        ListEmptyComponent={
                            <View style={S.emptyWrap}>
                                <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
                                <Text style={S.emptyText}>Chưa có tin nhắn nào</Text>
                                <Text style={S.emptySub}>Gửi tin nhắn đầu tiên để bắt đầu</Text>
                            </View>
                        }
                    />
                )}

                {/* Input */}
                <View style={[S.inputBar, { paddingBottom: insets.bottom + 8 }]}>
                    <View style={S.inputWrap}>
                        <TextInput
                            style={S.input}
                            value={input}
                            onChangeText={setInput}
                            placeholder="Nhập tin nhắn..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            maxLength={500}
                            onSubmitEditing={isWeb ? handleSend : undefined}
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

// ── Bubble styles ────────────────────────────────────────────
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
    // System
    systemWrap: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 20 },
    systemBubble: { backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, alignItems: 'center' },
    statusBubble: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    systemText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 17 },
    statusText: { color: '#2563EB' },
    systemTime: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});

// ── Screen styles ────────────────────────────────────────────
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
    inputBar: { backgroundColor: '#FFFFFF', paddingTop: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
    input: { flex: 1, fontSize: 14, color: '#0F172A', maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});