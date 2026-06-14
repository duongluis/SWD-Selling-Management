// chatService.js – Unified support room for every user
import { db } from '@/config/firebaseConfig';
import {
    addDoc, collection, doc, getDoc, getDocs,
    onSnapshot, query, serverTimestamp,
    setDoc, updateDoc, where,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// 1. Helper: get support room id from email
// ─────────────────────────────────────────────────────────────
export const getSupportRoomId = (userEmail) =>
    `support_${userEmail.replace(/[@.]/g, '_')}`;

// ─────────────────────────────────────────────────────────────
// 2. Create or get support room (single room per user)
// ─────────────────────────────────────────────────────────────
export const createSupportRoom = async ({ userEmail, userName }) => {
    const roomId = getSupportRoomId(userEmail);
    const roomRef = doc(db, 'chatRooms', roomId);
    const existing = await getDoc(roomRef);
    if (existing.exists()) return roomId;

    // Get all admin emails
    const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);

    const allMembers = [...new Set([userEmail, ...adminEmails])];
    const unreadCount = {};
    adminEmails.forEach(a => { unreadCount[a] = 1; });
    unreadCount[userEmail] = 0;

    await setDoc(roomRef, {
        roomId,
        type: 'support',
        userEmail,
        members: allMembers,
        lastMessage: `Chào mừng ${userName || userEmail} đến với hệ thống!`,
        lastAt: new Date().toISOString(),
        unreadCount,
        createdAt: new Date().toISOString(),
    });

    await sendSystemMessage(roomId, `🎉 Chào mừng ${userName || userEmail} đến với hệ thống. Mọi đơn hàng, dịch vụ sẽ được cập nhật tại đây.`);

    await createNotification({
        userEmail,
        type: 'support_room_ready',
        title: '💬 Phòng hỗ trợ đã sẵn sàng',
        body: 'Bạn có thể chat với admin và theo dõi cập nhật đơn hàng tại đây.',
        roomId,
        path: `/chat/${roomId}`,
    });

    return roomId;
};

// ─────────────────────────────────────────────────────────────
// 3. Create order chat – now just sends message into support room
// ─────────────────────────────────────────────────────────────
export const createOrderChatRoom = async ({ orderId, orderType, createdBy, createdByName, adminEmails = [] }) => {
    // Ensure support room exists
    await createSupportRoom({ userEmail: createdBy, userName: createdByName });
    const roomId = getSupportRoomId(createdBy);

    // Send system message about new order
    await sendSystemMessage(roomId, `📦 Đơn hàng #${orderId} (${orderType === 'buon' ? 'Đơn buôn' : 'Đơn lẻ'}) vừa được tạo bởi ${createdByName || createdBy}.`);

    // Update lastMessage on room
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
        await updateDoc(roomRef, {
            lastMessage: `Đơn hàng #${orderId} vừa được tạo`,
            lastAt: new Date().toISOString(),
        });
    }

    // Notify admins
    let resolvedAdmins = adminEmails;
    if (resolvedAdmins.length === 0) {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        resolvedAdmins = snap.docs.map(d => d.data().email).filter(Boolean);
    }
    for (const adminEmail of resolvedAdmins) {
        await createNotification({
            userEmail: adminEmail,
            type: 'new_order',
            title: '📦 Đơn hàng mới',
            body: `${createdByName || createdBy} vừa tạo đơn #${orderId}`,
            orderId,
            roomId,
            path: `/chat/${roomId}?orderId=${orderId}`,
        });
    }

    // Notify the user (optional)
    await createNotification({
        userEmail: createdBy,
        type: 'order_created',
        title: '📦 Đơn hàng đã tạo',
        body: `Đơn #${orderId} đã được tạo. Theo dõi trạng thái tại phòng chat hỗ trợ.`,
        orderId,
        roomId,
        path: `/chat/${roomId}?orderId=${orderId}`,
    });

    return roomId;
};

// ─────────────────────────────────────────────────────────────
// 4. Check if room exists
// ─────────────────────────────────────────────────────────────
export const checkRoomExists = async (roomId) => {
    const snap = await getDoc(doc(db, 'chatRooms', roomId));
    return snap.exists();
};

// ─────────────────────────────────────────────────────────────
// 5. Send normal message
// ─────────────────────────────────────────────────────────────
export const sendMessage = async ({ roomId, text, type = 'text', orderData, senderEmail, senderName }) => {
    if (!text.trim()) return;

    const msgRef = await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text: text.trim(),
        sender: senderEmail,
        senderName: senderName || senderEmail,
        type,
        ...(orderData ? { orderData } : {}),
        createdAt: serverTimestamp(),
        readBy: [senderEmail],
    });

    // Update lastMessage on room
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
        const data = roomSnap.data();
        const unread = { ...(data.unreadCount || {}) };
        (data.members || []).forEach(m => {
            if (m !== senderEmail) unread[m] = (unread[m] || 0) + 1;
        });

        await updateDoc(roomRef, {
            lastMessage: text.trim(),
            lastAt: new Date().toISOString(),
            unreadCount: unread,
        });

        // Notify other members
        const others = (data.members || []).filter(m => m !== senderEmail);
        for (const memberEmail of others) {
            await createNotification({
                userEmail: memberEmail,
                type: 'new_message',
                title: `💬 ${senderName || senderEmail}`,
                body: text.trim().length > 60 ? text.trim().slice(0, 60) + '...' : text.trim(),
                orderId: data.orderId,
                roomId,
                path: `/chat/${roomId}`,
            });
        }
    }

    return msgRef.id;
};

// ─────────────────────────────────────────────────────────────
// 6. Send system message
// ─────────────────────────────────────────────────────────────
export const sendSystemMessage = async (roomId, text) => {
    await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text,
        sender: 'system',
        senderName: 'Hệ thống',
        type: 'system',
        createdAt: serverTimestamp(),
        readBy: [],
    });
};

// ─────────────────────────────────────────────────────────────
// 7. Send status update message (into support room)
// ─────────────────────────────────────────────────────────────
export const sendStatusUpdateMessage = async ({ orderId, newStatus, changedBy, changedByName }) => {
    // Lấy thông tin đơn hàng từ collection orders (cấu trúc phẳng)
    let createdByEmail = null;
    try {
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (orderDoc.exists()) {
            createdByEmail = orderDoc.data().createdBy;
        }
    } catch (e) { console.warn('Lỗi tìm order:', e); }
    if (!createdByEmail) return;

    const roomId = getSupportRoomId(createdByEmail);
    const exists = await checkRoomExists(roomId);
    if (!exists) return;

    const text = `🔄 Trạng thái đơn hàng #${orderId} đã cập nhật → "${newStatus}"`;

    await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text,
        sender: 'system',
        senderName: 'Hệ thống',
        type: 'status_update',
        newStatus,
        orderId,
        createdAt: serverTimestamp(),
        readBy: [],
    });

    await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: `Trạng thái đơn #${orderId} → "${newStatus}"`,
        lastAt: new Date().toISOString(),
    });

    // Notify tất cả thành viên trong phòng support
    const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
    if (roomSnap.exists()) {
        const { members } = roomSnap.data();
        for (const memberEmail of (members || [])) {
            await createNotification({
                userEmail: memberEmail,
                type: 'order_update',
                title: '🔄 Cập nhật đơn hàng',
                body: `Đơn #${orderId} chuyển sang "${newStatus}"`,
                orderId,
                roomId,
                path: `/chat/${roomId}?orderId=${orderId}`,
            });
        }
    }
};

// ─────────────────────────────────────────────────────────────
// 8. Mark room as read
// ─────────────────────────────────────────────────────────────
export const markRoomAsRead = async (roomId, userEmail) => {
    const roomRef = doc(db, 'chatRooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const unread = { ...(snap.data().unreadCount || {}) };
    unread[userEmail] = 0;
    await updateDoc(roomRef, { unreadCount: unread });
};

// ─────────────────────────────────────────────────────────────
// 9. Subscribe to messages in a room
// ─────────────────────────────────────────────────────────────
export const subscribeMessages = (roomId, callback) => {
    const q = collection(db, 'chatRooms', roomId, 'messages');
    return onSnapshot(q, (snap) => {
        const msgs = snap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
                const tb = b.createdAt?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
                return ta - tb;
            });
        callback(msgs);
    }, (error) => {
        console.error('subscribeMessages error:', error);
        callback([]);
    });
};

// ─────────────────────────────────────────────────────────────
// 10. Create notification with automatic path
// ─────────────────────────────────────────────────────────────
export const createNotification = async ({ userEmail, type, title, body, orderId, roomId, path }) => {
    let notificationPath = path;
    if (!notificationPath) {
        if (roomId) {
            notificationPath = `/chat/${roomId}${orderId ? `?orderId=${orderId}` : ''}`;
        } else if (orderId) {
            notificationPath = '/(tabs)/order';
        } else {
            notificationPath = '/';
        }
    }
    await addDoc(collection(db, 'notifications', userEmail, 'items'), {
        type,
        title,
        body,
        orderId: orderId || null,
        roomId: roomId || null,
        path: notificationPath,
        read: false,
        createdAt: new Date().toISOString(),
    });
};

// ─────────────────────────────────────────────────────────────
// 11. Subscribe to notifications
// ─────────────────────────────────────────────────────────────
export const subscribeNotifications = (userEmail, callback) => {
    const q = collection(db, 'notifications', userEmail, 'items');
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        callback(items);
    }, (error) => {
        console.error('subscribeNotifications error:', error);
        callback([]);
    });
};

// ─────────────────────────────────────────────────────────────
// 12. Mark a single notification as read
// ─────────────────────────────────────────────────────────────
export const markNotificationRead = async (userEmail, notifId) => {
    await updateDoc(doc(db, 'notifications', userEmail, 'items', notifId), { read: true });
};

// ─────────────────────────────────────────────────────────────
// 13. Mark all notifications as read
// ─────────────────────────────────────────────────────────────
export const markAllNotificationsRead = async (userEmail) => {
    const snap = await getDocs(
        query(collection(db, 'notifications', userEmail, 'items'), where('read', '==', false))
    );
    await Promise.all(
        snap.docs.map(d => updateDoc(d.ref, { read: true }))
    );
};