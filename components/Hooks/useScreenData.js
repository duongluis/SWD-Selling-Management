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

// ── Các fetcher không đổi (customers, services, users, consults) ──
async function fetchCustomers(myEmail, role) {
    const all = [];
    if (role === 'admin') {
        const snap = await getDocs(collection(db, 'customers'));
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    } else {
        const snap = await getDocs(
            query(collection(db, 'customers'), where('createdBy', '==', myEmail))
        );
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    }
    return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchServices(myEmail, role) {
    const all = [];
    if (role === 'admin') {
        const snap = await getDocs(collection(db, 'service'));
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    } else if (role === 'ctv') {
        const consultSnap = await getDocs(
            query(collection(db, 'consult'),
                where('createdBy', '==', myEmail),
                where('status', '==', 'success'))
        );
        const phones = consultSnap.docs.map(d => d.data().phone).filter(Boolean);
        if (phones.length > 0) {
            const svcSnap = await getDocs(collection(db, 'service'));
            svcSnap.docs.forEach(d => {
                const data = d.data();
                if (phones.includes(data.phone)) all.push({ ...data, docId: d.id });
            });
        }
    } else {
        const snap = await getDocs(
            query(collection(db, 'service'), where('createdBy', '==', myEmail))
        );
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    }
    return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
    const q = role === 'admin'
        ? query(collection(db, 'consult'))
        : query(collection(db, 'consult'), where('createdBy', '==', myEmail));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ ...d.data(), docId: d.id }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// ── Thống kê ── (giữ nguyên)
function computeStats(type, data) {
    switch (type) {
        case 'orders': {
            const active = data.filter(o => o.status !== 'Đã hủy');
            const cancelled = data.filter(o => o.status === 'Đã hủy');
            const revenue = data.filter(o => o.status === 'Đã thanh toán').reduce((s, o) =>
                s + (o.items || []).reduce((ss, p) => ss + (p.price * p.qty || 0), 0), 0);
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

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({});
    const [error, setError] = useState(null);

    // ── XỬ LÝ REAL-TIME CHO ĐƠN HÀNG (orders) ──
    useEffect(() => {
        if (type !== 'orders') return;
        if (!myEmail) return;

        setLoading(true);
        let q;
        if (role === 'admin') {
            q = collection(db, 'orders');
        } else {
            q = query(collection(db, 'orders'), where('createdBy', '==', myEmail));
        }

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const orders = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
                // Sắp xếp theo ngày tạo mới nhất
                orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                setData(orders);
                setStats(computeStats('orders', orders));
                setLoading(false);
                setRefreshing(false);
                setError(null);
            },
            (err) => {
                console.error('onSnapshot orders error:', err);
                setError(err.message);
                setLoading(false);
                setRefreshing(false);
            }
        );

        return () => unsubscribe();
    }, [type, myEmail, role]);

    // ── CÁC LOẠI KHÁC DÙNG getDocs + useFocusEffect ──
    const fetcher = {
        customers: fetchCustomers,
        services: fetchServices,
        users: fetchUsers,
        consults: fetchConsults,
    }[type];

    const load = useCallback(async (isRefresh = false) => {
        if (!fetcher || type === 'orders') return; // orders đã được xử lý riêng
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const result = await fetcher(myEmail, role);
            setData(result);
            setStats(computeStats(type, result));
        } catch (e) {
            console.error(`useScreenData(${type}):`, e);
            setError(e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetcher, myEmail, role, type]);

    useFocusEffect(useCallback(() => {
        if (type !== 'orders') load();
    }, [load, type]));

    const refresh = useCallback(() => {
        if (type === 'orders') {
            // orders realtime: chỉ cần trigger re-fetch không cần, onSnapshot tự cập nhật
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 500);
        } else {
            load(true);
        }
    }, [load, type]);

    return { data, loading, refreshing, refresh, stats, error, role, myEmail };
}