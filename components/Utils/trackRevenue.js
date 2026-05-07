import { arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

const PAID_STATUS = 'Đã thanh toán';

/**
 * Gọi khi admin đổi trạng thái đơn hàng sang "Đã thanh toán".
 * Ghi thẳng vào db/users/{email}, chống double-count qua revenueOrders[].
 */
export async function trackRevenueOnPaid(userEmail, order, newStatus) {
    if (newStatus !== PAID_STATUS) return false;
    if (!userEmail || !order?.id) return false;

    const orderTotal = (order.items || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
    if (orderTotal <= 0) return false;

    try {
        const userRef = doc(db, 'users', userEmail);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return false; // user không tồn tại

        const data = userSnap.data();
        const revenueOrders = data.revenueOrders || [];

        // Đã tính rồi → bỏ qua
        if (revenueOrders.includes(order.id)) {
            console.log(`[trackRevenue] Order ${order.id} đã được tính, bỏ qua.`);
            return false;
        }

        // Cộng vào user doc
        await updateDoc(userRef, {
            revenueTotal: increment(orderTotal),
            revenueOrders: arrayUnion(order.id),
        });

        console.log(`[trackRevenue] +${orderTotal} cho ${userEmail} (đơn ${order.id})`);
        return true;
    } catch (e) {
        console.error('[trackRevenue] Lỗi:', e.message);
        return false;
    }
}