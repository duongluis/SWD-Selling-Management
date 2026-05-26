import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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
    const { orderId, phone } = service;
    if (!orderId || !phone || newSvcStatus !== 'Hoàn thành') return null;

    try {
        // 1. Lấy tất cả dịch vụ thuộc đơn hàng này
        const q = query(collection(db, 'service'), where('orderId', '==', orderId));
        const snap = await getDocs(q);

        // 2. Kiểm tra xem có dịch vụ nào chưa "Hoàn thành" không
        // Lưu ý: snap bao gồm cả dịch vụ vừa cập nhật (vì hàm này chạy sau khi update thành công)
        const allServices = snap.docs.map(d => d.data());
        const isAllDone = allServices.every(s => s.status === 'Hoàn thành');

        if (isAllDone) {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            if (!orderSnap.exists()) return null;

            const currentStatus = orderSnap.data().status;
            // Chỉ cập nhật nếu đơn hàng chưa ở các trạng thái cuối
            if (!['Đã thanh toán', 'Đã hủy'].includes(currentStatus)) {
                await updateDoc(orderRef, { status: 'Chờ thanh toán' });
                return 'Chờ thanh toán';
            }
        }
        return null;
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
    const LOCKED = new Set(['Đã hủy', 'CANCELLED', 'Hoàn thành']);
    return LOCKED.has(svcStatus);
}

// ── Order → Service sync mapping ─────────────────────────────
const ORDER_TO_SERVICE_STATUS = {
    'Chờ lắp đặt': 'Chờ xử lý',
    'Đang lắp đặt': 'Đang xử lý',
    'Chờ giao hàng': 'Chờ xử lý',
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