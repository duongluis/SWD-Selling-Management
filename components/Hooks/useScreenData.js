import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { useFocusEffect } from 'expo-router';
import {
    collection,
    getDocs,
    onSnapshot,
    query, where
} from 'firebase/firestore';
import { useCallback, useContext, useEffect, useState } from 'react';
import { getRole } from '../Utils/roleHelper';

// ── Hàm tính rootAdvisor ──────────────────────────────────────
const getRootAdvisorForUser = async (userEmail) => {
    let root = userEmail;
    let currentEmail = userEmail;
    let safety = 0;
    while (safety < 10) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', currentEmail)));
        if (userSnap.empty) break;
        const user = userSnap.docs[0].data();
        if (!user.advisor) break;
        root = user.advisor;
        currentEmail = user.advisor;
        safety++;
    }
    return root;
};

// ── Lấy danh sách email team ──────────────────────────────────
const getTeamEmails = async (myEmail, role) => {
    if (role === 'ctv') return [myEmail];
    if (role === 'giamdoc') return [];
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

// ── fetchStatic* — fallback khi teamEmails > 30 ───────────────
// Dùng batch getDocs thay vì onSnapshot vì không thể onSnapshot nhiều 'in' queries
const fetchStaticByEmails = async (collectionName, emails) => {
    const all = [];
    for (let i = 0; i < emails.length; i += 10) {
        const chunk = emails.slice(i, i + 10); // Firestore 'in' tối đa 10
        const snap = await getDocs(
            query(collection(db, collectionName), where('createdBy', 'in', chunk))
        );
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    }
    return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

// ── fetch functions cho các loại không dùng realtime ─────────
async function fetchServices(myEmail, role) {
    if (role === 'admin' || role === 'giamdoc') {
        const snap = await getDocs(collection(db, 'service'));
        return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const teamEmails = await getTeamEmails(myEmail, role);
    if (teamEmails.length === 0) return [];
    return fetchStaticByEmails('service', teamEmails);
}

async function fetchUsers(myEmail, role) {
    if (role !== 'admin' && role !== 'giamdoc') return [];
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
        .map(d => ({ ...d.data(), docId: d.id }))
        .filter(u => u.email !== myEmail)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchConsults(myEmail, role) {
    if (role === 'admin' || role === 'giamdoc') {
        const snap = await getDocs(query(collection(db, 'consult')));
        return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const teamEmails = await getTeamEmails(myEmail, role);
    if (teamEmails.length === 0) return [];
    return fetchStaticByEmails('consult', teamEmails);
}


function computeStats(type, data) {
    switch (type) {
        case 'orders': {
            const active = data.filter(o => o.status !== 'Đã hủy');
            const cancelled = data.filter(o => o.status === 'Đã hủy');
            const revenue = data.filter(o => o.status === 'Đã thanh toán')
                .reduce((s, o) => s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
            return { total: data.length, active: active.length, cancelled: cancelled.length, revenue };
        }
        case 'customers':
            return { total: data.length };
        case 'services': {
            const done = data.filter(s => (s.status || '').includes('hoàn') || (s.status || '').includes('xong'));
            const pending = data.filter(s => !(s.status || '').includes('hoàn'));
            return { total: data.length, done: done.length, pending: pending.length };
        }
        case 'users': {
            const verified = data.filter(u => u.verified);
            const unverified = data.filter(u => !u.verified);
            return { total: data.length, verified: verified.length, unverified: unverified.length };
        }
        case 'consults': {
            const success = data.filter(c => c.status === 'success');
            const failed = data.filter(c => c.status === 'failed');
            return { total: data.length, success: success.length, failed: failed.length };
        }
        default:
            return { total: data.length };
    }
}

// ── Hook chính ────────────────────────────────────────────────
export function useScreenData(type) {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const myEmail = userDetail?.email || '';
    const rootAdvisor = userDetail?.rootAdvisor || myEmail;

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({});
    const [error, setError] = useState(null);

    // ── Helpers nội bộ để setData từ fetchStatic* ────────────
    const applyStaticData = useCallback((list) => {
        const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setData(sorted);
        setStats(computeStats(type, sorted));
        setLoading(false);
        setRefreshing(false);
    }, [type]);

    // ── Helper: lấy customerIds do team tạo ──────────────────────
    const getCustomerIdsByTeam = async (teamEmails) => {
        const allIds = [];
        for (let i = 0; i < teamEmails.length; i += 10) {
            const chunk = teamEmails.slice(i, i + 10);
            const snap = await getDocs(
                query(collection(db, 'customers'), where('createdBy', 'in', chunk))
            );
            snap.docs.forEach(d => {
                const id = d.data().id; // field 'id' trong document customers
                if (id) allIds.push(id);
            });
        }
        return [...new Set(allIds)]; // dedup
    };

    // ── Helper: fetch orders theo customerIds ─────────────────────
    const fetchOrdersByCustomerIds = async (customerIds) => {
        const all = [];
        for (let i = 0; i < customerIds.length; i += 10) {
            const chunk = customerIds.slice(i, i + 10);
            const snap = await getDocs(
                query(collection(db, 'orders'), where('customerId', 'in', chunk))
            );
            snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        }
        return all;
    };

    const fetchStaticOrders = useCallback(async (teamEmails) => {
        try {
            const list = await fetchStaticByEmails('orders', teamEmails);
            applyStaticData(list);
        } catch (e) {
            setError(e.message);
            setLoading(false);
        }
    }, [applyStaticData]);

    const fetchStaticCustomers = useCallback(async (teamEmails) => {
        try {
            const list = await fetchStaticByEmails('customers', teamEmails);
            applyStaticData(list);
        } catch (e) {
            setError(e.message);
            setLoading(false);
        }
    }, [applyStaticData]);

    const fetchStaticServices = useCallback(async (teamEmails) => {
        try {
            const list = await fetchStaticByEmails('service', teamEmails);
            applyStaticData(list);
        } catch (e) {
            setError(e.message);
            setLoading(false);
        }
    }, [applyStaticData]);

    // ── Realtime listener ─────────────────────────────────────
    useEffect(() => {
        if (!myEmail) return;

        let unsub = null;

        const init = async () => {
            setLoading(true);
            try {
                let q = null;

                if (type === 'orders') {
                    if (role === 'admin' || role === 'giamdoc') {
                        q = collection(db, 'orders');
                    } else if (rootAdvisor && rootAdvisor !== myEmail) {
                        // L2/L3: lấy theo rootAdvisor
                        q = query(collection(db, 'orders'), where('rootAdvisor', '==', rootAdvisor));
                    } else {
                        // L1 (daily/phantan): lấy theo team
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }

                        // Bước 1: lấy orders do team tạo (createdBy)
                        const ordersByCreator = await fetchStaticByEmails('orders', teamEmails);

                        // Bước 2: lấy customerIds do team tạo → lấy orders của khách đó
                        const customerIds = await getCustomerIdsByTeam(teamEmails);
                        const ordersByCustomer = customerIds.length > 0
                            ? await fetchOrdersByCustomerIds(customerIds)
                            : [];

                        // Bước 3: gộp + dedup theo id
                        const merged = [...ordersByCreator];
                        const existingIds = new Set(ordersByCreator.map(o => o.id));
                        ordersByCustomer.forEach(o => {
                            if (!existingIds.has(o.id)) merged.push(o);
                        });

                        // Dùng static (không realtime) vì đã fetch thủ công
                        applyStaticData(merged);
                        return;
                    }
                }

                else if (type === 'customers') {
                    if (role === 'admin' || role === 'giamdoc') {
                        q = collection(db, 'customers');
                    } else if (rootAdvisor && rootAdvisor !== myEmail) {
                        q = query(collection(db, 'customers'), where('rootAdvisor', '==', rootAdvisor));
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        if (teamEmails.length > 10) {
                            await fetchStaticCustomers(teamEmails);
                            return;
                        }
                        q = query(collection(db, 'customers'), where('createdBy', 'in', teamEmails));
                    }
                }

                else if (type === 'services') {
                    if (role === 'admin' || role === 'giamdoc') {
                        q = collection(db, 'service');
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        if (teamEmails.length > 10) {
                            await fetchStaticServices(teamEmails);
                            return;
                        }
                        q = query(collection(db, 'service'), where('createdBy', 'in', teamEmails));
                    }
                }

                else if (type === 'users') {
                    if (role !== 'admin' && role !== 'giamdoc') { setData([]); setLoading(false); return; }
                    q = collection(db, 'users');
                }

                else if (type === 'consults') {
                    if (role === 'admin' || role === 'giamdoc') {
                        q = collection(db, 'consult');
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        q = query(collection(db, 'consult'), where('createdBy', 'in', teamEmails));
                    }
                }

                if (q) {
                    unsub = onSnapshot(q, (snap) => {
                        let list = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
                        if (type === 'users') list = list.filter(u => u.email !== myEmail);
                        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                        setData(list);
                        setStats(computeStats(type, list));
                        setLoading(false);
                    }, (err) => {
                        setError(err.message);
                        setLoading(false);
                    });
                }
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        init();
        return () => { if (unsub) unsub(); };
    }, [type, myEmail, role, rootAdvisor]);

    // ── fetchCustomers nội bộ ─────────────────────────────────
    const fetchCustomers = useCallback(async () => {
        if (role === 'admin' || role === 'giamdoc') {
            const snap = await getDocs(collection(db, 'customers'));
            return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
        if (rootAdvisor && rootAdvisor !== myEmail) {
            const q = query(collection(db, 'customers'), where('rootAdvisor', '==', rootAdvisor));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
        const teamEmails = await getTeamEmails(myEmail, role);
        if (teamEmails.length === 0) return [];
        return fetchStaticByEmails('customers', teamEmails);
    }, [myEmail, role, rootAdvisor]);

    // ── load cho các type không dùng realtime ─────────────────
    const load = useCallback(async (isRefresh = false) => {
        if (type === 'orders') return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            let result;
            if (type === 'customers') result = await fetchCustomers();
            else if (type === 'services') result = await fetchServices(myEmail, role);
            else if (type === 'users') result = await fetchUsers(myEmail, role);
            else if (type === 'consults') result = await fetchConsults(myEmail, role);
            else return;
            setData(result);
            setStats(computeStats(type, result));
        } catch (e) {
            console.error(`useScreenData(${type}):`, e);
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [type, fetchCustomers, myEmail, role]);

    useFocusEffect(useCallback(() => {
        if (type !== 'orders') load();
    }, [load, type]));

    const refresh = useCallback(() => {
        if (type === 'orders') {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 500);
        } else {
            load(true);
        }
    }, [load, type]);

    return { data, loading, refreshing, refresh, stats, error, role, myEmail, userDetail };
}