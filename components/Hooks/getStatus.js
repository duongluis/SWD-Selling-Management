import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../config/firebaseConfig';

// ── Category mapping ──────────────────────────────────────────
export const ORDER_TYPE_TO_CATEGORY = {
    buon: 'don_buon',
    le: 'don_le',
};

export const SERVICE_TYPE_TO_CATEGORY = {
    INSTALLATION: 'lap_dat',
    MAINTENANCE: 'bao_duong',
    DELIVERY: 'giao_hang',
    CONSULTING: 'tu_van',
};

// ── Tự động gán màu theo từ khóa trong tên trạng thái ────────
const resolveColor = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('hủy')) return { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: 'close-circle-outline' };
    if (n.includes('hoàn thành') || n.includes('thành công')) return { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: 'checkmark-circle' };
    if (n.includes('thất bại')) return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'close-circle' };
    if (n.includes('đang')) return { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', icon: 'reload-outline' };
    if (n.includes('đã thanh toán')) return { color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', icon: 'checkmark-done-circle-outline' };
    if (n.includes('chờ thanh toán')) return { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: 'card-outline' };
    if (n.includes('đã giao') || n.includes('đã lắp')) return { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: 'checkmark-circle-outline' };
    if (n.includes('chờ')) return { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: 'time-outline' };
    if (n.includes('nhận thông tin')) return { color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC', icon: 'person-add-outline' };
    return { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', icon: 'ellipse-outline' };
};

// ── In-memory cache — tránh fetch lại cùng 1 category ────────
const _cache = {};

// ── Fetch thuần (dùng ngoài React) ───────────────────────────
export async function fetchStatusList(category) {
    if (!category) return [];
    if (_cache[category]) return _cache[category];
    try {
        const snap = await getDocs(collection(db, 'status', category, 'list'));
        const list = snap.docs
            .map(d => {
                const data = d.data();
                return { ...resolveColor(data.name), ...data, label: data.name };
            })
            .sort((a, b) => (a.id || 0) - (b.id || 0));
        _cache[category] = list;
        return list;
    } catch (e) {
        console.error('fetchStatusList error:', e);
        return [];
    }
}

// ── React hook ────────────────────────────────────────────────
export function useStatusList(category) {
    const [statusList, setStatusList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!category) { setLoading(false); return; }
        setLoading(true);
        fetchStatusList(category).then(list => {
            setStatusList(list);
            setLoading(false);
        });
    }, [category]);

    return { statusList, loading };
}

// ── Hook lấy nhiều category cùng lúc (dùng ở service list) ───
export function useMultiStatusList(categories = []) {
    const [statusMap, setStatusMap] = useState({}); // { category: list[] }
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!categories.length) { setLoading(false); return; }
        const unique = [...new Set(categories)];
        Promise.all(unique.map(async cat => [cat, await fetchStatusList(cat)]))
            .then(entries => {
                setStatusMap(Object.fromEntries(entries));
                setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories.join(',')]);

    return { statusMap, loading };
}

// ── Tìm config của 1 status theo tên trong list ───────────────
export function getStatusConfig(name, statusList = []) {
    if (!name) return { ...resolveColor(''), label: '—' };
    const found = statusList.find(s => s.name === name);
    if (found) return found;
    // fallback: tự resolve màu từ tên nếu không tìm thấy trong list
    return { ...resolveColor(name), label: name, changeable: true };
}