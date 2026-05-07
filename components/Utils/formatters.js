export const fmtCurrency = (n) =>
    (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

export const fmtNumber = (n) =>
    Math.round(n || 0).toLocaleString('vi-VN');

export const fmtDate = (str) => {
    if (!str) return '—';
    try {
        return new Date(str).toLocaleDateString('vi-VN');
    } catch { return str; }
};

export const fmtPhone = (p) => {
    if (!p) return '—';
    const d = p.replace(/\D/g, '');
    if (d.length === 10) return d.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    return p;
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