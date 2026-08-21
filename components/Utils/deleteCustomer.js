// components/Utils/deleteCustomer.js
// Xoá khách hàng — dùng chung cho panel desktop (components/UI/CustomerDetail.jsx)
// và màn mobile (app/CustomerView/[customerID]/index.jsx) để hai nơi không lệch luật.

import { db } from '@/config/firebaseConfig';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';

/**
 * Đếm số đơn hàng đang trỏ tới khách hàng này.
 * Đơn mới liên kết bằng customerId (docId), đơn cũ chỉ có phone → phải tra cả hai
 * rồi khử trùng, nếu không sẽ xoá nhầm khách vẫn còn đơn.
 */
export async function countLinkedOrders(customer) {
    const ids = new Set();

    if (customer?.docId) {
        const snap = await getDocs(
            query(collection(db, 'orders'), where('customerId', '==', customer.docId))
        );
        snap.docs.forEach(d => ids.add(d.id));
    }

    if (customer?.phone) {
        const snap = await getDocs(
            query(collection(db, 'orders'), where('phone', '==', customer.phone))
        );
        snap.docs.forEach(d => ids.add(d.id));
    }

    return ids.size;
}

/**
 * Xoá document khách hàng. Gọi countLinkedOrders trước và chặn nếu còn đơn —
 * xoá khách khi đơn vẫn còn sẽ để lại đơn trỏ vào customerId không tồn tại,
 * kéo theo hoa hồng và báo cáo mất chỗ đối chiếu.
 *
 * @returns {Promise<{ok: boolean, linkedOrders: number}>}
 */
export async function deleteCustomerGuarded(customer) {
    if (!customer?.docId) throw new Error('Thiếu mã khách hàng');

    const linkedOrders = await countLinkedOrders(customer);
    if (linkedOrders > 0) return { ok: false, linkedOrders };

    await deleteDoc(doc(db, 'customers', customer.docId));
    return { ok: true, linkedOrders: 0 };
}
