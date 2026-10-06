export const getRole = (userDetail) => {
    const r = (userDetail?.role || userDetail?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['nhân viên bán hàng', 'sale'].includes(r)) return 'sale';
    if (['giám đốc', 'giam doc', 'giamdoc', 'director'].includes(r)) return 'giamdoc';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

/** Tên hiển thị */
export const getRoleLabel = (role) => ({
    sale: 'Nhân viên bán hàng',
    admin: 'Quản trị viên',
    daily: 'Đại lý',
    phantan: 'Đối tác',
    ctv: 'Cộng tác viên',
    giamdoc: 'Giám đốc',
    other: 'Người dùng',
}[role] || 'Người dùng');

/** Quyền hạn */
export const canAdd = (role) => ['admin', 'daily', 'phantan', 'sale'].includes(role);
export const canAddCTV = (role) => ['phantan', 'ctv', 'sale'].includes(role);
export const canEdit = (role) => ['admin', 'daily', 'phantan', 'sale'].includes(role);
export const canEditConsult = (role) => ['admin', 'daily'].includes(role);
export const canDelete = (role) => role === 'admin';
export const isAdmin = (role) => role === 'admin';
export const isAdminOrGD = (role) => role === 'admin' || role === 'giamdoc';
export const isCTV = (role) => role === 'ctv';
export const isGD = (role) => role === 'giamdoc';

/** Field giá theo role */
export const getPriceField = (role) =>
    ({ daily: 'price_a', phantan: 'price_p', ctv: 'price_c', sale: 'price_s' }[role] || 'price');

/** VAT (%) — bảng giá sản phẩm đã gồm sẵn VAT mặc định */
export const DEFAULT_VAT_RATE = 8;

/** VAT (%) áp cho 1 tài khoản; tài khoản chưa có trường vatRate → mặc định có VAT */
export const getVatRate = (userDetail) => {
    const v = userDetail?.vatRate;
    if (v == null || v === '' || isNaN(Number(v))) return DEFAULT_VAT_RATE;
    return Number(v);
};

/** Quy đổi số tiền đã gồm VAT mặc định sang mức VAT của tài khoản (0 = bỏ VAT) */
export const applyVatRate = (amount, vatRate = DEFAULT_VAT_RATE) => {
    if (vatRate === DEFAULT_VAT_RATE) return amount;
    return Math.round(amount / (1 + DEFAULT_VAT_RATE / 100) * (1 + vatRate / 100));
};

/** Type đơn hàng mặc định theo role */
export const getDefaultOrderType = (role) =>
    ({ daily: 'buon', phantan: 'le', ctv: 'le', sale: 'le' }[role] || null);