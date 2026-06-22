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

// ── Hàm tính rootAdvisor (dùng cho các user chưa có trường này) ──
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

// ── Lấy danh sách email team (cho L2/L3) khi chưa có rootAdvisor ──
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

async function fetchServices(myEmail, role) {
    if (role === 'admin') {
        const snap = await getDocs(collection(db, 'service'));
        return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const teamEmails = await getTeamEmails(myEmail, role);
    if (teamEmails.length === 0) return [];
    const allServices = [];
    for (let i = 0; i < teamEmails.length; i += 30) {
        const chunk = teamEmails.slice(i, i + 30);
        const q = query(collection(db, 'service'), where('createdBy', 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(d => allServices.push({ ...d.data(), docId: d.id }));
    }
    return allServices.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchUsers(myEmail, role) {
    if (role !== 'admin') return [];
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
        .map(d => ({ ...d.data(), docId: d.id }))
        .filter(u => u.email !== myEmail)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchConsults(myEmail, role) {
    if (role === 'admin') {
        const snap = await getDocs(query(collection(db, 'consult')));
        return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const teamEmails = await getTeamEmails(myEmail, role);
    if (teamEmails.length === 0) return [];
    const all = [];
    for (let i = 0; i < teamEmails.length; i += 30) {
        const chunk = teamEmails.slice(i, i + 30);
        const snap = await getDocs(query(collection(db, 'consult'), where('createdBy', 'in', chunk)));
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    }
    return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

// ── Hook chính ──
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

    // ── ORDERS realtime ──
    useEffect(() => {
        if (!myEmail) return;

        let unsub = null;

        const init = async () => {
            setLoading(true);
            try {
                let q = null;

                // 1. Phân loại cấu trúc truy vấn Real-time theo "type"
                if (type === 'orders') {
                    if (role === 'admin') {
                        q = collection(db, 'orders');
                    } else if (rootAdvisor && rootAdvisor !== myEmail) {
                        q = query(collection(db, 'orders'), where('rootAdvisor', '==', rootAdvisor));
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        if (teamEmails.length > 30) {
                            // Giữ nguyên logic fallback tải tĩnh nếu danh sách email quá lớn (>30)
                            fetchStaticOrders(teamEmails);
                            return;
                        }
                        q = query(collection(db, 'orders'), where('createdBy', 'in', teamEmails));
                    }
                }

                else if (type === 'customers') {
                    if (role === 'admin') {
                        q = collection(db, 'customers');
                    } else if (rootAdvisor && rootAdvisor !== myEmail) {
                        q = query(collection(db, 'customers'), where('rootAdvisor', '==', rootAdvisor));
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        if (teamEmails.length > 30) {
                            fetchStaticCustomers(teamEmails);
                            return;
                        }
                        q = query(collection(db, 'customers'), where('createdBy', 'in', teamEmails));
                    }
                }

                else if (type === 'services') {
                    if (role === 'admin') {
                        q = collection(db, 'service');
                    } else {
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        if (teamEmails.length > 30) {
                            fetchStaticServices(teamEmails);
                            return;
                        }
                        q = query(collection(db, 'service'), where('createdBy', 'in', teamEmails));
                    }
                }

                else if (type === 'users') {
                    if (role !== 'admin') { setData([]); setLoading(false); return; }
                    q = collection(db, 'users');
                }

                else if (type === 'consults') {
                    if (role === 'admin') {
                        q = collection(db, 'consult');
                    } else {
                        // Lấy team emails (bao gồm cả người mình là advisor)
                        const teamEmails = await getTeamEmails(myEmail, role);
                        if (teamEmails.length === 0) { setData([]); setLoading(false); return; }
                        q = query(collection(db, 'consult'), where('createdBy', 'in', teamEmails));
                    }
                }

                // 2. Thiết lập lắng nghe Real-time nếu truy vấn hợp lệ
                if (q) {
                    unsub = onSnapshot(q, (snap) => {
                        let list = snap.docs.map(d => ({ ...d.data(), docId: d.id }));

                        if (type === 'users') {
                            list = list.filter(u => u.email !== myEmail);
                        }

                        // Sắp xếp dữ liệu mới nhất lên đầu
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

        // Tự động hủy lắng nghe khi unmount để tránh rò rỉ bộ nhớ
        return () => { if (unsub) unsub(); };
    }, [type, myEmail, role, rootAdvisor]);

    // ── fetchCustomers (nội bộ, có quyền truy cập rootAdvisor) ──
    const fetchCustomers = useCallback(async () => {
        if (role === 'admin') {
            const snap = await getDocs(collection(db, 'customers'));
            return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
        // Nếu có rootAdvisor khác email hiện tại (L1 hoặc người có cấp trên)
        if (rootAdvisor && rootAdvisor !== myEmail) {
            const q = query(collection(db, 'customers'), where('rootAdvisor', '==', rootAdvisor));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
        // Fallback: dùng teamEmails (L2, L3 hoặc user chưa có rootAdvisor)
        const teamEmails = await getTeamEmails(myEmail, role);
        if (teamEmails.length === 0) return [];
        const all = [];
        for (let i = 0; i < teamEmails.length; i += 30) {
            const chunk = teamEmails.slice(i, i + 30);
            const q = query(collection(db, 'customers'), where('createdBy', 'in', chunk));
            const snap = await getDocs(q);
            snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
        }
        return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }, [myEmail, role, rootAdvisor]);

    // ── Hàm load dữ liệu cho các loại không phải orders ──
    const load = useCallback(async (isRefresh = false) => {
        if (type === 'orders') return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            let result;
            if (type === 'customers') {
                result = await fetchCustomers();
            } else if (type === 'services') {
                result = await fetchServices(myEmail, role);
            } else if (type === 'users') {
                result = await fetchUsers(myEmail, role);
            } else if (type === 'consults') {
                result = await fetchConsults(myEmail, role);
            } else {
                return;
            }
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