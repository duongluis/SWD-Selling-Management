// utils/chatService.js
// Toàn bộ logic chat + notification — không cần Cloud Function
// Dùng Firestore onSnapshot để realtime sync

import {
    addDoc, collection, doc, getDoc, getDocs,
    onSnapshot, query, serverTimestamp,
    setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

// ─────────────────────────────────────────────────────────────
// ROOM MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Tạo room chat khi đơn hàng được tạo.
 * roomId = 'order_{orderId}'  →  dễ tra cứu từ orderId
 */
export const createOrderChatRoom = async ({ orderId, orderType, createdBy, createdByName, adminEmails = [] }) => {
    const roomId = `order_${orderId}`;
    const members = [createdBy, ...adminEmails];

    // Lấy tất cả admin nếu không truyền vào
    let resolvedAdmins = adminEmails;
    if (resolvedAdmins.length === 0) {
        try {
            const snap = await getDocs(
                query(collection(db, 'users'), where('role', '==', 'admin'))
            );
            resolvedAdmins = snap.docs.map(d => d.data().email).filter(Boolean);
        } catch (_) { }
    }

    const allMembers = [...new Set([createdBy, ...resolvedAdmins])];
    const unreadCount = {};
    // Admin chưa đọc = 1 (tin nhắn tạo đơn)
    resolvedAdmins.forEach(a => { unreadCount[a] = 1; });
    unreadCount[createdBy] = 0;

    await setDoc(doc(db, 'chatRooms', roomId), {
        roomId,
        orderId,
        orderType,
        createdBy,
        createdByName: createdByName || createdBy,
        members: allMembers,
        lastMessage: `Đơn hàng #${orderId} vừa được tạo`,
        lastAt: new Date().toISOString(),
        unreadCount,
        createdAt: new Date().toISOString(),
    });

    // Gửi tin nhắn hệ thống đầu tiên
    await sendSystemMessage(roomId, `📦 Đơn hàng #${orderId} đã được tạo bởi ${createdByName || createdBy}.`);

    // Thông báo cho admin
    for (const adminEmail of resolvedAdmins) {
        await createNotification({
            userEmail: adminEmail,
            type: 'new_order',
            title: '📦 Đơn hàng mới',
            body: `${createdByName || createdBy} vừa tạo đơn #${orderId}`,
            orderId,
            roomId,
        });
    }

    // Thông báo cho user: đã được thêm vào room
    await createNotification({
        userEmail: createdBy,
        type: 'added_to_room',
        title: '💬 Phòng chat đã sẵn sàng',
        body: `Đơn hàng #${orderId} của bạn đã có phòng chat với admin.`,
        orderId,
        roomId,
    });

    return roomId;
};

/**
 * Lấy roomId từ orderId (nếu tồn tại)
 */
export const getRoomIdByOrderId = (orderId) => `order_${orderId}`;

/**
 * Kiểm tra room có tồn tại không
 */
export const checkRoomExists = async (roomId) => {
    const snap = await getDoc(doc(db, 'chatRooms', roomId));
    return snap.exists();
};

// ─────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────

/**
 * Gửi tin nhắn thường
 */
export const sendMessage = async ({ roomId, text, senderEmail, senderName }) => {
    if (!text.trim()) return;

    const msgRef = await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text: text.trim(),
        sender: senderEmail,
        senderName: senderName || senderEmail,
        type: 'text',
        createdAt: serverTimestamp(),
        readBy: [senderEmail],
    });

    // Cập nhật lastMessage trên room
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
        const data = roomSnap.data();
        const unread = { ...(data.unreadCount || {}) };
        // Tăng unread cho các thành viên khác
        (data.members || []).forEach(m => {
            if (m !== senderEmail) unread[m] = (unread[m] || 0) + 1;
        });

        await updateDoc(roomRef, {
            lastMessage: text.trim(),
            lastAt: new Date().toISOString(),
            unreadCount: unread,
        });

        // Tạo notification cho thành viên khác
        const others = (data.members || []).filter(m => m !== senderEmail);
        for (const memberEmail of others) {
            await createNotification({
                userEmail: memberEmail,
                type: 'new_message',
                title: `💬 ${senderName || senderEmail}`,
                body: text.trim().length > 60 ? text.trim().slice(0, 60) + '...' : text.trim(),
                orderId: data.orderId,
                roomId,
            });
        }
    }

    return msgRef.id;
};

/**
 * Gửi tin nhắn hệ thống (không phải người dùng)
 */
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

/**
 * Gửi tin nhắn khi đổi trạng thái đơn
 */
export const sendStatusUpdateMessage = async ({ orderId, newStatus, changedBy, changedByName }) => {
    const roomId = getRoomIdByOrderId(orderId);
    const exists = await checkRoomExists(roomId);
    if (!exists) return;

    const text = `🔄 Trạng thái đơn hàng #${orderId} đã cập nhật → "${newStatus}" bởi ${changedByName || changedBy}`;

    await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text,
        sender: 'system',
        senderName: 'Hệ thống',
        type: 'status_update',
        newStatus,
        createdAt: serverTimestamp(),
        readBy: [],
    });

    // Cập nhật lastMessage
    await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: `Trạng thái → "${newStatus}"`,
        lastAt: new Date().toISOString(),
    });

    // Notify tất cả thành viên trong room
    const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
    if (roomSnap.exists()) {
        const { members, createdBy } = roomSnap.data();
        for (const memberEmail of (members || [])) {
            await createNotification({
                userEmail: memberEmail,
                type: 'order_update',
                title: '🔄 Cập nhật đơn hàng',
                body: `Đơn #${orderId} chuyển sang "${newStatus}"`,
                orderId,
                roomId,
            });
        }
    }
};

/**
 * Đánh dấu đã đọc tất cả tin nhắn trong room
 */
export const markRoomAsRead = async (roomId, userEmail) => {
    const roomRef = doc(db, 'chatRooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const unread = { ...(snap.data().unreadCount || {}) };
    unread[userEmail] = 0;
    await updateDoc(roomRef, { unreadCount: unread });
};

/**
 * Subscribe realtime messages — trả về hàm unsubscribe
 * Không dùng orderBy để tránh yêu cầu tạo index Firestore
 */
export const subscribeMessages = (roomId, callback) => {
    const q = collection(db, 'chatRooms', roomId, 'messages');
    return onSnapshot(q, (snap) => {
        const msgs = snap.docs
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => {
                // serverTimestamp trả về Timestamp object hoặc null khi pending
                const ta = a.createdAt?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
                const tb = b.createdAt?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
                return ta - tb;
            });
        callback(msgs);
    }, (error) => {
        console.error('subscribeMessages error:', error);
        callback([]); // Trả về rỗng thay vì treo mãi
    });
};

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Tạo notification cho 1 user
 */
export const createNotification = async ({ userEmail, type, title, body, orderId, roomId }) => {
    await addDoc(collection(db, 'notifications', userEmail, 'items'), {
        type,
        title,
        body,
        orderId: orderId || null,
        roomId: roomId || null,
        read: false,
        createdAt: new Date().toISOString(),
    });
};

/**
 * Subscribe realtime notifications — không dùng orderBy để tránh index
 */
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

/**
 * Đánh dấu 1 notification đã đọc
 */
export const markNotificationRead = async (userEmail, notifId) => {
    await updateDoc(doc(db, 'notifications', userEmail, 'items', notifId), { read: true });
};

/**
 * Đánh dấu tất cả notification đã đọc
 */
export const markAllNotificationsRead = async (userEmail) => {
    const snap = await getDocs(
        query(collection(db, 'notifications', userEmail, 'items'), where('read', '==', false))
    );
    await Promise.all(
        snap.docs.map(d => updateDoc(d.ref, { read: true }))
    );
};