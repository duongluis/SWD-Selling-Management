import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';

// ── Role helper ───────────────────────────────────────────────
export const getRole = (userDetail) => {
    const r = (userDetail?.role || userDetail?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['nhà phân phối', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

/**
 * Lấy danh sách khách hàng theo role:
 *   admin       → tất cả db/customers
 *   ctv         → createdBy == myEmail
 *   daily/phantan → createdBy == myEmail + createdBy in subUsers(advisor==myEmail)
 *
 * @returns { customers: Customer[], loading: boolean, refresh: () => void }
 */
export function useCustomers() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!userDetail?.email) return;
        const myEmail = userDetail.email;
        const all = [];

        try {
            if (role === 'admin') {
                const snap = await getDocs(collection(db, 'customers'));
                snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));

            } else if (role === 'ctv') {
                const snap = await getDocs(
                    query(collection(db, 'customers'), where('createdBy', '==', myEmail))
                );
                snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));

            } else if (role === 'daily' || role === 'phantan') {
                // Của mình
                const selfSnap = await getDocs(
                    query(collection(db, 'customers'), where('createdBy', '==', myEmail))
                );
                selfSnap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));

                // Tài khoản con (advisor == myEmail)
                const subSnap = await getDocs(
                    query(collection(db, 'users'), where('advisor', '==', myEmail))
                );
                const subEmails = subSnap.docs.map(d => d.data().email).filter(Boolean);

                for (let i = 0; i < subEmails.length; i += 30) {
                    const chunk = subEmails.slice(i, i + 30);
                    const snap = await getDocs(
                        query(collection(db, 'customers'), where('createdBy', 'in', chunk))
                    );
                    snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
                }
            }

            // Loại trùng theo docId
            const map = new Map();
            all.forEach(c => map.set(c.docId, c));
            setCustomers([...map.values()]);
        } catch (e) {
            console.error('useCustomers error:', e);
        } finally {
            setLoading(false);
        }
    }, [userDetail?.email, role]);

    useEffect(() => { fetch(); }, [fetch]);

    return { customers, loading, refresh: fetch };
}