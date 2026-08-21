import { arrayRemove, arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { productTotal } from './orderItems';

const PAID_STATUS = 'Đã thanh toán';

/**
 * Gọi khi admin đổi trạng thái đơn hàng sang "Đã thanh toán".
 */
export async function trackRevenueOnPaid(userEmail, order, newStatus) {
    if (newStatus !== PAID_STATUS) return false;
    if (!userEmail || !order?.id) return false;

    // Doanh thu ghi nhận chỉ tính giá sản phẩm, không cộng tiền dịch vụ.
    const orderTotal = productTotal(order);
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

/**
 * Nghịch đảo của trackRevenueOnPaid — gọi khi xoá đơn hàng.
 *
 * Chỉ trừ ở những user thực sự có mã đơn trong revenueOrders, nên gọi lại nhiều lần
 * cũng không trừ thừa, và đơn chưa từng thanh toán thì không ảnh hưởng gì.
 * Leo đúng 2 cấp advisor giống lúc cộng.
 */
export async function revertRevenueOnDelete(userEmail, order) {
    if (!userEmail || !order?.id) return false;

    const orderTotal = productTotal(order);
    if (orderTotal <= 0) return false;

    // Trừ ở 1 user nếu mã đơn còn nằm trong revenueOrders. Trả về email advisor cấp trên
    // để đi tiếp, hoặc null nếu dừng.
    const revertOne = async (email) => {
        if (!email) return null;
        const ref = doc(db, 'users', email);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;

        const data = snap.data();
        if ((data.revenueOrders || []).includes(order.id)) {
            await updateDoc(ref, {
                revenueTotal: increment(-orderTotal),
                revenueOrders: arrayRemove(order.id),
            });
        }
        return data.advisor || null;
    };

    try {
        const advisor1 = await revertOne(userEmail);
        const advisor2 = await revertOne(advisor1);
        await revertOne(advisor2);
        return true;
    } catch (e) {
        console.error('[trackRevenue] Hoàn doanh thu lỗi:', e.message);
        return false;
    }
}