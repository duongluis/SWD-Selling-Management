// components/Utils/docId.js
// Sinh mã document tịnh tiến (ORD-000123, SV-000123) bằng transaction trên collection
// 'counters'. Thay cho cách cũ `PREFIX + Date.now().toString().slice(-6)` — 6 chữ số cuối
// của timestamp lặp lại sau ~16,7 phút, và setDoc() ghi đè im lặng nên đơn cũ có thể bị mất.

import { db } from '@/config/firebaseConfig';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const PAD = 6;

/**
 * Lấy số kế tiếp của 1 bộ đếm và trả về mã đã format.
 * @param {string} counterKey docId trong collection 'counters' (vd: 'orders', 'service')
 * @param {string} prefix     tiền tố mã (vd: 'ORD', 'SV')
 */
export async function nextDocId(counterKey, prefix) {
    const ref = doc(db, 'counters', counterKey);
    const seq = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? Number(snap.data().value) || 0 : 0;
        const next = current + 1;
        tx.set(ref, { value: next, prefix, updatedAt: serverTimestamp() }, { merge: true });
        return next;
    });
    return `${prefix}-${String(seq).padStart(PAD, '0')}`;
}

export const nextOrderId = () => nextDocId('orders', 'ORD');
export const nextServiceId = () => nextDocId('service', 'SV');
