import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

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
        'Đang xử lý': 'Đang lắp đặt',   // service chờ→đang  : order chờ lắp→đang lắp
        'Hoàn thành': 'Đã lắp đặt',     // service hoàn thành: order đã lắp
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
        const updated = orders.map(o =>
            o.id === orderId ? { ...o, status: newOrderStatus } : o
        );

        await updateDoc(doc(db, 'orders', phone), { orders: updated });
        console.log(`[syncOrderStatus] Order #${orderId}: auto → "${newOrderStatus}"`);
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