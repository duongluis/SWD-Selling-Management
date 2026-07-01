// components/Utils/exportData.js
// Export dữ liệu Firebase → Excel / CSV / ZIP ảnh
// Upload lên NAS Docker server (web-only)

import { db } from '@/config/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

// ── Helpers ──────────────────────────────────────────────────

function fmtDate(val) {
    if (!val) return '';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        if (isNaN(d)) return String(val);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return String(val); }
}

function fmtNum(n) {
    const v = parseFloat(n);
    return isNaN(v) ? 0 : v;
}

function customerDisplayName(c) {
    if (!c) return '';
    return c.bizModel === 'company'
        ? (c.companyName || c.name || '')
        : (c.name || c.companyName || '');
}

// ── Fetch toàn bộ dữ liệu Firebase ───────────────────────────

export async function fetchExportData(onProgress) {
    onProgress?.('Đang tải khách hàng...');
    const customersSnap = await getDocs(collection(db, 'customers'));
    const customers = customersSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    onProgress?.('Đang tải đơn hàng...');
    const ordersSnap = await getDocs(collection(db, 'orders'));
    const orders = ordersSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    onProgress?.('Đang tải dịch vụ...');
    const servicesSnap = await getDocs(collection(db, 'service'));
    const services = servicesSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    onProgress?.('Đang tải giới thiệu khách...');
    const consultsSnap = await getDocs(collection(db, 'consult'));
    const consults = consultsSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    onProgress?.('Đang tải người dùng...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => {
        const { passwordHash: _ph, ...safe } = d.data();
        return { ...safe, docId: d.id };
    });

    onProgress?.('Đang tải tin tức...');
    const newsSnap = await getDocs(collection(db, 'news'));
    const news = newsSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    return { customers, orders, services, consults, users, news };
}

// ── Format rows ───────────────────────────────────────────────

function formatCustomers(customers) {
    return customers.map((c, i) => ({
        'STT': i + 1,
        'Mã KH': c.id || c.docId || '',
        'Loại': c.bizModel === 'company' ? 'Doanh nghiệp' : 'Cá nhân',
        'Tên / Công ty': customerDisplayName(c),
        'Người liên hệ': c.contactName || '',
        'Số điện thoại': c.phone || c.contactPhone || '',
        'SĐT liên hệ': c.contactPhone || '',
        'Email': c.email || c.emailContact || '',
        'Địa chỉ': c.address || c.bizAddress || '',
        'Mã số thuế': c.taxCode || '',
        'Ghi chú': c.note || '',
        'Tạo bởi': c.createdBy || '',
        'Advisor': c.advisor || '',
        'Root Advisor': c.rootAdvisor || '',
        'Ngày tạo': fmtDate(c.createdAt),
    }));
}

function formatOrders(orders) {
    return orders.map((o, i) => {
        const items = o.items || [];
        const totalRevenue = items.reduce((s, p) => s + fmtNum(p.price) * fmtNum(p.qty), 0);
        const commission = items.reduce((s, p) => {
            const sell = fmtNum(p.price);
            const base = fmtNum(p.basePrice || p.price_a || p.price_p || p.price_c || p.price);
            return s + Math.max(0, (sell - base) * fmtNum(p.qty));
        }, 0);
        return {
            'STT': i + 1,
            'Mã đơn': o.id || o.docId || '',
            'Loại đơn': { buon: 'Đơn buôn', le: 'Đơn lẻ' }[o.orderType] || o.orderType || '',
            'Khách hàng': o.customer || '',
            'Mã KH': o.customerId || '',
            'Trạng thái': o.status || '',
            'Hình thức TT': { customer: 'Khách hàng TT', company: 'Doanh nghiệp TT' }[o.paymentMethod] || o.paymentMethod || '',
            'Doanh thu (VND)': totalRevenue,
            'Hoa hồng (VND)': commission,
            'Địa chỉ giao': o.address || '',
            'Sản phẩm': items.map(p => `${p.name || ''}×${fmtNum(p.qty)} (${fmtNum(p.price).toLocaleString('vi-VN')}đ)`).join('; '),
            'Ghi chú': o.note || '',
            'Tạo bởi': o.createdBy || '',
            'Root Advisor': o.rootAdvisor || '',
            'Cấp': o.level || '',
            'Ngày tạo': fmtDate(o.createdAt),
        };
    });
}

function formatServices(services) {
    return services.map((s, i) => {
        const items = s.orderItems || [];
        return {
            'STT': i + 1,
            'Mã dịch vụ': s.id || s.docId || '',
            'Loại': { DELIVERY: 'Giao hàng', INSTALLATION: 'Lắp đặt' }[s.type] || s.type || '',
            'Mã đơn hàng': s.orderId || '',
            'Khách hàng': s.customer || '',
            'Số điện thoại': s.phone || '',
            'Địa chỉ': s.address || '',
            'Trạng thái': s.status || '',
            'Giá trị (VND)': items.reduce((sum, p) => sum + fmtNum(p.price) * fmtNum(p.qty), 0),
            'Sản phẩm': items.map(p => `${p.name || ''}×${fmtNum(p.qty)}`).join('; '),
            'Ghi chú': s.note || '',
            'Tạo bởi': s.createdBy || '',
            'Ngày tạo': fmtDate(s.createdAt),
            'Ngày hoàn thành': fmtDate(s.completedAt),
        };
    });
}

function formatConsults(consults) {
    return consults.map((c, i) => ({
        'STT': i + 1,
        'Tên khách': c.name || '',
        'Số điện thoại': c.phone || '',
        'Địa chỉ': c.address || '',
        'Ghi chú': c.note || '',
        'Trạng thái': { success: 'Thành công', failed: 'Thất bại', pending: 'Đang xử lý' }[c.status] || c.status || '',
        'Tạo bởi': c.createdBy || '',
        'Ngày tạo': fmtDate(c.createdAt),
    }));
}

function formatUsers(users) {
    return users.map((u, i) => {
        const roleMap = { admin: 'Admin', daily: 'Đại lý', phantan: 'Đối tác', ctv: 'Cộng tác viên', giamdoc: 'Giám đốc' };
        const rawRole = (u.role || u.member || '').toLowerCase();
        return {
            'STT': i + 1,
            'Tên': u.name || u.companyName || '',
            'Email': u.email || '',
            'Số điện thoại': u.phone || '',
            'Địa chỉ': u.address || u.bizAddress || '',
            'Vai trò': roleMap[rawRole] || u.role || u.member || '',
            'Biệt danh': u.nickname || '',
            'Xác minh': u.verified ? 'Đã duyệt' : 'Chờ duyệt',
            'Bị khóa': u.locked ? 'Có' : 'Không',
            'Advisor': u.advisor || '',
            'Root Advisor': u.rootAdvisor || '',
            'Ngân hàng': u.bankName || '',
            'Số TK': u.bankAccount || '',
            'Ngày tạo': fmtDate(u.createdAt),
        };
    });
}

function formatNews(news) {
    return news.map((n, i) => ({
        'STT': i + 1,
        'Tiêu đề': n.title || '',
        'Danh mục': n.category || '',
        'Tác giả': n.authorName || '',
        'Email tác giả': n.authorEmail || '',
        'Số block nội dung': (n.blocks || []).length,
        'Có ảnh bìa': n.imageUrl ? 'Có' : 'Không',
        'Số ảnh trong bài': (n.blocks || []).filter(b => b.type === 'image' && b.value).length,
        'Ngày đăng': fmtDate(n.createdAt),
    }));
}

// ── Tạo Excel Blob ────────────────────────────────────────────

async function buildExcelBlob(data) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const sheets = [
        ['Đơn Hàng', formatOrders(data.orders)],
        ['Khách Hàng', formatCustomers(data.customers)],
        ['Dịch Vụ', formatServices(data.services)],
        ['Giới Thiệu Khách', formatConsults(data.consults)],
        ['Người Dùng', formatUsers(data.users)],
        ['Tin Tức', formatNews(data.news)],
    ];

    for (const [sheetName, rows] of sheets) {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
        const keys = rows.length ? Object.keys(rows[0]) : [];
        ws['!cols'] = keys.map(k => ({
            wch: Math.min(60, Math.max(k.length + 2, ...rows.map(r => String(r[k] ?? '').length + 1))),
        }));
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Tạo Images ZIP Blob ───────────────────────────────────────

async function toBase64(uri) {
    try {
        if (uri.startsWith('data:')) return uri.split(',')[1];
        const resp = await fetch(uri);
        const blob = await resp.blob();
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result.split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    } catch { return null; }
}

async function buildImagesZipBlob(news, onProgress) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder('images');
    let count = 0;

    for (const [ni, n] of news.entries()) {
        const safeName = `news_${ni + 1}_${(n.title || n.docId || '').replace(/[^\w]/g, '_').slice(0, 24)}`;
        onProgress?.(`Đang xử lý ảnh: ${n.title?.slice(0, 30) || n.docId} (${ni + 1}/${news.length})`);

        if (n.imageUrl) {
            const b64 = await toBase64(n.imageUrl);
            if (b64) { folder.file(`${safeName}_cover.jpg`, b64, { base64: true }); count++; }
        }
        for (const [bi, block] of (n.blocks || []).entries()) {
            if (block.type === 'image' && block.value) {
                const b64 = await toBase64(block.value);
                if (b64) { folder.file(`${safeName}_img${bi + 1}.jpg`, b64, { base64: true }); count++; }
            }
        }
    }

    if (count === 0) return { blob: null, count: 0 };

    onProgress?.('Đang nén ảnh...');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, count };
}

// ── Download về máy (local) ───────────────────────────────────

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportExcel(data) {
    const blob = await buildExcelBlob(data);
    downloadBlob(`SWD-Export-${new Date().toISOString().slice(0, 10)}.xlsx`, blob);
}

export async function exportCSV(data) {
    const BOM = '﻿';
    function escape(v) {
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }
    function toCsv(rows) {
        if (!rows.length) return '';
        const headers = Object.keys(rows[0]);
        return [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    }
    const sheets = [
        ['don-hang.csv', formatOrders(data.orders)],
        ['khach-hang.csv', formatCustomers(data.customers)],
        ['dich-vu.csv', formatServices(data.services)],
        ['gioi-thieu-khach.csv', formatConsults(data.consults)],
        ['nguoi-dung.csv', formatUsers(data.users)],
        ['tin-tuc.csv', formatNews(data.news)],
    ];
    for (const [name, rows] of sheets) {
        downloadBlob(name, new Blob([BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
        await new Promise(r => setTimeout(r, 400));
    }
}

export async function exportImagesZip(news, onProgress) {
    const { blob, count } = await buildImagesZipBlob(news, onProgress);
    if (count === 0) return 0;
    downloadBlob(`SWD-Images-${new Date().toISOString().slice(0, 10)}.zip`, blob);
    return count;
}

// ── Upload 1 file lên NAS ─────────────────────────────────────

async function pushFileToNAS(nasUrl, apiKey, filename, blob) {
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('filename', filename);

    const headers = {};
    if (apiKey) headers['x-api-key'] = apiKey;

    const res = await fetch(`${nasUrl.replace(/\/$/, '')}/upload`, {
        method: 'POST',
        headers,
        body: form,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => String(res.status));
        throw new Error(`NAS lỗi (${res.status}): ${text}`);
    }
    return filename;
}

// ── Backup toàn bộ lên NAS: Excel + Ảnh ZIP ──────────────────

export async function backupToNAS(data, nasUrl, apiKey, onProgress) {
    const date = new Date().toISOString().slice(0, 10);
    const results = { excel: null, images: null, imageCount: 0 };

    // 1. Excel
    onProgress?.('Đang tạo file Excel...');
    const excelBlob = await buildExcelBlob(data);
    const excelFilename = `SWD-Data-${date}.xlsx`;

    onProgress?.('Đang đẩy Excel lên NAS...');
    await pushFileToNAS(nasUrl, apiKey, excelFilename, excelBlob);
    results.excel = excelFilename;

    // 2. Ảnh ZIP (chỉ khi có ảnh)
    onProgress?.('Đang thu thập ảnh từ Firebase...');
    const { blob: zipBlob, count } = await buildImagesZipBlob(data.news, onProgress);

    if (zipBlob && count > 0) {
        const zipFilename = `SWD-Images-${date}.zip`;
        onProgress?.(`Đang đẩy ${count} ảnh lên NAS...`);
        await pushFileToNAS(nasUrl, apiKey, zipFilename, zipBlob);
        results.images = zipFilename;
        results.imageCount = count;
    }

    return results;
}

// Giữ lại tương thích ngược với nút "Đẩy lên NAS" cũ
export async function uploadToNAS(data, nasUrl, apiKey, onProgress) {
    onProgress?.('Đang tạo file Excel...');
    const excelBlob = await buildExcelBlob(data);
    const filename = `SWD-Export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    onProgress?.('Đang đẩy lên NAS...');
    await pushFileToNAS(nasUrl, apiKey, filename, excelBlob);
    return filename;
}
