// app/orderContract/index.jsx
// Màn tính toán + HỒ SƠ CHÀO GIÁ (theo template SWD mới)
// mode=order  → pre-fill từ đơn hàng có sẵn
// mode=template → điền tay, không lưu DB
// Xuất PDF: web dùng window.print(), mobile dùng expo-print
//
// ✅ v2 — Cập nhật theo bản doc "SWD_Template_Ho_so_chao_gia":
//    Trang bìa · 1.Giới thiệu công ty · 2.Thư chào giá · 3.Bảng báo giá chi tiết
//    4.Tiến độ thực hiện · 5.Bảo hành & bảo trì · 6.Điều khoản thanh toán · 7.Thông tin khác · Ký tên
// ✅ Bảng giá đủ 8 cột: STT | Hạng mục | Mô tả | ĐVT | SL | Đơn giá | Thành tiền | Ghi chú
// ✅ Tự sinh dòng "Bằng chữ: ... đồng" (đọc số tiếng Việt)
// ✅ Thêm editor: Thông tin công trình · Tiến độ · Bảo hành · Thư chào giá
// ✅ Mã báo giá đổi sang định dạng SWD-BG-YYYYMMDD-KH

import BgWatermark from '@/components/Main/BgWatermark';
import { showAlert } from '@/components/Main/showAlert';
import { productItems } from '@/components/Utils/orderItems';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Image, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/components/Main/TabScreenLayout';

const fmt = (n) => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
const fmtN = (n) => Math.round(n || 0).toLocaleString('vi-VN');
const COMM = { buon: 0.03, le: 0.05 };
const parseNum = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
const MAX_PAYMENT_TERMS = 4;

// ── Thông tin công ty (theo bản doc mới) ──────────────────────
const COMPANY = {
    name: 'CÔNG TY CỔ PHẦN SPRING WATER DELIVERY',
    address: 'Số 1 Hẻm 99/110/85 Định Công Hạ, Phường Định Công, TP Hà Nội',
    taxCode: '0110879471',
    hotline: '0393.028.008',
    email: 'contact@swd.vn',
    website: 'swd.vn',
    repName: 'Đặng Quang Hưng',
    repPhone: '08881 08883',
};

// ── Nội dung mục 1 (giới thiệu công ty) — sửa ở đây nếu marketing đổi copy ──
const INTRO = {
    overview:
        'Công ty Cổ phần Spring Water Delivery (thương hiệu SWD) là đơn vị cung cấp giải pháp lọc nước tổng sinh hoạt cho biệt thự, căn hộ, nhà phố và các dự án dân dụng tại Việt Nam và khu vực Đông Nam Á. Với triết lý kinh doanh <b>“Bán chất lượng nước, không bán máy lọc nước”</b>, SWD không ngừng nỗ lực mang đến những sản phẩm hiệu quả, bền vững, phù hợp với nhu cầu thực tế của từng khách hàng.',
    tech: [
        'Tiên phong công nghệ lọc nước nóng',
        'Ứng dụng công nghệ lọc đa cấp hiện đại trong lọc tổng sinh hoạt, lọc tổng tinh khiết, lọc tổng giữ khoáng',
        'Tích hợp công nghệ M.U.S.I.C độc quyền: tự động vệ sinh màng lọc, kéo dài tuổi thọ màng',
        'Hệ thống điều khiển thông minh',
        'Thiết kế đột phá — vững chắc, phù hợp với điều kiện nhà ở và khí hậu Việt Nam',
    ],
    projects: [
        'Dự án cứu trợ miền Trung — máy lọc nước dã chiến cho người dân vùng lũ',
        'Dự án cứu trợ Myanmar — phối hợp cùng Học viện Nguyên Thủy và các mạnh thường quân',
    ],
};

// ── Đọc số tiền bằng chữ (tiếng Việt) ─────────────────────────
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTriple(n, full) {
    const tram = Math.floor(n / 100);
    const chuc = Math.floor((n % 100) / 10);
    const dv = n % 10;
    let s = '';
    if (full || tram > 0) s += DIGITS[tram] + ' trăm';
    if (chuc === 0) {
        if (dv > 0) s += (s ? ' lẻ ' : '') + DIGITS[dv];
    } else if (chuc === 1) {
        s += (s ? ' ' : '') + 'mười';
        if (dv === 5) s += ' lăm';
        else if (dv > 0) s += ' ' + DIGITS[dv];
    } else {
        s += (s ? ' ' : '') + DIGITS[chuc] + ' mươi';
        if (dv === 1) s += ' mốt';
        else if (dv === 4) s += ' tư';
        else if (dv === 5) s += ' lăm';
        else if (dv > 0) s += ' ' + DIGITS[dv];
    }
    return s.trim();
}

function numberToVietnameseWords(num) {
    let n = Math.round(Math.abs(num || 0));
    if (n === 0) return 'Không';
    const groups = [];
    while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
    const scale = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const len = groups.length;
    const parts = [];
    groups.forEach((g, i) => {
        if (g === 0) return;
        const pos = len - 1 - i;
        parts.push((readTriple(g, i > 0) + ' ' + (scale[pos] || '')).trim());
    });
    const s = parts.join(' ').replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Escape HTML để tránh vỡ layout khi khách nhập ký tự lạ ────
const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Mã báo giá: SWD-BG-YYYYMMDD-TENKH (có thể ghi đè trong quoteMeta.code) ──
function buildQuoteCode(order, quoteMeta) {
    if (quoteMeta?.code) return quoteMeta.code;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const custSlug = (order?.customer || 'KH')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toUpperCase()
        .slice(0, 10) || 'KH';
    return `SWD-BG-${y}${m}${d}-${custSlug}`;
}

// ── Chuẩn hoá danh sách đợt thanh toán (fallback theo doc: 50/30/20) ──
function normalizePaymentTerms(paymentTerms) {
    const terms = Array.isArray(paymentTerms) && paymentTerms.length
        ? paymentTerms
        : [{ percent: '100', dueLabel: 'Trước khi lắp đặt' }];
    const totalPercent = terms.reduce((s, t) => s + parseNum(t.percent), 0);
    return { terms, totalPercent };
}

// ── Input nhỏ dùng trong bảng — dùng string để tránh mất ký tự ──
function TInput({ value, onChange, keyboardType = 'default', style, placeholder }) {
    return (
        <TextInput
            style={[S.tInput, style]}
            value={value === undefined || value === null ? '' : String(value)}
            keyboardType={keyboardType}
            onChangeText={onChange}
            selectTextOnFocus
            placeholder={placeholder}
            placeholderTextColor="#CBD5E1"
        />
    );
}

// ── Divider ───────────────────────────────────────────────────
const HR = () => <View style={S.hr} />;

// ── Xuất PDF ─────────────────────────────────────────────────
// ── Ảnh: chuyển asset/blob → base64 (bắt buộc để nhúng vào PDF) ──
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function assetToBase64(mod) {
    const { Asset } = await import('expo-asset');
    const asset = Asset.fromModule(mod);
    await asset.downloadAsync();
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    return blobToBase64(blob);
}

async function getBase64Logo() {
    try {
        return await assetToBase64(require('../../assets/images/logo-light.png'));
    } catch (e) {
        console.warn('getBase64Logo failed:', e.message);
        return null;
    }
}

// ✅ 8 ảnh chứng nhận/chứng chỉ — MẶC ĐỊNH, luôn in ở mục 1
//    Metro yêu cầu require tĩnh nên phải liệt kê đủ 8 dòng.
//    Nếu file là .jpg thì đổi đuôi ở đây.
const CERT_MODULES = [
    require('../../assets/images/certs/cert_1.png'),
    require('../../assets/images/certs/cert_2.png'),
    require('../../assets/images/certs/cert_3.png'),
    require('../../assets/images/certs/cert_4.png'),
    require('../../assets/images/certs/cert_5.png'),
    require('../../assets/images/certs/cert_6.png'),
    require('../../assets/images/certs/cert_7.png'),
    require('../../assets/images/certs/cert_8.png'),
];

async function getBase64Certs() {
    const out = [];
    for (const mod of CERT_MODULES) {
        try { out.push(await assetToBase64(mod)); }
        catch (e) { console.warn('cert load failed:', e.message); }
    }
    return out;
}

// ✅ Chọn NHIỀU ảnh cho dự án tiêu biểu — trả về mảng data-URI base64
//    QUAN TRỌNG: mọi nhánh đều phải resolve (kể cả khi người dùng bấm Huỷ),
//    nếu không nút "Chọn ảnh" sẽ quay loading vĩnh viễn.
async function pickImagesAsync(limit = 6) {
    return Platform.OS === 'web' ? pickImagesWeb(limit) : pickImagesNative(limit);
}

// ── Web: input file ẩn ────────────────────────────────────────
function pickImagesWeb(limit) {
    return new Promise((resolve) => {
        let settled = false;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        // Safari/Firefox chặn .click() nếu element chưa nằm trong DOM
        input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(input);

        const cleanup = () => {
            window.removeEventListener('focus', onWindowFocus);
            if (input.parentNode) input.parentNode.removeChild(input);
        };
        const finish = (list) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(list || []);
        };

        // Người dùng bấm Huỷ: Chrome 113+ có sự kiện 'cancel'
        input.addEventListener('cancel', () => finish([]));

        // Trình duyệt cũ không có 'cancel' → dựa vào việc cửa sổ lấy lại focus.
        // Chờ 800ms để 'change' (nếu có) kịp chạy trước.
        function onWindowFocus() {
            setTimeout(() => {
                if (!input.files || input.files.length === 0) finish([]);
            }, 800);
        }
        window.addEventListener('focus', onWindowFocus);

        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []).slice(0, limit);
            const out = [];
            for (const f of files) {
                try { out.push(await blobToBase64(f)); }
                catch (e) { console.warn('read image failed:', e.message); }
            }
            finish(out);
        });

        input.click();
    });
}

// ── Mobile: expo-image-picker ─────────────────────────────────
async function pickImagesNative(limit) {
    let ImagePicker = null;
    try {
        const mod = await import('expo-image-picker');
        // Metro interop: có bản trả namespace, có bản gói trong .default
        ImagePicker = mod?.launchImageLibraryAsync ? mod : mod?.default;
    } catch (e) {
        console.warn('import expo-image-picker failed:', e.message);
    }

    if (!ImagePicker?.launchImageLibraryAsync) {
        showAlert('Thiếu thư viện', 'Chưa cài expo-image-picker.\nChạy: npx expo install expo-image-picker');
        return [];
    }

    try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm?.granted) {
            showAlert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh trong Cài đặt.');
            return [];
        }

        // SDK ≥52 bỏ MediaTypeOptions, dùng mảng string thay thế
        const mediaTypes = ImagePicker.MediaTypeOptions?.Images ?? ['images'];

        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes,
            allowsMultipleSelection: true,
            selectionLimit: limit,
            quality: 0.6,           // nén bớt cho file PDF không quá nặng
            base64: true,
        });
        if (res?.canceled) return [];
        return (res?.assets || []).map(a =>
            a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri
        );
    } catch (e) {
        console.warn('pickImages error:', e);
        showAlert('Lỗi', 'Không mở được thư viện ảnh: ' + e.message);
        return [];
    }
}

// ✅ Tự phân bổ ảnh thành lưới cân đối theo số lượng
//    1 ảnh → 1 hàng lớn · 2 hoặc 4 ảnh → 2 cột · còn lại → 3 cột (chứng chỉ ép 4 cột)
function galleryHtml(images, opts = {}) {
    const list = (images || []).filter(Boolean);
    if (!list.length) return '';
    const n = list.length;
    const perRow = opts.perRow || (n === 1 ? 1 : (n === 2 || n === 4) ? 2 : 3);
    const width = { 1: '66%', 2: '48%', 3: '32%', 4: '24%' }[perRow] || '32%';
    const height = opts.height || ({ 1: '205px', 2: '158px', 3: '110px', 4: '92px' }[perRow] || '110px');
    const fit = opts.fit || 'cover';
    const bg = fit === 'contain' ? '#fff' : 'transparent';
    return `<div class="gallery">${list.map(src =>
        `<span class="imgCell" style="width:${width}"><img src="${src}" style="height:${height};object-fit:${fit};background:${bg}" /></span>`
    ).join('')}</div>`;
}

async function exportPDF(htmlContent, isDesktop) {
    if (isDesktop) {
        const w = window.open('', '_blank');
        w.document.write(htmlContent);
        w.document.close();
        setTimeout(() => w.print(), 400);
    } else {
        try {
            const Print = await import('expo-print');
            await Print.printAsync({ html: htmlContent });
        } catch (e) {
            showAlert('Lỗi', 'Không thể xuất PDF: ' + e.message);
        }
    }
}

// ══════════════════════════════════════════════════════════════
// PDF: HỒ SƠ CHÀO GIÁ (7 mục, theo template doc)
// ══════════════════════════════════════════════════════════════
function buildPDFHtml({
    order, seller, items: itemsProp, services: servicesProp, quoteMeta,
    disc, subtotal, total, discAmt, logoBase64, bankInfo, paymentTerms,
    schedule, warranty, letter, projects, certImages,
}) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];
    const services = Array.isArray(servicesProp) ? servicesProp : [];
    const hdNum = buildQuoteCode(order, quoteMeta);
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const today = `${dd}/${mm}/${yyyy}`;
    const { terms, totalPercent } = normalizePaymentTerms(paymentTerms);

    const customerName = quoteMeta?.company || order?.customer || '—';
    const customerPhone = order?.phone || '—';
    const siteAddress = quoteMeta?.siteAddress || order?.address || '—';
    const jobName = quoteMeta?.jobName || 'Cung cấp và lắp đặt hệ thống lọc nước tổng sinh hoạt';
    const systemName = quoteMeta?.systemName || jobName;
    const repName = quoteMeta?.contactName || bankInfo?.senderName || seller?.name || COMPANY.repName;
    const repPhone = quoteMeta?.contactPhone || bankInfo?.senderPhone || seller?.phone || COMPANY.repPhone;

    // ── Gộp sản phẩm + dịch vụ thành 1 bảng liên tục (đúng như doc) ──
    const rows = [
        ...items.map(p => ({ ...p, defUnit: 'Bộ' })),
        ...services.map(s => ({ ...s, defUnit: 'Gói' })),
    ];

    const rowsHtml = rows.map((p, i) => {
        const isIncluded = p.included === true;
        const lineTotal = isIncluded ? 0 : parseNum(p.price) * (parseNum(p.qty) || 1);
        return `
        <tr>
            <td class="c">${i + 1}</td>
            <td class="b">${esc(p.name || '')}</td>
            <td class="desc">${esc(p.desc || p.description || p.capacity || '')}</td>
            <td class="c">${esc(p.unit || p.defUnit)}</td>
            <td class="c">${fmtN(p.qty || 1)}</td>
            <td class="r">${isIncluded ? '—' : fmtN(p.price)}</td>
            <td class="r b ${isIncluded ? 'included' : ''}">${isIncluded ? 'Bao gồm' : fmtN(lineTotal)}</td>
            <td class="c note">${esc(p.note || '--')}</td>
        </tr>`;
    }).join('');

    // ── Tiến độ ──
    const schedRows = (schedule || []).filter(s => s.task).map(s => `
        <tr><td>${esc(s.task)}</td><td class="c b">${esc(s.days || '__')} ngày</td></tr>`).join('');
    const totalDays = (schedule || []).reduce((s, r) => s + parseNum(r.days), 0);

    // ── Điều khoản thanh toán theo đợt ──
    const paymentRows = terms.map((t, i) => {
        const pct = parseNum(t.percent);
        const amt = total * pct / 100;
        return `<tr>
            <td class="b" style="width:78px">Đợt ${i + 1}</td>
            <td>Thanh toán <b>${pct}%</b> giá trị đơn hàng (<b>${fmtN(amt)}đ</b>)${t.dueLabel ? ` — ${esc(t.dueLabel)}` : ''}</td>
        </tr>`;
    }).join('');
    const paymentWarning = totalPercent !== 100
        ? `<p class="warn">* Tổng tỷ lệ các đợt hiện tại: ${totalPercent}% (chưa đủ 100%)</p>` : '';

    // ── Dự án tiêu biểu: nội dung + ảnh do người dùng tự nhập ──
    const projList = (projects || []).filter(p => (p.title || p.desc || (p.images || []).length));
    const projectsHtml = projList.length
        ? projList.map(p => `
        <div class="projBlock">
          ${p.title ? `<p class="projTitle">${esc(p.title)}</p>` : ''}
          ${p.desc ? `<p class="projDesc">${esc(p.desc)}</p>` : ''}
          ${galleryHtml(p.images)}
        </div>`).join('')
        : `<ul>${INTRO.projects.map(t => `<li>${t}</li>`).join('')}</ul>`;

    // ── Chứng nhận & chứng chỉ: 8 ảnh mặc định từ assets ──
    const certsHtml = (certImages || []).length
        ? galleryHtml(certImages, { perRow: 4, fit: 'contain', height: '96px' })
        : '<div class="imgSlot">[CHÈN HÌNH ẢNH CHỨNG NHẬN / CHỨNG CHỈ TẠI ĐÂY]</div>';

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 14mm 13mm; }
  body { font-family: "Times New Roman", Times, serif; margin: 0; color: #111827; font-size: 12.5px; line-height: 1.55; }
  .page { position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .watermark { position: fixed; top: 46%; left: 50%; transform: translate(-50%,-50%); width: 62%; opacity: 0.05; pointer-events: none; z-index: 0; }
  .page > * { position: relative; z-index: 1; }

  h2.sec { font-size: 14px; font-weight: bold; color: #0C447C; text-transform: uppercase;
           border-bottom: 2px solid #7FD3EF; padding-bottom: 5px; margin: 0 0 12px; }
  h3.sub { font-size: 12.5px; font-weight: bold; margin: 14px 0 6px; color: #0F172A; }
  p { margin: 0 0 9px; text-align: justify; }
  ul { margin: 0 0 10px; padding-left: 20px; }
  li { margin-bottom: 4px; }

  /* ── Trang bìa ── */
  /* ── Trang bìa: căn giữa cả chiều dọc lẫn ngang (dùng làm tờ đầu khi in) ── */
  .cover { display: table; width: 100%; height: 258mm; text-align: center; }
  .coverInner { display: table-cell; vertical-align: middle; }
  .cover p, .sign p { text-align: center; }   /* ghi đè p{justify} ở trên */
  .coverLogo { width: 150px; margin-bottom: 22px; }
  .coverTitle { font-size: 30px; font-weight: bold; letter-spacing: .08em; color: #0C447C; margin: 0; }
  .coverRule { width: 190px; height: 3px; background: #7FD3EF; margin: 12px auto 22px; }
  .coverJob { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0 0 6px; }
  .coverAddr { font-size: 13px; font-weight: bold; color: #334155; margin: 0 0 26px; }
  .coverTable { width: 74%; margin: 0 auto 34px; border-collapse: collapse; }
  .coverTable td { border: 1px solid #CBD5E1; padding: 8px 12px; font-size: 12.5px; text-align: left; }
  .coverTable td:first-child { background: #F1F5F9; font-weight: bold; width: 42%; }
  .coverFooter { border-top: 1px solid #CBD5E1; padding-top: 14px; margin-top: 30px; }
  .coverCompany { font-size: 13.5px; font-weight: bold; color: #0C447C; margin: 0 0 4px; }
  .coverLine { font-size: 11.5px; color: #334155; margin: 0 0 2px; }

  /* ── Khối "Kính gửi" ── */
  .letterBox { border: 1px solid #CBD5E1; background: #F8FAFC; padding: 12px 16px; margin-bottom: 14px; }
  .letterBox p { margin: 0 0 5px; font-weight: bold; text-align: left; }
  .letterBox p:last-child { margin-bottom: 0; font-weight: normal; }
  .dateLine { text-align: right; font-style: italic; margin: 0 0 14px; }

  /* ── Bảng ── */
  table.data { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 11.5px; }
  table.data th { background: #0C447C; color: #fff; font-weight: bold; padding: 7px 5px; border: 1px solid #0C447C; text-align: center; font-size: 11px; }
  table.data td { padding: 6px 5px; border: 1px solid #CBD5E1; vertical-align: middle; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  .desc { font-size: 11px; color: #334155; }
  .note { font-size: 11px; color: #64748B; }
  .included { font-style: italic; color: #0C447C; }
  .sumRow td { border: 1px solid #CBD5E1; font-weight: bold; background: #F1F5F9; }
  .totalRow td { background: #7FD3EF; font-weight: bold; font-size: 13px; border: 1px solid #7FD3EF; }
  .wordsRow td { font-style: italic; font-weight: bold; background: #F8FAFC; }
  .unit { font-style: italic; font-size: 11.5px; margin: 0 0 4px; }
  .hint { font-style: italic; font-size: 11px; color: #475569; margin-top: 6px; }
  .warn { color: #B91C1C; font-size: 11px; font-style: italic; }

  table.plain { width: 100%; border-collapse: collapse; margin: 4px 0 12px; font-size: 12px; }
  table.plain td { border: 1px solid #CBD5E1; padding: 7px 10px; }
  table.plain td:first-child { background: #F8FAFC; }

  .bankTable { width: 100%; border-collapse: collapse; margin: 4px 0 12px; font-size: 12px; }
  .bankTable td { border: 1px solid #CBD5E1; padding: 6px 10px; }
  .bankTable td:first-child { background: #F8FAFC; font-weight: bold; width: 34%; }

  .sign { margin-top: 34px; text-align: center; }
  .signTitle { font-weight: bold; font-size: 12.5px; text-transform: uppercase; margin: 0 0 4px; }
  .signNote { font-style: italic; font-size: 11.5px; color: #475569; margin: 0 0 54px; }
  .signName { font-weight: bold; font-size: 13px; margin: 0; }
  .signPhone { font-size: 11.5px; color: #334155; margin: 2px 0 0; }

  .imgSlot { border: 1px dashed #94A3B8; background: #F8FAFC; color: #64748B; font-style: italic;
             text-align: center; padding: 26px 10px; font-size: 11.5px; margin: 8px 0 12px; }

  /* ── Lưới ảnh (dự án tiêu biểu / chứng chỉ) ── */
  .gallery { font-size: 0; margin: 6px -3px 12px; }
  .imgCell { display: inline-block; vertical-align: top; padding: 3px; }
  .imgCell img { width: 100%; display: block; border: 1px solid #E2E8F0; border-radius: 4px; }
  .projBlock { margin-bottom: 14px; page-break-inside: avoid; }
  .projTitle { font-weight: bold; font-size: 12.5px; margin: 0 0 3px; color: #0C447C; text-align: left; }
  .projDesc { margin: 0 0 4px; font-size: 12px; }
</style></head><body>
${logoBase64 ? `<img class="watermark" src="${logoBase64}" alt="" />` : ''}

<!-- ═══ TRANG BÌA (căn giữa trang) ═══ -->
<div class="page cover">
 <div class="coverInner">
  ${logoBase64 ? `<img class="coverLogo" src="${logoBase64}" alt="logo" />` : ''}
  <p class="coverTitle">HỒ SƠ CHÀO GIÁ</p>
  <div class="coverRule"></div>
  <p class="coverJob">${esc(jobName)}</p>
  <p class="coverAddr">${esc(siteAddress)}</p>

  <table class="coverTable">
    <tr><td>Số báo giá:</td><td><b>${esc(hdNum)}</b></td></tr>
    <tr><td>Ngày:</td><td><b>${dd} / ${mm} / ${yyyy}</b></td></tr>
    <tr><td>Khách hàng:</td><td><b>${esc(customerName)}</b></td></tr>
    <tr><td>Người phụ trách:</td><td>${esc(repName)}</td></tr>
    <tr><td>Điện thoại:</td><td>${esc(repPhone)}</td></tr>
  </table>

  <div class="coverFooter">
    <p class="coverCompany">${COMPANY.name}</p>
    <p class="coverLine">${COMPANY.address} • MST: ${esc(seller?.taxCode || COMPANY.taxCode)}</p>
    <p class="coverLine">Hotline: ${COMPANY.hotline} • ${esc(seller?.email || COMPANY.email)} • ${COMPANY.website}</p>
  </div>
 </div>
</div>

<!-- ═══ 1. GIỚI THIỆU CÔNG TY ═══ -->
<div class="page">
  <h2 class="sec">1. Giới thiệu công ty</h2>

  <h3 class="sub">Tổng quan</h3>
  <p>${INTRO.overview}</p>

  <h3 class="sub">Dẫn đầu về công nghệ</h3>
  <ul>${INTRO.tech.map(t => `<li>${t}</li>`).join('')}</ul>

  <h3 class="sub">Dự án tiêu biểu</h3>
  ${projectsHtml}

  <h3 class="sub">Chứng nhận &amp; chứng chỉ</h3>
  ${certsHtml}
</div>

<!-- ═══ 2. THƯ CHÀO GIÁ ═══ -->
<div class="page">
  <p class="dateLine">Hà Nội, ngày ${dd} tháng ${mm} năm ${yyyy}</p>
  <h2 class="sec">2. Thư chào giá</h2>

  <div class="letterBox">
    <p>Kính gửi: ${esc(customerName)}</p>
    <p>Điện thoại: ${esc(customerPhone)}</p>
    <p>Địa chỉ: ${esc(siteAddress)}</p>
    <p><b>Về việc:</b> Cung cấp và lắp đặt <b>${esc(systemName)}</b> và các thiết bị, vật tư, dịch vụ kèm theo</p>
  </div>

  <p>Kính gửi Quý khách hàng,</p>
  <p>Công ty Cổ phần Spring Water Delivery xin gửi lời chào trân trọng và lời chúc sức khỏe đến Quý khách. Được nhận yêu cầu tư vấn từ Quý khách là niềm vui lớn đối với toàn thể đội ngũ SWD. Chúng tôi chân thành cảm ơn Quý khách đã trao cho chúng tôi cơ hội được mang sản phẩm và dịch vụ lọc nước tinh khiết đến phục vụ cuộc sống của Quý khách và Gia đình.</p>
  <p>Dựa trên nhu cầu thực tế của Quý khách, chúng tôi xin gửi đến Thư chào giá đối với công việc: <b>“${esc(jobName)}”</b>. Chúng tôi đã nghiên cứu kỹ lưỡng để đưa ra phương án tối ưu nhất dưới đây, với hy vọng đáp ứng trọn vẹn các tiêu chuẩn và kỳ vọng của Quý khách.</p>
  <p>SWD cam kết mang đến giải pháp tối ưu, không chỉ đáp ứng các yêu cầu kỹ thuật mà còn đem lại sự an tâm tuyệt đối cho Quý khách trong suốt quá trình sử dụng. Chúng tôi mong sớm được bắt tay triển khai dự án cùng Quý khách.</p>
  ${letter?.extraNote ? `<p>${esc(letter.extraNote)}</p>` : ''}
  <p>Trân trọng cảm ơn Quý khách!</p>
</div>

<!-- ═══ 3. BẢNG BÁO GIÁ CHI TIẾT ═══ -->
<div class="page">
  <h2 class="sec">3. Bảng báo giá chi tiết</h2>
  <p class="unit">Đơn vị tính: VNĐ</p>

  <table class="data">
    <thead>
      <tr>
        <th style="width:28px">STT</th>
        <th style="width:150px">Hạng mục</th>
        <th>Mô tả</th>
        <th style="width:42px">ĐVT</th>
        <th style="width:34px">SL</th>
        <th style="width:82px">Đơn giá</th>
        <th style="width:88px">Thành tiền</th>
        <th style="width:64px">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" class="c">Chưa có hạng mục nào</td></tr>'}
      <tr class="sumRow">
        <td colspan="6" class="r">Tổng cộng (chưa ưu đãi)</td>
        <td class="r">${fmtN(subtotal)}</td>
        <td></td>
      </tr>
      ${disc > 0 ? `
      <tr class="sumRow">
        <td colspan="6" class="r">Chiết khấu (${parseNum(disc)}%)</td>
        <td class="r" style="color:#B91C1C">- ${fmtN(discAmt)}</td>
        <td></td>
      </tr>` : ''}
      <tr class="totalRow">
        <td colspan="6" class="r">TỔNG GIÁ TRỊ (đã bao gồm VAT)</td>
        <td class="r">${fmtN(total)}</td>
        <td></td>
      </tr>
      <tr class="wordsRow">
        <td colspan="8">Bằng chữ: ${numberToVietnameseWords(total)} đồng</td>
      </tr>
    </tbody>
  </table>

  <p class="hint">Lưu ý: Đơn giá trên đã bao gồm chi phí khảo sát, tư vấn, vật tư kết nối, thi công lắp đặt và vận hành thử nghiệm (nếu không có ghi chú khác).</p>
</div>

<!-- ═══ 4–7 + KÝ TÊN ═══ -->
<div class="page">
  <h2 class="sec">4. Tiến độ thực hiện</h2>
  <p>Tổng tiến độ dự kiến: <b>${totalDays || '__'} ngày</b>, chi tiết như sau:</p>
  <table class="plain">
    <tr><td class="b" style="width:70%">Nội dung công việc</td><td class="b c">Thời gian dự kiến</td></tr>
    ${schedRows}
    <tr><td class="b">Tổng cộng</td><td class="b c">${totalDays || '__'} ngày</td></tr>
  </table>

  <h2 class="sec">5. Bảo hành &amp; dịch vụ bảo trì</h2>
  <ul>
    <li><b>${esc(warranty?.systemName || systemName)}</b>: bảo hành <b>${esc(warranty?.filterMonths || '06')} tháng</b> với vật tư lọc, <b>${esc(warranty?.partMonths || '24')} tháng</b> với linh kiện điện tử</li>
    <li>Các hệ thống và thiết bị khác: bảo hành theo chính sách của hãng sản xuất</li>
    <li>SWD hỗ trợ kiểm tra định kỳ và tư vấn thay thế vật tư trong suốt vòng đời sản phẩm</li>
    ${warranty?.extraNote ? `<li>${esc(warranty.extraNote)}</li>` : ''}
  </ul>

  <h2 class="sec">6. Điều khoản thanh toán (đề nghị)</h2>
  <table class="plain">${paymentRows}</table>
  ${paymentWarning}

  <h3 class="sub">Thông tin chuyển khoản</h3>
  <table class="bankTable">
    <tr><td>Tên tài khoản</td><td>${esc(bankInfo?.bankAccountName || COMPANY.name)}</td></tr>
    <tr><td>Số tài khoản</td><td>${esc(bankInfo?.bankAccountNumber || '803838')}</td></tr>
    <tr><td>Ngân hàng</td><td>${esc(bankInfo?.bankName || 'Ngân hàng TMCP Kỹ Thương Việt Nam - TECHCOMBANK')}</td></tr>
  </table>

  <h2 class="sec">7. Thông tin khác</h2>
  <ul>
    <li>Báo giá có hiệu lực trong vòng <b>${esc(quoteMeta?.validDays || 7)} ngày</b> kể từ ngày phát hành</li>
    <li>Các điều khoản chi tiết của Hợp đồng sẽ được hai bên thảo luận và ký kết khi Quý khách chấp nhận Thư chào giá này</li>
    <li>Mọi thắc mắc xin liên hệ trực tiếp người phụ trách để được hỗ trợ nhanh nhất</li>
    ${order?.note ? `<li>Ghi chú: ${esc(order.note)}</li>` : ''}
  </ul>

  <div class="sign">
    <p class="signTitle">Đại diện ${COMPANY.name}</p>
    <p class="signNote">(Ký, ghi rõ họ tên)</p>
    <p class="signName">${esc(repName)}</p>
    <p class="signPhone">Hotline: ${esc(repPhone)}</p>
  </div>
</div>

</body></html>`;
}

// ── Product Dropdown shared ───────────────────────────────────
function ProductDropdown({ catalog, onSelect, onClose }) {
    const [search, setSearch] = useState('');
    const filtered = catalog.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase())
    );
    return (
        <View style={S.dropWrap}>
            <View style={S.dropSearch}>
                <Ionicons name="search-outline" size={13} color="#94A3B8" />
                <TextInput
                    style={S.dropSearchInput}
                    placeholder="Tìm sản phẩm..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={13} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
                {filtered.length === 0 ? (
                    <Text style={S.dropEmpty}>Không tìm thấy</Text>
                ) : filtered.map((p, i) => (
                    <TouchableOpacity key={p.docId || i} style={S.dropItem}
                        onPress={() => { onSelect(p); onClose(); }} activeOpacity={0.7}>
                        <View style={S.dropItemIcon}>
                            <Ionicons name="water-outline" size={13} color="#185FA5" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.dropItemName} numberOfLines={1}>{p.name}</Text>
                            {p.capacity && <Text style={S.dropItemCap}>{p.capacity}</Text>}
                        </View>
                        <Text style={S.dropItemPrice}>
                            {(p.price || p.price_a || 0).toLocaleString('vi-VN')}đ
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View >
    );
}

// ── Template Form (mode=template) ────────────────────────────
function TemplateForm({ form, setForm, catalog }) {
    const [openDropIdx, setOpenDropIdx] = useState(null);

    const addProduct = () => setForm(f => ({
        ...f,
        items: [...(f.items || []), { name: '', desc: '', unit: 'Bộ', qty: '1', price: '', note: '' }],
    }));

    const removeProduct = (i) => setForm(f => ({
        ...f,
        items: (f.items || []).filter((_, idx) => idx !== i),
    }));

    const updateItem = (i, field, val) => setForm(f => {
        const items = (f.items || []).map((p, idx) =>
            idx === i ? { ...p, [field]: val } : p
        );
        return { ...f, items };
    });

    const selectProduct = (i, prod) => {
        setForm(f => {
            const items = (f.items || []).map((p, idx) =>
                idx === i ? {
                    ...p,
                    name: prod.name,
                    desc: p.desc || prod.capacity || prod.description || '',
                    price: String(prod.price || prod.price_a || 0),
                } : p
            );
            return { ...f, items };
        });
        setOpenDropIdx(null);
    };

    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thông tin khách hàng</Text>
            <HR />

            <Text style={S.fieldLabel}>Tên khách hàng</Text>
            <TextInput style={S.input} placeholder="Nguyễn Văn A" placeholderTextColor="#CBD5E1"
                value={form.customer} onChangeText={v => setForm(f => ({ ...f, customer: v }))} />
            <Text style={S.fieldLabel}>Số điện thoại</Text>
            <TextInput style={S.input} placeholder="0901 234 567" keyboardType="phone-pad" placeholderTextColor="#CBD5E1"
                value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
            <Text style={S.fieldLabel}>Địa chỉ công trình / giao hàng</Text>
            <TextInput style={[S.input, { minHeight: 56 }]} placeholder="123 Đường ABC, Q.1, TP.HCM"
                multiline placeholderTextColor="#CBD5E1"
                value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} />

            <HR />
            <Text style={S.subHead}>Hạng mục sản phẩm</Text>

            {(form.items || []).map((p, i) => (
                <View key={i} style={S.prodFormRow}>
                    <View style={S.prodFormHeader}>
                        <Text style={S.prodFormIdx}>#{i + 1}</Text>
                        {(form.items || []).length > 1 && (
                            <TouchableOpacity onPress={() => removeProduct(i)}>
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={S.fieldLabel}>Hạng mục</Text>
                    <TouchableOpacity
                        style={[S.input, S.dropTrigger, openDropIdx === i && { borderColor: '#185FA5' }]}
                        onPress={() => setOpenDropIdx(openDropIdx === i ? null : i)}
                        activeOpacity={0.8}
                    >
                        <Text style={p.name ? S.dropTriggerText : S.dropTriggerPlaceholder} numberOfLines={1}>
                            {p.name || 'Chọn sản phẩm...'}
                        </Text>
                        <Ionicons name={openDropIdx === i ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
                    </TouchableOpacity>
                    {openDropIdx === i && (
                        <ProductDropdown
                            catalog={catalog}
                            onSelect={(prod) => selectProduct(i, prod)}
                            onClose={() => setOpenDropIdx(null)}
                        />
                    )}

                    {/* ✅ NEW: cột "Mô tả" của bảng báo giá */}
                    <Text style={S.fieldLabel}>Mô tả (tính năng chính)</Text>
                    <TextInput style={[S.input, { minHeight: 48 }]} multiline
                        placeholder="Mô tả ngắn gọn tính năng chính" placeholderTextColor="#CBD5E1"
                        value={p.desc || ''} onChangeText={v => updateItem(i, 'desc', v)} />

                    <View style={S.row2}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>ĐVT</Text>
                            <TextInput style={S.input} placeholder="Bộ" placeholderTextColor="#CBD5E1"
                                value={p.unit ?? 'Bộ'} onChangeText={v => updateItem(i, 'unit', v)} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Số lượng</Text>
                            <TextInput style={S.input} keyboardType="numeric" placeholderTextColor="#CBD5E1"
                                value={String(p.qty ?? '')}
                                onChangeText={v => updateItem(i, 'qty', v)} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Đơn giá (đ)</Text>
                            <TextInput style={S.input} keyboardType="numeric" placeholderTextColor="#CBD5E1"
                                value={String(p.price ?? '')}
                                onChangeText={v => updateItem(i, 'price', v)} />
                        </View>
                    </View>

                    <Text style={S.fieldLabel}>Ghi chú</Text>
                    <TextInput style={S.input} placeholder="--" placeholderTextColor="#CBD5E1"
                        value={p.note || ''} onChangeText={v => updateItem(i, 'note', v)} />
                </View>
            ))}

            <TouchableOpacity style={S.addProdBtn} onPress={addProduct}>
                <Ionicons name="add" size={16} color="#185FA5" />
                <Text style={S.addProdText}>Thêm hạng mục</Text>
            </TouchableOpacity>

            <HR />
            <Text style={S.fieldLabel}>Ghi chú đơn hàng (hiện ở mục 7)</Text>
            <TextInput style={S.input} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#CBD5E1"
                value={form.note || ''} onChangeText={v => setForm(f => ({ ...f, note: v }))} />
        </View>
    );
}

// ── Thiết bị & Dịch vụ (nhập tay) ─────────────────────────────
function ServicesEditor({ services, setServices }) {
    const addService = () => setServices(s => [
        ...(s || []),
        { name: '', desc: '', qty: '1', unit: 'Gói', price: '', included: false, note: '' },
    ]);
    const removeService = (i) => setServices(s => (s || []).filter((_, idx) => idx !== i));
    const updateService = (i, field, val) => setServices(s => (s || []).map((sv, idx) =>
        idx === i ? { ...sv, [field]: val } : sv
    ));

    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thiết bị & Dịch vụ</Text>
            <Text style={S.svcHint}>Khảo sát, thi công, vật tư, vệ sinh... — nối tiếp vào bảng báo giá mục 3</Text>
            <HR />

            {(services || []).length === 0 && (
                <Text style={S.svcEmpty}>Chưa có dịch vụ nào. Bấm “Thêm dịch vụ” để bổ sung.</Text>
            )}

            {(services || []).map((sv, i) => (
                <View key={i} style={S.prodFormRow}>
                    <View style={S.prodFormHeader}>
                        <Text style={S.prodFormIdx}>#{i + 1}</Text>
                        <TouchableOpacity onPress={() => removeService(i)}>
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                    </View>

                    <Text style={S.fieldLabel}>Tên dịch vụ</Text>
                    <TextInput style={S.input} placeholder="Khảo sát, tư vấn & lên phương án triển khai"
                        placeholderTextColor="#CBD5E1"
                        value={sv.name} onChangeText={v => updateService(i, 'name', v)} />

                    <Text style={S.fieldLabel}>Mô tả</Text>
                    <TextInput style={[S.input, { minHeight: 44 }]} multiline
                        placeholder="Mô tả ngắn gọn" placeholderTextColor="#CBD5E1"
                        value={sv.desc || ''} onChangeText={v => updateService(i, 'desc', v)} />

                    <View style={S.row2}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>ĐVT</Text>
                            <TextInput style={S.input} placeholder="Gói" placeholderTextColor="#CBD5E1"
                                value={sv.unit || ''} onChangeText={v => updateService(i, 'unit', v)} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Số lượng</Text>
                            <TextInput style={S.input} keyboardType="numeric" placeholderTextColor="#CBD5E1"
                                value={String(sv.qty ?? '')} onChangeText={v => updateService(i, 'qty', v)} />
                        </View>
                    </View>

                    <Text style={S.fieldLabel}>Đơn giá (đ)</Text>
                    <TextInput
                        style={[S.input, sv.included && S.inputDisabled]}
                        keyboardType="numeric"
                        editable={!sv.included}
                        placeholder={sv.included ? 'Bao gồm' : '0'}
                        placeholderTextColor="#CBD5E1"
                        value={sv.included ? '' : String(sv.price ?? '')}
                        onChangeText={v => updateService(i, 'price', v)}
                    />

                    <TouchableOpacity
                        style={S.includedToggle}
                        onPress={() => updateService(i, 'included', !sv.included)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={sv.included ? 'checkbox' : 'square-outline'}
                            size={17}
                            color={sv.included ? '#185FA5' : '#94A3B8'}
                        />
                        <Text style={[S.includedToggleText, sv.included && { color: '#185FA5', fontWeight: '700' }]}>
                            Bao gồm (miễn phí)
                        </Text>
                    </TouchableOpacity>

                    <Text style={S.fieldLabel}>Ghi chú</Text>
                    <TextInput style={S.input} placeholder="--" placeholderTextColor="#CBD5E1"
                        value={sv.note || ''} onChangeText={v => updateService(i, 'note', v)} />
                </View>
            ))}

            <TouchableOpacity style={S.addProdBtn} onPress={addService}>
                <Ionicons name="add" size={16} color="#185FA5" />
                <Text style={S.addProdText}>Thêm dịch vụ</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── Thông tin hồ sơ chào giá (trang bìa + thư chào giá) ───────
function QuoteMetaEditor({ quoteMeta, setQuoteMeta }) {
    const set = (k) => (v) => setQuoteMeta(m => ({ ...m, [k]: v }));
    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thông tin hồ sơ chào giá</Text>
            <Text style={S.svcHint}>Hiển thị ở trang bìa và mục 2 — Thư chào giá</Text>
            <HR />

            <Text style={S.fieldLabel}>Tên công việc / hạng mục chào giá</Text>
            <TextInput style={[S.input, { minHeight: 48 }]} multiline
                placeholder="Cung cấp và lắp đặt hệ thống lọc nước tổng sinh hoạt"
                placeholderTextColor="#CBD5E1"
                value={quoteMeta.jobName} onChangeText={set('jobName')} />

            <Text style={S.fieldLabel}>Địa chỉ công trình</Text>
            <TextInput style={[S.input, { minHeight: 48 }]} multiline
                placeholder="Biệt thự ABC, Khu đô thị XYZ, Hà Nội" placeholderTextColor="#CBD5E1"
                value={quoteMeta.siteAddress} onChangeText={set('siteAddress')} />

            <Text style={S.fieldLabel}>Tên hệ thống / sản phẩm (mục “Về việc”)</Text>
            <TextInput style={S.input} placeholder="Hệ thống lọc nước tổng sinh hoạt"
                placeholderTextColor="#CBD5E1"
                value={quoteMeta.systemName} onChangeText={set('systemName')} />

            <Text style={S.fieldLabel}>Tên công ty khách hàng (nếu có)</Text>
            <TextInput style={S.input} placeholder="CÔNG TY TNHH ..." placeholderTextColor="#CBD5E1"
                value={quoteMeta.company} onChangeText={set('company')} />

            <View style={S.row2}>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Mã số thuế KH</Text>
                    <TextInput style={S.input} placeholder="0319341685" placeholderTextColor="#CBD5E1"
                        value={quoteMeta.taxCode} onChangeText={set('taxCode')} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Hiệu lực (ngày)</Text>
                    <TextInput style={S.input} keyboardType="numeric" placeholder="7" placeholderTextColor="#CBD5E1"
                        value={String(quoteMeta.validDays ?? '')} onChangeText={set('validDays')} />
                </View>
            </View>

            <Text style={S.fieldLabel}>Số báo giá</Text>
            <TextInput style={S.input} placeholder="SWD-BG-20260903-KH" placeholderTextColor="#CBD5E1"
                value={quoteMeta.code} onChangeText={set('code')} />

            <HR />
            <Text style={S.subHead}>Người phụ trách</Text>
            <View style={S.row2}>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Họ tên</Text>
                    <TextInput style={S.input} placeholder={COMPANY.repName} placeholderTextColor="#CBD5E1"
                        value={quoteMeta.contactName} onChangeText={set('contactName')} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Điện thoại</Text>
                    <TextInput style={S.input} placeholder={COMPANY.repPhone} keyboardType="phone-pad"
                        placeholderTextColor="#CBD5E1"
                        value={quoteMeta.contactPhone} onChangeText={set('contactPhone')} />
                </View>
            </View>
        </View>
    );
}

// ── NEW: Dự án tiêu biểu (mục 1) — nội dung tự điền + chọn nhiều ảnh ──
function ProjectsEditor({ projects, setProjects }) {
    const [picking, setPicking] = useState(null); // index đang mở thư viện ảnh
    const rows = Array.isArray(projects) ? projects : [];
    const totalImages = rows.reduce((s, p) => s + (p.images || []).length, 0);

    const addProject = () => setProjects(p => [...(p || []), { title: '', desc: '', images: [] }]);
    const removeProject = (i) => setProjects(p => (p || []).filter((_, idx) => idx !== i));
    const updateProject = (i, field, val) => setProjects(p => (p || []).map((r, idx) =>
        idx === i ? { ...r, [field]: val } : r
    ));

    const addImages = async (i) => {
        if (picking !== null) return;      // tránh mở 2 lần chồng nhau
        setPicking(i);
        try {
            // Chốt chặn cuối: dù picker có treo thì sau 60s cũng nhả nút ra
            const picked = await Promise.race([
                pickImagesAsync(6),
                new Promise(res => setTimeout(() => res([]), 60000)),
            ]);
            if (picked.length) {
                setProjects(p => (p || []).map((r, idx) =>
                    idx === i ? { ...r, images: [...(r.images || []), ...picked].slice(0, 6) } : r
                ));
            }
        } catch (e) {
            console.warn('addImages error:', e);
        } finally {
            setPicking(null);
        }
    };

    const removeImage = (i, imgIdx) => setProjects(p => (p || []).map((r, idx) =>
        idx === i ? { ...r, images: (r.images || []).filter((_, k) => k !== imgIdx) } : r
    ));

    return (
        <View style={S.templateCard}>
            <View style={S.calcHeader}>
                <Text style={[S.sectionHead, { flex: 1 }]}>Dự án tiêu biểu</Text>
                <View style={[S.editBadge, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="images-outline" size={11} color="#185FA5" />
                    <Text style={S.editBadgeText}>{totalImages} ảnh</Text>
                </View>
            </View>
            <Text style={S.svcHint}>
                Mục 1 của hồ sơ — ảnh tự phân bổ cân đối (1 ảnh: khổ lớn · 2–4 ảnh: 2 cột · 5–6 ảnh: 3 cột).
                Chứng chỉ đã có sẵn 8 ảnh mặc định, không cần chọn.
            </Text>
            <HR />

            {rows.length === 0 && (
                <Text style={S.svcEmpty}>Chưa có dự án nào — hồ sơ sẽ in danh sách dự án mặc định.</Text>
            )}

            {rows.map((p, i) => (
                <View key={i} style={S.prodFormRow}>
                    <View style={S.prodFormHeader}>
                        <Text style={S.prodFormIdx}>Dự án {i + 1}</Text>
                        <TouchableOpacity onPress={() => removeProject(i)}>
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                    </View>

                    <Text style={S.fieldLabel}>Tên dự án</Text>
                    <TextInput style={S.input} placeholder="Dự án cứu trợ miền Trung"
                        placeholderTextColor="#CBD5E1"
                        value={p.title || ''} onChangeText={v => updateProject(i, 'title', v)} />

                    <Text style={S.fieldLabel}>Mô tả</Text>
                    <TextInput style={[S.input, { minHeight: 56 }]} multiline
                        placeholder="Máy lọc nước dã chiến cho người dân vùng lũ..."
                        placeholderTextColor="#CBD5E1"
                        value={p.desc || ''} onChangeText={v => updateProject(i, 'desc', v)} />

                    {/* Ảnh dự án */}
                    <Text style={S.fieldLabel}>Ảnh dự án ({(p.images || []).length}/6)</Text>
                    <View style={S.thumbGrid}>
                        {(p.images || []).map((uri, k) => (
                            <View key={k} style={S.thumbWrap}>
                                <Image source={{ uri }} style={S.thumb} resizeMode="cover" />
                                <TouchableOpacity style={S.thumbRemove} onPress={() => removeImage(i, k)}>
                                    <Ionicons name="close" size={11} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {(p.images || []).length < 6 && (
                            <TouchableOpacity
                                style={S.thumbAdd}
                                onPress={() => addImages(i)}
                                disabled={picking === i}
                                activeOpacity={0.7}
                            >
                                {picking === i
                                    ? <ActivityIndicator size="small" color="#185FA5" />
                                    : <Ionicons name="add" size={20} color="#185FA5" />}
                                <Text style={S.thumbAddText}>Chọn ảnh</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ))}

            <TouchableOpacity style={S.addProdBtn} onPress={addProject}>
                <Ionicons name="add" size={16} color="#185FA5" />
                <Text style={S.addProdText}>Thêm dự án</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── NEW: Tiến độ thực hiện (mục 4) ────────────────────────────
function ScheduleEditor({ schedule, setSchedule }) {
    const rows = Array.isArray(schedule) ? schedule : [];
    const totalDays = rows.reduce((s, r) => s + parseNum(r.days), 0);

    const addRow = () => setSchedule(s => [...(s || []), { task: '', days: '' }]);
    const removeRow = (i) => setSchedule(s => (s || []).filter((_, idx) => idx !== i));
    const updateRow = (i, field, val) => setSchedule(s => (s || []).map((r, idx) =>
        idx === i ? { ...r, [field]: val } : r
    ));

    return (
        <View style={S.templateCard}>
            <View style={S.calcHeader}>
                <Text style={[S.sectionHead, { flex: 1 }]}>Tiến độ thực hiện</Text>
                <View style={[S.editBadge, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="time-outline" size={11} color="#185FA5" />
                    <Text style={S.editBadgeText}>{totalDays} ngày</Text>
                </View>
            </View>
            <Text style={S.svcHint}>Mục 4 của hồ sơ — tổng số ngày tự cộng</Text>
            <HR />

            {rows.map((r, i) => (
                <View key={i} style={S.prodFormRow}>
                    <View style={S.prodFormHeader}>
                        <Text style={S.prodFormIdx}>Bước {i + 1}</Text>
                        <TouchableOpacity onPress={() => removeRow(i)}>
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                    <Text style={S.fieldLabel}>Nội dung công việc</Text>
                    <TextInput style={S.input} placeholder="Sản xuất, vận chuyển thiết bị đến công trình"
                        placeholderTextColor="#CBD5E1"
                        value={r.task || ''} onChangeText={v => updateRow(i, 'task', v)} />
                    <Text style={S.fieldLabel}>Thời gian dự kiến (ngày)</Text>
                    <TextInput style={S.input} keyboardType="numeric" placeholder="5" placeholderTextColor="#CBD5E1"
                        value={String(r.days ?? '')} onChangeText={v => updateRow(i, 'days', v)} />
                </View>
            ))}

            <TouchableOpacity style={S.addProdBtn} onPress={addRow}>
                <Ionicons name="add" size={16} color="#185FA5" />
                <Text style={S.addProdText}>Thêm bước</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── NEW: Bảo hành & bảo trì (mục 5) ───────────────────────────
function WarrantyEditor({ warranty, setWarranty }) {
    const set = (k) => (v) => setWarranty(w => ({ ...w, [k]: v }));
    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Bảo hành & bảo trì</Text>
            <Text style={S.svcHint}>Mục 5 của hồ sơ</Text>
            <HR />
            <Text style={S.fieldLabel}>Tên hệ thống chính</Text>
            <TextInput style={S.input} placeholder="Hệ thống lọc tổng sinh hoạt" placeholderTextColor="#CBD5E1"
                value={warranty.systemName} onChangeText={set('systemName')} />
            <View style={S.row2}>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Vật tư lọc (tháng)</Text>
                    <TextInput style={S.input} keyboardType="numeric" placeholder="06" placeholderTextColor="#CBD5E1"
                        value={String(warranty.filterMonths ?? '')} onChangeText={set('filterMonths')} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Linh kiện điện tử (tháng)</Text>
                    <TextInput style={S.input} keyboardType="numeric" placeholder="24" placeholderTextColor="#CBD5E1"
                        value={String(warranty.partMonths ?? '')} onChangeText={set('partMonths')} />
                </View>
            </View>
            <Text style={S.fieldLabel}>Điều khoản bổ sung (tuỳ chọn)</Text>
            <TextInput style={[S.input, { minHeight: 48 }]} multiline
                placeholder="Ví dụ: miễn phí vệ sinh định kỳ 2 lần/năm..." placeholderTextColor="#CBD5E1"
                value={warranty.extraNote || ''} onChangeText={set('extraNote')} />
        </View>
    );
}

// ── Ngân hàng + Người gửi ─────────────────────────────────────
function BankInfoEditor({ bankInfo, setBankInfo }) {
    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Ngân hàng & Người gửi</Text>
            <Text style={S.svcHint}>Hiển thị ở mục 6 và phần ký tên cuối hồ sơ</Text>
            <HR />

            <Text style={S.subHead}>Thông tin ngân hàng</Text>
            <Text style={S.fieldLabel}>Tên chủ tài khoản</Text>
            <TextInput style={S.input} placeholder={COMPANY.name} placeholderTextColor="#CBD5E1"
                value={bankInfo.bankAccountName} onChangeText={v => setBankInfo(b => ({ ...b, bankAccountName: v }))} />
            <Text style={S.fieldLabel}>Số tài khoản</Text>
            <TextInput style={S.input} placeholder="0123456789" keyboardType="numeric" placeholderTextColor="#CBD5E1"
                value={bankInfo.bankAccountNumber} onChangeText={v => setBankInfo(b => ({ ...b, bankAccountNumber: v }))} />
            <Text style={S.fieldLabel}>Ngân hàng</Text>
            <TextInput style={S.input} placeholder="Techcombank" placeholderTextColor="#CBD5E1"
                value={bankInfo.bankName} onChangeText={v => setBankInfo(b => ({ ...b, bankName: v }))} />

            <HR />
            <Text style={S.subHead}>Người gửi báo giá</Text>
            <Text style={S.fieldLabel}>Họ tên người gửi</Text>
            <TextInput style={S.input} placeholder={COMPANY.repName} placeholderTextColor="#CBD5E1"
                value={bankInfo.senderName} onChangeText={v => setBankInfo(b => ({ ...b, senderName: v }))} />
            <Text style={S.fieldLabel}>Số điện thoại người gửi</Text>
            <TextInput style={S.input} placeholder={COMPANY.repPhone} keyboardType="phone-pad" placeholderTextColor="#CBD5E1"
                value={bankInfo.senderPhone} onChangeText={v => setBankInfo(b => ({ ...b, senderPhone: v }))} />
        </View>
    );
}

// ── Điều khoản thanh toán theo nhiều đợt (tối đa 4 đợt) ───────
function PaymentTermsEditor({ paymentTerms, setPaymentTerms, total }) {
    const terms = Array.isArray(paymentTerms) && paymentTerms.length ? paymentTerms : [];
    const totalPercent = terms.reduce((s, t) => s + parseNum(t.percent), 0);
    const isValid = totalPercent === 100;

    const addTerm = () => {
        if (terms.length >= MAX_PAYMENT_TERMS) return;
        setPaymentTerms(t => [...(t || []), { percent: '', dueLabel: '' }]);
    };
    const removeTerm = (i) => setPaymentTerms(t => (t || []).filter((_, idx) => idx !== i));
    const updateTerm = (i, field, val) => setPaymentTerms(t => (t || []).map((p, idx) =>
        idx === i ? { ...p, [field]: val } : p
    ));

    return (
        <View style={S.templateCard}>
            <View style={S.calcHeader}>
                <Text style={[S.sectionHead, { flex: 1 }]}>Điều khoản thanh toán</Text>
                <View style={[S.editBadge, isValid ? S.percentBadgeOk : S.percentBadgeWarn]}>
                    <Ionicons name={isValid ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={11} color={isValid ? '#16A34A' : '#DC2626'} />
                    <Text style={[S.editBadgeText, { color: isValid ? '#16A34A' : '#DC2626' }]}>{totalPercent}%</Text>
                </View>
            </View>
            <Text style={S.svcHint}>Mục 6 — chia đợt theo % giá trị đơn hàng (tối đa {MAX_PAYMENT_TERMS} đợt)</Text>
            <HR />

            {terms.length === 0 && (
                <Text style={S.svcEmpty}>Chưa có đợt thanh toán nào. Bấm “Thêm đợt thanh toán” để bổ sung.</Text>
            )}

            {terms.map((t, i) => {
                const pct = parseNum(t.percent);
                const amt = (total || 0) * pct / 100;
                return (
                    <View key={i} style={S.prodFormRow}>
                        <View style={S.prodFormHeader}>
                            <Text style={S.prodFormIdx}>Đợt {i + 1}</Text>
                            <TouchableOpacity onPress={() => removeTerm(i)}>
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={S.row2}>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>% giá trị đơn hàng</Text>
                                <TextInput style={S.input} keyboardType="numeric" placeholder="50" placeholderTextColor="#CBD5E1"
                                    value={String(t.percent ?? '')} onChangeText={v => updateTerm(i, 'percent', v)} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.fieldLabel}>Mốc thanh toán</Text>
                                <TextInput style={S.input} placeholder="Ngay khi ký xác nhận đặt hàng" placeholderTextColor="#CBD5E1"
                                    value={t.dueLabel || ''} onChangeText={v => updateTerm(i, 'dueLabel', v)} />
                            </View>
                        </View>
                        {pct > 0 && (
                            <Text style={S.paymentTermAmt}>≈ {fmt(amt)}</Text>
                        )}
                    </View>
                );
            })}

            {terms.length < MAX_PAYMENT_TERMS && (
                <TouchableOpacity style={S.addProdBtn} onPress={addTerm}>
                    <Ionicons name="add" size={16} color="#185FA5" />
                    <Text style={S.addProdText}>Thêm đợt thanh toán</Text>
                </TouchableOpacity>
            )}

            <HR />
            <View style={S.discRow}>
                <Text style={S.calcFieldLabel}>Tổng tỷ lệ đã nhập</Text>
                <Text style={[S.totalPercentVal, isValid ? S.totalPercentOk : S.totalPercentWarn]}>
                    {totalPercent}% {isValid ? '· Đủ 100%' : '· Chưa đủ 100%'}
                </Text>
            </View>
        </View>
    );
}

// ── Calculator ────────────────────────────────────────────────
function Calculator({ items: itemsProp, services: servicesProp, orderType, disc, setDisc }) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];
    const services = Array.isArray(servicesProp) ? servicesProp : [];

    const itemsSubtotal = items.reduce((s, p) => s + parseNum(p.price) * parseNum(p.qty), 0);
    const servicesSubtotal = services.reduce((s, sv) => s + (sv.included ? 0 : parseNum(sv.price) * parseNum(sv.qty || 1)), 0);
    const subtotal = itemsSubtotal + servicesSubtotal;
    const discAmt = subtotal * (parseNum(disc) / 100);
    const total = subtotal - discAmt;

    return (
        <View style={S.calcCard}>
            <View style={S.calcHeader}>
                <View style={S.calcIcon}>
                    <Ionicons name="calculator-outline" size={16} color="#185FA5" />
                </View>
                <Text style={S.calcTitle}>Tóm tắt thanh toán</Text>
                <View style={[S.editBadge, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="lock-closed-outline" size={10} color="#64748B" />
                    <Text style={[S.editBadgeText, { color: '#64748B' }]}>Chốt số liệu</Text>
                </View>
            </View>
            <HR />

            {items.map((p, i) => (
                <View key={`i-${i}`} style={S.calcRow}>
                    <View style={S.calcProdIcon}>
                        <Ionicons name="water-outline" size={12} color="#185FA5" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={S.calcProdName} numberOfLines={1}>{p.name || 'Sản phẩm chưa đặt tên'}</Text>
                        <View style={S.calcInputs}>
                            <Text style={S.readOnlyLabel}>SL: <Text style={S.readOnlyVal}>{p.qty}</Text></Text>
                            <Text style={S.readOnlyLabel}>Đơn giá: <Text style={S.readOnlyVal}>{fmt(p.price)}</Text></Text>
                            <Text style={[S.readOnlyLabel, { marginLeft: 'auto' }]}>
                                Tổng: <Text style={{ fontWeight: '700', color: '#185FA5' }}>{fmt(parseNum(p.price) * parseNum(p.qty))}</Text>
                            </Text>
                        </View>
                    </View>
                </View>
            ))}

            {services.length > 0 && (
                <>
                    {items.length > 0 && <HR />}
                    <Text style={S.calcSvcHead}>Thiết bị & Dịch vụ</Text>
                    {services.map((sv, i) => (
                        <View key={`s-${i}`} style={S.calcRow}>
                            <View style={[S.calcProdIcon, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="construct-outline" size={12} color="#64748B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={S.calcProdName} numberOfLines={1}>{sv.name || 'Dịch vụ chưa đặt tên'}</Text>
                                <View style={S.calcInputs}>
                                    <Text style={S.readOnlyLabel}>SL: <Text style={S.readOnlyVal}>{sv.qty}</Text></Text>
                                    <Text style={S.readOnlyLabel}>
                                        Đơn giá: <Text style={S.readOnlyVal}>{sv.included ? 'Bao gồm' : fmt(sv.price)}</Text>
                                    </Text>
                                    <Text style={[S.readOnlyLabel, { marginLeft: 'auto' }]}>
                                        Tổng: <Text style={{ fontWeight: '700', color: '#185FA5' }}>
                                            {sv.included ? 'Bao gồm' : fmt(parseNum(sv.price) * parseNum(sv.qty))}
                                        </Text>
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </>
            )}

            <HR />
            <View style={S.discRow}>
                <Text style={S.calcFieldLabel}>Chiết khấu áp dụng (%)</Text>
                <TInput
                    value={String(disc ?? '')}
                    onChange={v => setDisc(v)}
                    keyboardType="numeric"
                    style={{ width: 64 }}
                    placeholder="0"
                />
            </View>
            <HR />

            <View style={S.statRow}><Text style={S.statLabel}>Tổng tiền hàng</Text><Text style={S.statVal}>{fmt(subtotal)}</Text></View>
            <View style={S.statRow}><Text style={S.statLabel}>Tiền chiết khấu</Text><Text style={[S.statVal, { color: '#A32D2D' }]}>- {fmt(discAmt)}</Text></View>
            <View style={S.totalRow}>
                <Text style={S.totalLabel}>Tổng giá trị (đã gồm VAT)</Text>
                <Text style={S.totalVal}>{fmt(total)}</Text>
            </View>
            {/* ✅ NEW: dòng "Bằng chữ" giống mục 3 của hồ sơ */}
            <Text style={S.wordsText}>Bằng chữ: {numberToVietnameseWords(total)} đồng</Text>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function OrderContractScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { userDetail } = useContext(UserDetailContext);
    const { isDesktop } = useLayout();

    const mode = params.mode || 'order';
    const rawOrder = params.orderParam ? (() => { try { return JSON.parse(params.orderParam); } catch { return {}; } })() : {};

    // Template form state
    const [form, setForm] = useState({
        customer: '', phone: '', address: '',
        orderType: 'le', paymentMethod: 'customer', note: '',
        items: [{ name: '', desc: '', unit: 'Bộ', qty: '1', price: '', note: '' }],
    });

    const orderProducts = productItems(rawOrder);
    const safeItems = orderProducts.length > 0
        ? orderProducts
        : mode === 'order' ? [] : form.items;

    const [items, setItems] = useState(safeItems);
    const [services, setServices] = useState(rawOrder.services || []);

    // ✅ Thông tin hồ sơ (trang bìa + thư chào giá)
    const [quoteMeta, setQuoteMeta] = useState({
        company: rawOrder.customerCompany || '',
        taxCode: rawOrder.customerTaxCode || '',
        validDays: '7',
        code: '',
        jobName: '',
        siteAddress: rawOrder.address || '',
        systemName: '',
        contactName: COMPANY.repName,
        contactPhone: COMPANY.repPhone,
    });

    // ✅ Tiến độ thực hiện (mục 4) — mặc định 3 bước theo template
    const [schedule, setSchedule] = useState([
        { task: 'Sản xuất, vận chuyển thiết bị đến công trình', days: '' },
        { task: 'Lắp đặt, điều chỉnh, vận hành thử nghiệm', days: '' },
        { task: 'Chạy thử và bàn giao', days: '' },
    ]);

    // ✅ Dự án tiêu biểu (mục 1) — nội dung + ảnh do người dùng nhập
    const [projects, setProjects] = useState([
        { title: 'Dự án cứu trợ miền Trung', desc: 'Máy lọc nước dã chiến cho người dân vùng lũ', images: [] },
        { title: 'Dự án cứu trợ Myanmar', desc: 'Phối hợp cùng Học viện Nguyên Thủy và các mạnh thường quân', images: [] },
    ]);

    // ✅ 8 ảnh chứng chỉ mặc định — nạp sẵn 1 lần để lúc xuất PDF không phải chờ
    const [certImages, setCertImages] = useState([]);
    useEffect(() => {
        let cancelled = false;
        getBase64Certs().then(list => { if (!cancelled) setCertImages(list); });
        return () => { cancelled = true; };
    }, []);

    // ✅ Bảo hành (mục 5)
    const [warranty, setWarranty] = useState({
        systemName: '', filterMonths: '06', partMonths: '24', extraNote: '',
    });

    const [bankInfo, setBankInfo] = useState({
        bankAccountName: '', bankAccountNumber: '', bankName: '',
        senderName: '', senderPhone: '',
    });

    // ✅ Điều khoản thanh toán — mặc định 50/30/20 theo template mới
    const [paymentTerms, setPaymentTerms] = useState([
        { percent: '50', dueLabel: 'Tạm ứng ngay khi ký xác nhận đặt hàng' },
        { percent: '30', dueLabel: 'Trước khi giao hàng đến chân công trình' },
        { percent: '20', dueLabel: 'Sau khi hoàn thành lắp đặt, vận hành và bàn giao' },
    ]);
    const [disc, setDisc] = useState('0');
    const [exporting, setExporting] = useState(false);

    // Catalog sản phẩm
    const [catalog, setCatalog] = useState([]);
    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => setCatalog(
                snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0))
            ))
            .catch(e => console.warn('catalog fetch:', e));
    }, []);

    // Dịch vụ của đơn
    useEffect(() => {
        if (mode !== 'order' || !rawOrder?.id) return;
        let cancelled = false;
        getDocs(query(collection(db, 'service'), where('orderId', '==', rawOrder.id)))
            .then(snap => {
                if (cancelled || snap.empty) return;
                const rows = snap.docs.map(d => {
                    const sv = d.data();
                    return {
                        name: sv.name || sv.type || 'Dịch vụ',
                        desc: sv.desc || sv.description || '',
                        qty: String(sv.qty ?? 1),
                        unit: sv.unit || 'Gói',
                        price: String(sv.price ?? 0),
                        included: !!sv.included,
                        note: '',
                    };
                });
                setServices(prev => (prev && prev.length > 0) ? prev : rows);
            })
            .catch(e => console.warn('fetch order services:', e));
        return () => { cancelled = true; };
    }, [mode, rawOrder?.id]);

    // Gợi ý ngân hàng / người gửi từ hồ sơ user
    useEffect(() => {
        if (!userDetail) return;
        setBankInfo(b => ({
            bankAccountName: b.bankAccountName || userDetail.bankAccountName || '',
            bankAccountNumber: b.bankAccountNumber || userDetail.bankAccountNumber || '',
            bankName: b.bankName || userDetail.bankName || '',
            senderName: b.senderName || userDetail.name || '',
            senderPhone: b.senderPhone || userDetail.phone || '',
        }));
    }, [userDetail]);

    // Derived
    const order = mode === 'order' ? rawOrder : form;
    const safeCalc = Array.isArray(items) ? items : [];
    const safeServices = Array.isArray(services) ? services : [];
    const itemsSubtotal = safeCalc.reduce((s, p) => s + parseNum(p.price) * parseNum(p.qty), 0);
    const servicesSubtotal = safeServices.reduce((s, sv) => s + (sv.included ? 0 : parseNum(sv.price) * parseNum(sv.qty || 1)), 0);
    const subtotal = itemsSubtotal + servicesSubtotal;
    const discAmt = subtotal * (parseNum(disc) / 100);
    const total = subtotal - discAmt;

    // Sync items từ form khi mode=template
    useEffect(() => {
        if (mode === 'template' && Array.isArray(form.items)) {
            setItems(form.items);
        }
    }, [form.items, mode]);

    // Địa chỉ công trình mặc định lấy theo địa chỉ đơn/form nếu chưa nhập tay
    useEffect(() => {
        const addr = mode === 'order' ? rawOrder.address : form.address;
        if (!addr) return;
        setQuoteMeta(m => (m.siteAddress ? m : { ...m, siteAddress: addr }));
    }, [mode, rawOrder.address, form.address]);

    const handleFormChange = (nextForm) => setForm(nextForm);

    // ✅ NEW: form chia 3 cột trên desktop rộng, tự co xuống 2 cột / 1 cột khi hẹp
    const { width } = useWindowDimensions();
    const colCount = !isDesktop ? 1 : width >= 1240 ? 3 : width >= 880 ? 2 : 1;

    // Các khối nhập liệu — khai báo 1 lần rồi phân bổ vào cột
    const B = {
        quoteMeta: <QuoteMetaEditor key="quoteMeta" quoteMeta={quoteMeta} setQuoteMeta={setQuoteMeta} />,
        projects: <ProjectsEditor key="projects" projects={projects} setProjects={setProjects} />,
        customer: mode === 'template'
            ? <TemplateForm key="customer" form={form} setForm={handleFormChange} catalog={catalog} />
            : null,
        services: <ServicesEditor key="services" services={safeServices} setServices={setServices} />,
        schedule: <ScheduleEditor key="schedule" schedule={schedule} setSchedule={setSchedule} />,
        warranty: <WarrantyEditor key="warranty" warranty={warranty} setWarranty={setWarranty} />,
        payment: <PaymentTermsEditor key="payment" paymentTerms={paymentTerms} setPaymentTerms={setPaymentTerms} total={total} />,
        bank: <BankInfoEditor key="bank" bankInfo={bankInfo} setBankInfo={setBankInfo} />,
        calc: (
            <Calculator
                key="calc"
                items={safeCalc}
                services={safeServices}
                orderType={order.orderType || 'le'}
                disc={disc}
                setDisc={setDisc}
            />
        ),
    };

    const LAYOUTS = {
        3: [
            { title: 'Thông tin hồ sơ', keys: ['quoteMeta', 'customer'] },
            { title: 'Giới thiệu & hạng mục', keys: ['projects', 'services', 'schedule', 'warranty'] },
            { title: 'Thanh toán', keys: ['payment', 'bank', 'calc'] },
        ],
        2: [
            { title: 'Thông tin & hạng mục', keys: ['quoteMeta', 'customer', 'projects', 'services'] },
            { title: 'Tiến độ & thanh toán', keys: ['schedule', 'warranty', 'payment', 'bank', 'calc'] },
        ],
        1: [
            { title: '', keys: ['quoteMeta', 'customer', 'projects', 'services', 'schedule', 'warranty', 'payment', 'bank', 'calc'] },
        ],
    };

    const columns = LAYOUTS[colCount].map(col => ({
        title: col.title,
        blocks: col.keys.map(k => B[k]).filter(Boolean),
    }));

    const handleExport = async () => {
        setExporting(true);
        try {
            const logoBase64 = await getBase64Logo();
            const certs = certImages.length ? certImages : await getBase64Certs();
            const html = buildPDFHtml({
                order, seller: userDetail, items: safeCalc, services: safeServices,
                quoteMeta, disc, subtotal, total, discAmt, logoBase64,
                bankInfo, paymentTerms, schedule, warranty, letter: {},
                projects, certImages: certs,
            });
            await exportPDF(html, isDesktop);
        } catch (e) { console.error(e); }
        finally { setExporting(false); }
    };

    // Chặn ngay tại màn, không chỉ ẩn ở menu: người dùng vẫn có thể tới đây bằng link
    // trực tiếp, nút back trong lịch sử, hoặc thu nhỏ cửa sổ trình duyệt khi đang mở.
    // Đặt SAU toàn bộ hook để không vi phạm rules of hooks.
    if (!isDesktop) {
        return (
            <View style={[S.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
                <BgWatermark />
                <Ionicons name="desktop-outline" size={44} color="#94A3B8" />
                <Text style={[S.hTitle, { marginTop: 14, textAlign: 'center' }]}>Chỉ dùng được trên máy tính</Text>
                <Text style={[S.hSub, { marginTop: 8, textAlign: 'center', maxWidth: 320 }]}>
                    Form báo giá cần màn hình rộng để nhập bảng nhiều cột và xuất PDF.
                    Vui lòng mở lại trên máy tính.
                </Text>
                <TouchableOpacity
                    style={[S.backBtn, { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6, width: 'auto', paddingHorizontal: 16 }]}
                    onPress={() => router.replace('(tabs)/home')}
                >
                    <Ionicons name="arrow-back" size={18} color="#0F172A" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Về trang chủ</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.replace('(tabs)/home')} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.hTitle}>
                        {mode === 'template' ? 'Hồ sơ chào giá mẫu' : `Đơn hàng #${rawOrder.id}`}
                    </Text>
                    <Text style={S.hSub}>
                        {mode === 'template' ? 'Điền thông tin để xuất hồ sơ chào giá' : rawOrder.customer}
                    </Text>
                </View>
                <TouchableOpacity style={S.pdfBtn} onPress={handleExport} disabled={exporting} activeOpacity={0.85}>
                    {exporting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="document-outline" size={15} color="#fff" />
                    }
                    <Text style={S.pdfBtnText}>{exporting ? 'Đang xuất...' : 'Xuất PDF'}</Text>
                </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={[S.body, isDesktop && S.bodyWeb]}
                keyboardShouldPersistTaps="handled"
            >
                {colCount === 1 ? (
                    <View style={{ gap: 12 }}>
                        {columns.flatMap(c => c.blocks)}
                    </View>
                ) : (
                    <View style={S.gridRow}>
                        {columns.map((col, ci) => (
                            <View key={ci} style={S.gridCol}>
                                <View style={S.colHead}>
                                    <View style={S.colHeadNum}>
                                        <Text style={S.colHeadNumText}>{ci + 1}</Text>
                                    </View>
                                    <Text style={S.colHeadText}>{col.title}</Text>
                                </View>
                                {col.blocks}
                            </View>
                        ))}
                    </View>
                )}
                <View style={{ height: 60 }} />
            </ScrollView>
        </View >
    );
}

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F6FA' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    hTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    hSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0C447C', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
    pdfBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    body: { padding: 14, paddingBottom: 40 },
    bodyWeb: { padding: 20 },
    // ✅ lưới nhập liệu: 3 cột (≥1240px) · 2 cột (≥880px) · 1 cột (mobile)
    gridRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    gridCol: { flex: 1, minWidth: 0, gap: 14 },
    colHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, marginBottom: -2 },
    colHeadNum: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#0C447C', alignItems: 'center', justifyContent: 'center' },
    colHeadNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    colHeadText: { fontSize: 12, fontWeight: '700', color: '#0C447C', textTransform: 'uppercase', letterSpacing: 0.4 },
    hr: { height: 0.5, backgroundColor: '#E2E8F0', marginVertical: 13 },
    templateCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0', marginBottom: 0 },
    sectionHead: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    subHead: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6 },
    fieldLabel: { fontSize: 11, color: '#64748B', marginBottom: 4, marginTop: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: '#0F172A' },
    inputDisabled: { color: '#CBD5E1' },
    row2: { flexDirection: 'row', gap: 10 },
    prodFormRow: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 0.5, borderColor: '#E2E8F0' },
    prodFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    prodFormIdx: { fontSize: 11, fontWeight: '700', color: '#185FA5' },
    addProdBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 9, backgroundColor: '#EFF6FF', marginTop: 10 },
    addProdText: { fontSize: 13, color: '#185FA5', fontWeight: '600' },
    svcHint: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
    // Ảnh dự án tiêu biểu
    thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    thumbWrap: { width: 74, height: 74, borderRadius: 8, overflow: 'visible' },
    thumb: { width: 74, height: 74, borderRadius: 8, backgroundColor: '#E2E8F0' },
    thumbRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
    thumbAdd: { width: 74, height: 74, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', gap: 2 },
    thumbAddText: { fontSize: 10, color: '#185FA5', fontWeight: '600' },
    svcEmpty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 },
    includedToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, paddingVertical: 2 },
    includedToggleText: { fontSize: 11.5, color: '#64748B', flexShrink: 1 },
    percentBadgeOk: { backgroundColor: '#F0FDF4' },
    percentBadgeWarn: { backgroundColor: '#FEF2F2' },
    paymentTermAmt: { fontSize: 11, color: '#185FA5', fontWeight: '600', marginTop: 8 },
    totalPercentVal: { fontSize: 13, fontWeight: '700' },
    totalPercentOk: { color: '#16A34A' },
    totalPercentWarn: { color: '#DC2626' },
    calcCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0' },
    calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    calcIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    calcTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
    editBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    editBadgeText: { fontSize: 10, color: '#185FA5', fontWeight: '700' },
    calcSvcHead: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 2, textTransform: 'uppercase', letterSpacing: .04 },
    calcRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
    calcProdIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    dropWrap: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#E2E8F0', marginTop: 2, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    dropSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    dropSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    dropItemIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    dropItemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    dropItemCap: { fontSize: 11, color: '#94A3B8' },
    dropItemPrice: { fontSize: 12, fontWeight: '600', color: '#185FA5' },
    dropEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    dropTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dropTriggerText: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '500' },
    dropTriggerPlaceholder: { flex: 1, fontSize: 13, color: '#CBD5E1' },
    calcProdName: { fontSize: 12, fontWeight: '600', color: '#0F172A', marginBottom: 6 },
    calcInputs: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    calcFieldLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    tInput: { fontSize: 13, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center' },
    discRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    statLabel: { fontSize: 12, color: '#64748B' },
    statVal: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: '#E2E8F0', marginTop: 4 },
    totalLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    totalVal: { fontSize: 17, fontWeight: '700', color: '#185FA5' },
    wordsText: { fontSize: 11.5, fontStyle: 'italic', color: '#475569', marginTop: 8 },
    readOnlyLabel: { fontSize: 12, color: '#64748B', marginRight: 10 },
    readOnlyVal: { fontWeight: '600', color: '#0F172A' },
});