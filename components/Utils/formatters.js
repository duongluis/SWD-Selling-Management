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

// Chỉ ngày, không kèm giờ (dd/mm/yyyy)
export const fmtDateOnly = (str) => {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit', month: '2-digit', year: 'numeric',
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

/**
 * Rút gọn tên dài hơn `max` ký tự: 2 từ đầu + chữ cái đầu các từ ở giữa + 2 từ cuối.
 * Vd "Công ty Trách nhiệm hữu hạn Thương mại Dịch vụ An Phát" → "Công ty TNHHTMDV An Phát".
 * Tên từ 4 từ trở xuống không có từ ở giữa nên giữ nguyên.
 * Từ ở giữa vốn đã là chữ viết tắt (vd TNHH, MTV) được giữ nguyên chứ
 * không rút tiếp còn 1 chữ: "Công ty TNHH Thương mại Dịch vụ An Phát" → "Công ty TNHH TMDV An Phát".
 */
export const fmtName = (name, max = 30) => {
    const s = String(name || '').trim().replace(/\s+/g, ' ');
    if (s.length <= max) return s;
    const words = s.split(' ');
    if (words.length <= 4) return s;
    // Chữ viết tắt = từ không có nguyên âm (TNHH, MTV, CP... — đúng cả khi tên viết hoa toàn
    // bộ hay gõ "Tnhh"), hoặc từ viết hoa toàn bộ nằm trong một tên viết thường (vd "ABC").
    const allCaps = s === s.toUpperCase();
    const hasVowel = w => /[aeiouy]/i.test(w.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const isAbbr = w => w.length > 1 && (
        !hasVowel(w) || (!allCaps && w === w.toUpperCase() && w !== w.toLowerCase())
    );
    const middle = [];
    let initials = '';
    words.slice(2, -2).forEach(w => {
        if (isAbbr(w)) {
            if (initials) { middle.push(initials); initials = ''; }
            middle.push(w);
        } else {
            initials += w[0].toUpperCase();
        }
    });
    if (initials) middle.push(initials);
    return [...words.slice(0, 2), ...middle, ...words.slice(-2)].join(' ');
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