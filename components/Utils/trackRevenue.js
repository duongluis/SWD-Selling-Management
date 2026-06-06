import { arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';

const PAID_STATUS = 'Đã thanh toán';

/**
 * Gọi khi admin đổi trạng thái đơn hàng sang "Đã thanh toán".
 */
export async function trackRevenueOnPaid(userEmail, order, newStatus) {
    if (newStatus !== PAID_STATUS) return false;
    if (!userEmail || !order?.id) return false;

    // Fix lỗi operator precedence
    const orderTotal = (order.items || []).reduce(
        (s, p) => s + ((p.price || 0) * (p.qty || 1)), 0
    );
    if (orderTotal <= 0) return false;

    try {
        const userRef = doc(db, 'users', userEmail);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return false;

        const revenueOrders = userSnap.data().revenueOrders || [];
        if (revenueOrders.includes(order.id)) {
            console.log(`[trackRevenue] Order ${order.id} đã được tính, bỏ qua.`);
            return false;
        }

        await updateDoc(userRef, {
            revenueTotal: increment(orderTotal),
            revenueOrders: arrayUnion(order.id),
        });

        // ── Cộng lên advisor cấp 1 nếu có ──────────────────
        const advisorEmail = userSnap.data().advisor;
        if (advisorEmail) {
            const advisorRef = doc(db, 'users', advisorEmail);
            const advisorSnap = await getDoc(advisorRef);
            if (advisorSnap.exists()) {
                const advisorOrders = advisorSnap.data().revenueOrders || [];
                if (!advisorOrders.includes(order.id)) {
                    await updateDoc(advisorRef, {
                        revenueTotal: increment(orderTotal),
                        revenueOrders: arrayUnion(order.id),
                    });
                    console.log(`[trackRevenue] +${orderTotal} cho advisor ${advisorEmail}`);

                    // ── Cộng lên advisor cấp 2 nếu có ──────
                    const advisor2Email = advisorSnap.data().advisor;
                    if (advisor2Email) {
                        const advisor2Ref = doc(db, 'users', advisor2Email);
                        const advisor2Snap = await getDoc(advisor2Ref);
                        if (advisor2Snap.exists()) {
                            const advisor2Orders = advisor2Snap.data().revenueOrders || [];
                            if (!advisor2Orders.includes(order.id)) {
                                await updateDoc(advisor2Ref, {
                                    revenueTotal: increment(orderTotal),
                                    revenueOrders: arrayUnion(order.id),
                                });
                                console.log(`[trackRevenue] +${orderTotal} cho advisor cấp 2 ${advisor2Email}`);
                            }
                        }
                    }
                }
            }
        }

        return true;
    } catch (e) {
        console.error('[trackRevenue] Lỗi:', e.message);
        return false;
    }
}