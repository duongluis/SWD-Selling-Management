import { db } from '@/config/firebaseConfig';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';

/**
 * Backfill customerId vào các đơn hàng chưa có trường này.
 * Mapping: orders/{phone}.orders[].customerId = docId của customer có phone tương ứng.
 * Chỉ gọi bởi admin, một lần.
 */
export async function migrateOrderCustomerId(onProgress) {
    const custSnap = await getDocs(collection(db, 'customers'));

    // phone → docId
    const phoneToDocId = {};
    custSnap.docs.forEach(d => {
        const phone = d.data().phone;
        if (phone) phoneToDocId[phone] = d.id;
    });

    const phones = Object.keys(phoneToDocId);
    let updated = 0, skipped = 0, errors = 0;

    await Promise.all(phones.map(async (phone) => {
        try {
            const ref = doc(db, 'orders', phone);
            const snap = await getDoc(ref);
            if (!snap.exists()) { skipped++; return; }

            const orders = snap.data().orders || [];
            const customerId = phoneToDocId[phone];
            const needsUpdate = orders.some(o => !o.customerId);

            if (!needsUpdate) { skipped++; return; }

            const patched = orders.map(o => o.customerId ? o : { ...o, customerId });
            await updateDoc(ref, { orders: patched });
            updated++;
            onProgress?.({ updated, skipped, errors, total: phones.length });
        } catch (_) {
            errors++;
        }
    }));

    return { updated, skipped, errors, total: phones.length };
}
