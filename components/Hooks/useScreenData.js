import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { useFocusEffect } from 'expo-router';
import {
    collection, doc, getDoc, getDocs, query, where,
} from 'firebase/firestore';
import { useCallback, useContext, useState } from 'react';
import { getRole } from '../Utils/roleHelper';

// ── Fetchers theo từng loại màn ──────────────────────────────

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

async function fetchOrders(myEmail, role) {
    // Lấy phones từ customers → fetch orders
    let phones = [];
    if (role === 'admin') {
        const snap = await getDocs(collection(db, 'customers'));
        phones = snap.docs.map(d => d.data().phone).filter(Boolean);
    } else if (role === 'ctv') {
        // CTV: lấy từ customers + phones từ consults đã tư vấn thành công
        const [custSnap, consultSnap] = await Promise.all([
            getDocs(query(collection(db, 'customers'), where('createdBy', '==', myEmail))),
            getDocs(query(collection(db, 'consult'), where('createdBy', '==', myEmail))),
        ]);
        const custPhones = custSnap.docs.map(d => d.data().phone).filter(Boolean);
        const consultPhones = consultSnap.docs.map(d => d.data().phone).filter(Boolean);
        phones = [...new Set([...custPhones, ...consultPhones])];
    } else {
        const snap = await getDocs(
            query(collection(db, 'customers'), where('createdBy', '==', myEmail))
        );
        phones = snap.docs.map(d => d.data().phone).filter(Boolean);
    }
    // docId của customer === phone (setDoc dùng phone làm key)
    const myCustomerIds = new Set(phones);

    const allOrders = [];
    await Promise.all(phones.slice(0, 100).map(async (phone) => {
        try {
            const snap = await getDoc(doc(db, 'orders', phone));
            if (!snap.exists()) return;
            (snap.data().orders || []).forEach(o => {
                // Admin: lấy tất cả
                // Còn lại: chỉ lấy đơn không có customerId (đơn cũ) hoặc customerId khớp với khách của mình
                if (role === 'admin' || !o.customerId || myCustomerIds.has(o.customerId)) {
                    allOrders.push({ ...o, customerPhone: phone });
                }
            });
        } catch (_) { }
    }));
    return allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchServices(myEmail, role) {
    const all = [];
    if (role === 'admin') {
        const snap = await getDocs(collection(db, 'service'));
        snap.docs.forEach(d => all.push({ ...d.data(), docId: d.id }));
    } else if (role === 'ctv') {
        // CTV lấy từ consult → phones → service
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

// ── Thống kê nhanh theo loại ─────────────────────────────────
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

// ── Main hook ─────────────────────────────────────────────────
const FETCHERS = {
    orders: fetchOrders,
    customers: fetchCustomers,
    services: fetchServices,
    users: fetchUsers,
    consults: fetchConsults,
};

export function useScreenData(type) {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const myEmail = userDetail?.email || '';

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({});
    const [error, setError] = useState(null);

    const fetcher = FETCHERS[type];

    const load = useCallback(async (isRefresh = false) => {
        if (!myEmail || !fetcher) return;
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
    }, [myEmail, role, type]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const refresh = useCallback(() => load(true), [load]);

    return { data, loading, refreshing, refresh, stats, error, role, myEmail };
}