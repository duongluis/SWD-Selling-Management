export const fmtCurrency = (n) =>
    (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

export const fmtNumber = (n) =>
    Math.round(n || 0).toLocaleString('vi-VN');

export const fmtDate = (str) => {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
    } catch { return str; }
};

export const fmtPhone = (p) => {
    if (!p) return '—';
    const d = p.replace(/\D/g, '');
    if (d.length === 10) return d.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    return p;
};

/**
 * Chuẩn hoá số điện thoại: bỏ mọi thứ không phải chữ số (dấu cách, dấu chấm,
 * dấu gạch, dấu ngoặc, chữ...).
 *
 * Dùng ở HAI nơi và phải giống hệt nhau:
 *   1. onChangeText của ô nhập SĐT → người dùng không gõ được ký tự lạ.
 *   2. Ngay trước khi ghi Firestore → dữ liệu cũ/dán từ ngoài vào cũng sạch.
 *
 * Quan trọng vì `phone` là khoá nối giữa customers ↔ orders ↔ service ↔ consult
 * (vd computeOrderCommission dò consult theo SĐT). Chỉ cần một bên lưu
 * "0901 234 567" còn bên kia "0901234567" là mọi phép so khớp trượt hết.
 */
export const normalizePhone = (p) => String(p ?? '').replace(/\D/g, '');

/** SĐT Việt Nam: 10 số (đầu 0) hoặc 11 số (dạng 84...) */
export const isValidPhone = (p) => {
    const d = normalizePhone(p);
    return d.length >= 9 && d.length <= 11;
};

export const fmtShort = (n) => {
    if (!n) return '0';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
};

export const getInitials = (name) => {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const timeAgo = (str) => {
    if (!str) return '';
    const diff = Date.now() - new Date(str).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.floor(hr / 24);
    return day < 7 ? `${day} ngày trước` : fmtDate(str);
};