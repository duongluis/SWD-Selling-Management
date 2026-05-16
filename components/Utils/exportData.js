// components/Utils/exportData.js
// Admin-only data export: Excel (xlsx) + Images ZIP (jszip)
// Web-only — both libraries use browser APIs.

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebaseConfig';

// ── Fetch ────────────────────────────────────────────────────

export async function fetchExportData(onProgress) {
    onProgress?.('Đang tải khách hàng...');
    const customersSnap = await getDocs(collection(db, 'customers'));
    const customers = customersSnap.docs.map(d => ({ ...d.data(), docId: d.id }));

    onProgress?.('Đang tải đơn hàng...');
    const orders = [];
    await Promise.all(customers.map(async (c) => {
        if (!c.phone) return;
        try {
            const snap = await getDoc(doc(db, 'orders', c.phone));
            if (snap.exists()) {
                (snap.data().orders || []).forEach(o =>
                    orders.push({ ...o, _customerName: c.name || c.companyName, _customerPhone: c.phone })
                );
            }
        } catch (_) { }
    }));

    onProgress?.('Đang tải người dùng...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => {
        const u = d.data();
        const { passwordHash: _ph, ...safe } = u;
        return safe;
    });

    onProgress?.('Đang tải tin tức...');
    const newsSnap = await getDocs(collection(db, 'news'));
    const news = newsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

    return { customers, orders, users, news };
}

// ── Format rows ──────────────────────────────────────────────

function fmtDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('vi-VN');
}

function fmtNum(n) { return isNaN(n) ? 0 : Number(n) || 0; }

function formatCustomers(customers) {
    return customers.map((c, i) => ({
        'STT': i + 1,
        'Loại KH': c.bizModel === 'company' ? 'Doanh nghiệp' : 'Cá nhân',
        'Tên / Công ty': c.bizModel === 'company' ? (c.companyName || '') : (c.name || ''),
        'Số điện thoại': c.phone || '',
        'Email': c.email || c.emailContact || '',
        'Địa chỉ': c.address || c.bizAddress || '',
        'Mã số thuế': c.taxCode || '',
        'Người liên hệ': c.contactName || '',
        'SĐT liên hệ': c.contactPhone || '',
        'Ghi chú': c.note || '',
    }));
}

function formatOrders(orders) {
    return orders.map((o, i) => {
        const items = o.items || [];
        const total = items.reduce((s, p) => s + fmtNum(p.price) * fmtNum(p.qty), 0);
        return {
            'STT': i + 1,
            'Mã ĐH': o.id || '',
            'Khách hàng': o.customer || o._customerName || '',
            'Số điện thoại': o._customerPhone || '',
            'Loại đơn': o.orderType || '',
            'Trạng thái': o.status || '',
            'Tổng tiền (VND)': total,
            'Địa chỉ giao': o.deliveryAddress || '',
            'Sản phẩm': items.map(p => `${p.name || ''} x${p.qty || 1}`).join('; '),
            'Ghi chú': o.note || '',
            'Ngày tạo': fmtDate(o.createdAt),
        };
    });
}

function formatUsers(users) {
    return users.map((u, i) => ({
        'STT': i + 1,
        'Tên': u.name || '',
        'Email': u.email || '',
        'Vai trò': u.role || '',
        'Xác minh': u.verified ? 'Có' : 'Không',
        'Bị khóa': u.locked ? 'Có' : 'Không',
    }));
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

// ── CSV download ─────────────────────────────────────────────

function escape(v) {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    return [
        headers.map(escape).join(','),
        ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\n');
}

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportCSV(data) {
    const sheets = [
        ['khach-hang.csv', formatCustomers(data.customers)],
        ['don-hang.csv', formatOrders(data.orders)],
        ['nguoi-dung.csv', formatUsers(data.users)],
        ['tin-tuc.csv', formatNews(data.news)],
    ];
    for (const [name, rows] of sheets) {
        const bom = '﻿';
        downloadBlob(name, new Blob([bom + toCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
        await new Promise(r => setTimeout(r, 400));
    }
}

// ── Excel export ─────────────────────────────────────────────

export async function exportExcel(data) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const sheets = [
        ['Khách Hàng', formatCustomers(data.customers)],
        ['Đơn Hàng', formatOrders(data.orders)],
        ['Người Dùng', formatUsers(data.users)],
        ['Tin Tức', formatNews(data.news)],
    ];

    for (const [sheetName, rows] of sheets) {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
        // Auto column width
        const colWidths = rows.length
            ? Object.keys(rows[0]).map(k => ({
                wch: Math.min(50, Math.max(k.length + 2,
                    ...rows.map(r => String(r[k] ?? '').length + 1)))
            }))
            : [];
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `SWD-Export-${date}.xlsx`);
}

// ── Images ZIP ───────────────────────────────────────────────

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
    } catch (_) { return null; }
}

export async function exportImagesZip(news, onProgress) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder('images');
    let count = 0;

    for (const [ni, n] of news.entries()) {
        const safeName = `news_${ni + 1}_${(n.title || n.id || '').replace(/[^\w]/g, '_').slice(0, 24)}`;
        onProgress?.(`Xử lý: ${n.title?.slice(0, 30) || n.id} (${ni + 1}/${news.length})`);

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

    if (count === 0) return 0;

    onProgress?.('Đang nén file ZIP...');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(`SWD-Images-${date}.zip`, blob);
    return count;
}
