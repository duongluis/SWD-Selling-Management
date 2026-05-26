import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';

export const getRole = (userDetail) => {
    const r = (userDetail?.role || userDetail?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

const fetchCustomersByRoot = async (rootAdvisor) => {
    const q = query(collection(db, 'customers'), where('rootAdvisor', '==', rootAdvisor));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), docId: d.id }));
};

const fetchCustomersByCreator = async (emails) => {
    const all = [];
    for (let i = 0; i < emails.length; i += 30) {
        const chunk = emails.slice(i, i + 30);
        const q = query(collection(db, 'customers'), where('createdBy', 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    }
    return all;
};

const getTeamEmails = async (myEmail, role) => {
    if (role === 'ctv') return [myEmail];
    if (role === 'phantan') {
        const subSnap = await getDocs(query(collection(db, 'users'), where('advisor', '==', myEmail)));
        const subEmails = subSnap.docs.map(d => d.data().email).filter(Boolean);
        return [myEmail, ...subEmails];
    }
    if (role === 'daily') {
        const l2Snap = await getDocs(query(collection(db, 'users'), where('advisor', '==', myEmail)));
        const l2Emails = l2Snap.docs.map(d => d.data().email).filter(Boolean);
        let l3Emails = [];
        for (const advisor of l2Emails) {
            const l3Snap = await getDocs(query(collection(db, 'users'), where('advisor', '==', advisor)));
            l3Emails.push(...l3Snap.docs.map(d => d.data().email).filter(Boolean));
        }
        return [myEmail, ...l2Emails, ...l3Emails];
    }
    return [];
};

export function useCustomers() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const myEmail = userDetail?.email || '';
    const root = userDetail?.rootAdvisor || myEmail; // Lưu rootAdvisor của chính user (nếu có)

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!myEmail) return;
        setLoading(true);
        try {
            let allCustomers = [];
            if (role === 'admin') {
                const snap = await getDocs(collection(db, 'customers'));
                snap.docs.forEach(d => allCustomers.push({ ...d.data(), docId: d.id }));
            } else if (role === 'daily') {
                // L1: dùng rootAdvisor (chỉ cần 1 query)
                allCustomers = await fetchCustomersByRoot(root);
            } else if (role === 'phantan') {
                // L2: lấy của mình + L3 (vẫn dùng createdBy in)
                const teamEmails = await getTeamEmails(myEmail, role);
                allCustomers = await fetchCustomersByCreator(teamEmails);
            } else {
                // CTV: chỉ của mình
                const q = query(collection(db, 'customers'), where('createdBy', '==', myEmail));
                const snap = await getDocs(q);
                snap.docs.forEach(d => allCustomers.push({ ...d.data(), docId: d.id }));
            }
            const map = new Map();
            allCustomers.forEach(c => map.set(c.docId, c));
            setCustomers([...map.values()]);
        } catch (e) {
            console.error('useCustomers error:', e);
        } finally {
            setLoading(false);
        }
    }, [myEmail, role, root]);

    useEffect(() => { fetch(); }, [fetch]);
    return { customers, loading, refresh: fetch };
}