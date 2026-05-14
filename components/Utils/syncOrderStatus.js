import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { createNotification } from './chatService';

// ── Mapping: (serviceType, newServiceStatus) → orderStatus ──
// Chỉ map những trạng thái cần auto-sync (changeable:false ở đơn hàng)
const SERVICE_TO_ORDER_STATUS = {
    // Dịch vụ Giao hàng → Đơn buôn
    DELIVERY: {
        'Đang xử lý': 'Đang giao hàng', // service chờ→đang  : order chờ giao→đang giao
        'Hoàn thành': 'Đã giao hàng',   // service hoàn thành: order đã giao
    },
    // Dịch vụ Lắp đặt → Đơn lẻ
    INSTALLATION: {
        'Đang xử lý': 'Đang lắp đặt',   // service đang xử lý → order đang lắp đặt
        'Hoàn thành': 'Chờ thanh toán', // service hoàn thành → order chờ thanh toán
    },
};

// ── Tên trạng thái service (từ status_seed) ──────────────────
// Map từ key nội bộ cũ sang tên mới theo seed
const SVC_STATUS_NAMES = {
    PENDING: 'Chờ xử lý',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
};

/**
 * Gọi sau khi updateDoc service thành công.
 *
 * @param {object} service  - service doc data (phải có: id, type, orderId, phone)
 * @param {string} newSvcStatus  - key trạng thái mới (VD: 'PROCESSING', 'COMPLETED')
 * @returns {string|null}  - tên trạng thái đơn hàng mới nếu có sync, null nếu không
 */
export async function syncOrderStatusFromService(service, newSvcStatus) {
    const { type, orderId, phone } = service;

    // Không có đơn hàng liên kết → bỏ qua
    if (!orderId || !phone) return null;

    // Lấy mapping cho loại dịch vụ này
    const mapping = SERVICE_TO_ORDER_STATUS[type];
    if (!mapping) return null;

    // Lấy tên trạng thái đầy đủ từ key (PROCESSING → 'Đang xử lý')
    const svcStatusName = SVC_STATUS_NAMES[newSvcStatus] || newSvcStatus;

    // Tra mapping → trạng thái đơn hàng tương ứng
    const newOrderStatus = mapping[svcStatusName];
    if (!newOrderStatus) return null;

    try {
        // Đọc doc đơn hàng (lưu dạng array trong doc/{phone})
        const orderDoc = await getDoc(doc(db, 'orders', phone));
        if (!orderDoc.exists()) return null;

        const orders = orderDoc.data().orders || [];
        const targetOrder = orders.find(o => o.id === orderId);
        const updated = orders.map(o =>
            o.id === orderId ? { ...o, status: newOrderStatus } : o
        );

        await updateDoc(doc(db, 'orders', phone), { orders: updated });
        console.log(`[syncOrderStatus] Order #${orderId}: auto → "${newOrderStatus}"`);

        // Gửi thông báo thanh toán khi dịch vụ lắp đặt hoàn thành
        if (newOrderStatus === 'Chờ thanh toán' && targetOrder?.createdBy) {
            createNotification({
                userEmail: targetOrder.createdBy,
                type: 'order_update',
                title: '💰 Yêu cầu thanh toán',
                body: `Lắp đặt đơn hàng #${orderId} đã hoàn thành. Vui lòng thanh toán để hoàn tất.`,
                orderId,
            }).catch(() => { });
        }

        return newOrderStatus;
    } catch (e) {
        console.error('[syncOrderStatus] Lỗi:', e.message);
        return null;
    }
}

/**
 * Kiểm tra trạng thái hiện tại của đơn hàng có changeable:false không.
 * Dùng để disable nút đổi thủ công trên UI.
 *
 * @param {string} orderStatus - tên trạng thái đơn hàng (VD: 'Đang giao hàng')
 * @returns {boolean}
 */
export function isOrderStatusLocked(orderStatus) {
    const LOCKED = new Set([
        'Chờ giao hàng',
        'Đang giao hàng',
        'Chờ lắp đặt',
        'Đang lắp đặt',
        'Đã hủy',
    ]);
    return LOCKED.has(orderStatus);
}

/**
 * Kiểm tra trạng thái hiện tại của dịch vụ có changeable:false không.
 *
 * @param {string} svcStatus - tên hoặc key trạng thái (VD: 'Đã hủy' hoặc 'CANCELLED')
 * @returns {boolean}
 */
export function isServiceStatusLocked(svcStatus) {
    const LOCKED = new Set(['Đã hủy', 'CANCELLED']);
    return LOCKED.has(svcStatus);
}

// ── Order → Service sync mapping ─────────────────────────────
const ORDER_TO_SERVICE_STATUS = {
    'Chờ lắp đặt':  'Chờ xử lý',
    'Đang lắp đặt': 'Đang xử lý',
    'Chờ giao hàng':  'Chờ xử lý',
    'Đang giao hàng': 'Đang xử lý',
};

/**
 * Khi trạng thái đơn hàng thay đổi → tự động cập nhật dịch vụ liên kết.
 *
 * @param {string} orderId         - mã đơn hàng (service.orderId)
 * @param {string} newOrderStatus  - trạng thái đơn hàng mới
 * @returns {string|null}          - trạng thái dịch vụ mới nếu có sync, null nếu không
 */
export async function syncServiceStatusFromOrder(orderId, newOrderStatus) {
    const newSvcStatus = ORDER_TO_SERVICE_STATUS[newOrderStatus];
    if (!newSvcStatus || !orderId) return null;

    try {
        const snap = await getDocs(
            query(collection(db, 'service'), where('orderId', '==', orderId))
        );
        if (snap.empty) return null;

        // Chỉ cập nhật dịch vụ chưa bị khóa (không phải Đã hủy)
        const toUpdate = snap.docs.filter(d => !isServiceStatusLocked(d.data().status));
        if (toUpdate.length === 0) return null;

        await Promise.all(toUpdate.map(d =>
            updateDoc(doc(db, 'service', d.id), { status: newSvcStatus })
        ));
        console.log(`[syncServiceStatus] Order #${orderId}: services auto → "${newSvcStatus}"`);
        return newSvcStatus;
    } catch (e) {
        console.error('[syncServiceStatus] Lỗi:', e.message);
        return null;
    }
}