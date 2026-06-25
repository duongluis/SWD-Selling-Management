export const getRole = (userDetail) => {
    const r = (userDetail?.role || userDetail?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['giám đốc', 'giam doc', 'giamdoc', 'director'].includes(r)) return 'giamdoc';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

/** Tên hiển thị */
export const getRoleLabel = (role) => ({
    admin: 'Quản trị viên',
    daily: 'Đại lý',
    phantan: 'Đối tác',
    ctv: 'Cộng tác viên',
    giamdoc: 'Giám đốc',
    other: 'Người dùng',
}[role] || 'Người dùng');

/** Quyền hạn */
export const canAdd = (role) => ['admin', 'daily', 'phantan', 'ctv'].includes(role);
export const canAddCTV = (role) => ['phantan', 'ctv'].includes(role);
export const canEdit = (role) => ['admin', 'daily', 'phantan'].includes(role);
export const canEditConsult = (role) => ['admin', 'daily'].includes(role);
export const canDelete = (role) => role === 'admin';
export const isAdmin = (role) => role === 'admin';
export const isCTV = (role) => role === 'ctv';
export const isGD = (role) => role === 'giamdoc';

/** Field giá theo role */
export const getPriceField = (role) =>
    ({ daily: 'price_a', phantan: 'price_p', ctv: 'price_c' }[role] || 'price');

/** Type đơn hàng mặc định theo role */
export const getDefaultOrderType = (role) =>
    ({ daily: 'buon', phantan: 'le', ctv: 'le' }[role] || null);