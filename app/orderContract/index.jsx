// app/orderContract/index.jsx
// Màn tính toán + hợp đồng đơn hàng
// mode=order  → pre-fill từ đơn hàng có sẵn
// mode=template → điền tay, không lưu DB
// Xuất PDF: web dùng window.print(), mobile dùng expo-print
// ✅ Đã bỏ phần preview hợp đồng trên màn hình — form nhập liệu chia 2 cột
// ✅ Đã sửa lỗi font (bold weight 800 → 700) cho các tiêu đề
// ✅ Bổ sung: form nhập thông tin ngân hàng / người gửi / SĐT người gửi
// ✅ Bổ sung: điều khoản thanh toán theo nhiều đợt (tối đa 4 đợt), tự kiểm tra tổng % = 100%

import BgWatermark from '@/components/Main/BgWatermark';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/components/Main/TabScreenLayout';


const fmt = (n) => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
const fmtN = (n) => Math.round(n || 0).toLocaleString('vi-VN');
const COMM = { buon: 0.03, le: 0.05 };
const parseNum = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
const MAX_PAYMENT_TERMS = 4;

// ── Mã báo giá tự sinh: SWD-YYYY-MM-DD-TENKH-1 (có thể ghi đè trong quoteMeta.code) ──
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
    return `SWD-${y}-${m}-${d}-${custSlug}-1`;
}

// ── Chuẩn hoá danh sách đợt thanh toán (fallback 1 đợt 100%) ──
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
            onChangeText={onChange}           // ← trả về string thô, không parse ở đây
            selectTextOnFocus
            placeholder={placeholder}
            placeholderTextColor="#CBD5E1"
        />
    );
}

// ── Divider ───────────────────────────────────────────────────
const HR = () => <View style={S.hr} />;

// ── Xuất PDF ─────────────────────────────────────────────────
async function getBase64Logo() {
    try {
        const { Asset } = await import('expo-asset');
        const asset = Asset.fromModule(require('../../assets/images/logo-light.png'));
        await asset.downloadAsync();

        // Nếu là web, dùng fetch để lấy base64
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('getBase64Logo failed:', e.message);
        return null;
    }
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
            Alert.alert('Lỗi', 'Không thể xuất PDF: ' + e.message);
        }
    }
}

// ── PDF: bảng theo mẫu (header công ty · thanh BÁO GIÁ · 3 cột info · bảng nhóm I/II · tổng · điều khoản/ngân hàng · banner kết) ──
function buildPDFHtml({ order, seller, items: itemsProp, services: servicesProp, quoteMeta, disc, subtotal, total, discAmt, logoBase64, bankInfo, paymentTerms }) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];
    const services = Array.isArray(servicesProp) ? servicesProp : [];
    const hdNum = buildQuoteCode(order, quoteMeta);
    const today = new Date().toLocaleDateString('vi-VN');
    const { terms, totalPercent } = normalizePaymentTerms(paymentTerms);

    // ── Nhóm I: sản phẩm | Nhóm II: thiết bị & dịch vụ (nhập tay) ──
    const groups = [];
    if (items.length) groups.push({ roman: 'I', label: 'MÁY LỌC TỔNG SINH HOẠT', rows: items, defUnit: 'Cái' });
    if (services.length) groups.push({ roman: groups.length ? 'II' : 'I', label: 'THIẾT BỊ & DỊCH VỤ', rows: services, defUnit: 'Gói' });

    let groupsHtml = '';
    groups.forEach((g) => {
        const rows = g.rows.map((p, i) => {
            const isIncluded = p.included === true;
            const lineTotal = isIncluded ? 0 : (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 1);
            return `
            <tr>
                <td class="c">${String(i + 1).padStart(2, '0')}</td>
                <td>${p.name || ''}</td>
                <td class="c">${fmtN(p.qty || 1)}</td>
                <td class="c">${p.origin || 'SWD - Việt Nam'}</td>
                <td class="c">${p.unit || g.defUnit}</td>
                <td class="r">${isIncluded ? '—' : fmtN(p.price)}</td>
                <td class="r b ${isIncluded ? 'included' : ''}">${isIncluded ? 'Bao gồm' : fmtN(lineTotal)}</td>
            </tr>`;
        }).join('');

        groupsHtml += `
        <tr class="groupRow"><td colspan="7">${g.roman} — ${g.label}</td></tr>
        ${rows}`;
    });

    // ── Điều khoản thanh toán theo đợt ──
    const paymentTermsHtml = terms.map((t, i) => {
        const pct = parseNum(t.percent);
        const amt = total * pct / 100;
        return `<li class="highlight">Đợt ${i + 1}: ${pct}% giá trị đơn hàng (${fmtN(amt)}đ)${t.dueLabel ? ` — Hạn: ${t.dueLabel}` : ''}</li>`;
    }).join('');
    const paymentWarningHtml = totalPercent !== 100
        ? `<li style="color:#B91C1C">* Tổng tỷ lệ các đợt hiện tại: ${totalPercent}% (chưa đủ 100%)</li>`
        : '';

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">

<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 28px 32px; color: #0F172A; font-size: 12px; position: relative; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%); width: 70%; opacity: 0.06; pointer-events: none; z-index: 0; }
  body > *:not(.watermark) { position: relative; z-index: 1; }

  /* Header công ty */
  .headerRow { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 1px solid #E2E8F0; }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .companyBlock { flex: 1; }
  .companyName { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
  .companyLine { font-size: 11px; color: #334155; line-height: 1.5; }

  /* Thanh tiêu đề BÁO GIÁ */
  .titleBar { background: #7FD3EF; border-radius: 8px; text-align: center; padding: 11px 0 13px; margin: 12px 0 16px; }
  .titleMain { font-size: 19px; font-weight: 700; letter-spacing: .05em; margin: 0; color: #0F172A; }
  .titleSub { font-size: 13px; font-weight: 600; font-style: italic; margin: 3px 0 0; color: #0F172A; }

  /* 3 cột thông tin */
  .infoGrid { display: flex; gap: 20px; margin-bottom: 14px; flex-wrap: wrap; }
  .infoCol { flex: 1; min-width: 160px; }
  .infoLabel { font-size: 10px; font-weight: 700; color: #0F172A; letter-spacing: .03em; margin-bottom: 4px; }
  .infoName { font-size: 12.5px; font-weight: 700; color: #0F172A; }
  .infoVal { font-size: 12px; font-weight: 700; color: #0F172A; }
  .infoSub { font-size: 11px; color: #475569; margin-top: 2px; }

  .sectionTitle2 { font-size: 11px; font-weight: 700; color: #0F172A; text-transform: uppercase; margin: 0 0 7px; }

  /* Bảng */
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; }
  thead th { background: #F1F5F9; color: #0F172A; font-size: 10.5px; font-weight: 700; padding: 8px 6px; border: 1px solid #CBD5E1; text-align: center; }
  td { padding: 7px 6px; border: 1px solid #E2E8F0; font-size: 11px; vertical-align: middle; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .included { font-style: italic; font-weight: 600; color: #334155; }
  .groupRow td { background: #F1F5F9; color: #0F172A; font-weight: 700; font-size: 11px; padding: 6px 8px; border: 1px solid #CBD5E1; }

  .sumRow td { border: 1px solid #E2E8F0; font-weight: 700; }
  .sumRow .label { color: #64748B; font-weight: 600; }
  .totalBarRow td { background: #7FD3EF; font-weight: 700; font-size: 13px; border: 1px solid #7FD3EF; color: #0F172A; }

  /* Điều khoản + ngân hàng */
  .termsBankGrid { display: flex; gap: 26px; margin-bottom: 6px; }
  .termsCol, .bankCol { flex: 1; }
  .terms { font-size: 10.5px; color: #334155; line-height: 1.8; margin: 0; padding-left: 16px; }
  .terms .highlight { color: #0F172A; font-weight: 700; }
  .bankTable { width: 100%; border-collapse: collapse; margin-top: 2px; }
  .bankTable td { border: 1px solid #E2E8F0; padding: 6px 10px; font-size: 11px; }
  .bankTable td:first-child { background: #F8FAFC; font-weight: 600; width: 38%; }

  /* Banner kết */
  .closingBanner { background: #7FD3EF; border-radius: 6px; padding: 9px 14px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .closingText { font-size: 11px; font-style: italic; color: #0F172A; }
  .closingSender { font-size: 11px; font-weight: 700; color: #0F172A; white-space: nowrap; }

  @media print { body { padding: 16px 20px; } }
</style></head><body>
${logoBase64 ? `<img class="watermark" src="${logoBase64}" alt="" />` : ''}

<div class="headerRow">
  ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo" />` : ''}
  <div class="companyBlock">
    <p class="companyName">CÔNG TY CỔ PHẦN SPRING WATER DELIVERY</p>
    <div class="companyLine">Địa chỉ: Số 4 Ngõ 102 Kim Giang, P. Đại Kim, Q. Hoàng Mai, Tp. Hà Nội</div>
    <div class="companyLine">Hotline: 0329 111 000 &nbsp;|&nbsp; Email: ${seller?.email || '—'} &nbsp;|&nbsp; MST: ${seller?.taxCode || '0110873471'}</div>
  </div>
</div>

<div class="titleBar">
  <p class="titleMain">BÁO GIÁ</p>
  <p class="titleSub">Hệ thống lọc nước tổng sinh hoạt</p>
</div>

<div class="infoGrid">
  <div class="infoCol">
    <div class="infoLabel">KHÁCH HÀNG</div>
    <div class="infoName">${quoteMeta?.company || order.customer || '—'}</div>
    ${quoteMeta?.company ? `<div class="infoSub">${order.customer || ''}</div>` : ''}
    ${quoteMeta?.taxCode ? `<div class="infoSub">Mã số thuế: ${quoteMeta.taxCode}</div>` : ''}
  </div>
  <div class="infoCol">
    <div class="infoLabel">ĐỊA CHỈ LẮP ĐẶT/GIAO HÀNG</div>
    <div class="infoVal">${order.address || '—'}</div>
  </div>
  <div class="infoCol">
    <div class="infoLabel">MÃ BÁO GIÁ</div>
    <div class="infoName">${hdNum}</div>
    <div class="infoSub">Ngày ${today} &nbsp;·&nbsp; Hiệu lực: ${quoteMeta?.validDays || 7} ngày</div>
  </div>
</div>

<div class="sectionTitle2">Chi tiết báo giá</div>
<table>
  <thead>
    <tr>
      <th style="width:24px">STT</th>
      <th>Hạng mục</th>
      <th style="width:34px">SL</th>
      <th style="width:82px">Xuất xứ</th>
      <th style="width:50px">Đơn vị</th>
      <th style="width:96px">Đơn giá (VNĐ)</th>
      <th style="width:108px">Thành tiền (VNĐ)</th>
    </tr>
  </thead>
  <tbody>
    ${groupsHtml}
    <tr class="sumRow">
      <td colspan="6" class="label">Tổng cộng (chưa ưu đãi)</td>
      <td class="r b">${fmtN(subtotal)}</td>
    </tr>
    ${disc > 0 ? `
    <tr class="sumRow">
      <td colspan="6" class="label">Chiết khấu (${disc}%)</td>
      <td class="r" style="color:#B91C1C">- ${fmtN(discAmt)}</td>
    </tr>` : ''}
    <tr class="totalBarRow">
      <td colspan="6">TỔNG ĐẦU TƯ (Đã bao gồm VAT)</td>
      <td class="r">${fmtN(total)} đ</td>
    </tr>
  </tbody>
</table>

<div class="termsBankGrid">
  <div class="termsCol">
    <div class="sectionTitle2">Điều khoản thanh toán</div>
    <ul class="terms">
      ${paymentTermsHtml}
      ${paymentWarningHtml}
      <li>Báo giá có hiệu lực ${quoteMeta?.validDays || 7} ngày kể từ ngày phát hành</li>
      ${order.note ? `<li>Ghi chú: ${order.note}</li>` : ''}
    </ul>
  </div>
  <div class="bankCol">
    <div class="sectionTitle2">Thông tin ngân hàng</div>
    <table class="bankTable">
      <tr><td>Tên TK</td><td>${bankInfo?.bankAccountName || seller?.name || 'CÔNG TY CỔ PHẦN SPRING WATER DELIVERY'}</td></tr>
      <tr><td>Số TK</td><td>${bankInfo?.bankAccountNumber || '803838'}</td></tr>
      <tr><td>Ngân hàng</td><td>${bankInfo?.bankName || 'Ngân hàng TMCP Kỹ Thương Việt Nam - TECHCOMBANK'}</td></tr>
    </table>
  </div>
</div>

<div class="closingBanner">
  <div class="closingText">SWD cam kết mang đến giải pháp nước sạch chuẩn cao cấp cho gia đình hiện đại</div>
  <div class="closingSender">Người gửi: ${bankInfo?.senderName || seller?.name || '—'} ${(bankInfo?.senderPhone || seller?.phone) ? ` — ${bankInfo?.senderPhone || seller?.phone}` : ''}</div>
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
    const [openDropIdx, setOpenDropIdx] = useState(null); // index sản phẩm đang mở dropdown

    const addProduct = () => setForm(f => ({
        ...f,
        items: [...(f.items || []), { name: '', qty: '1', price: '', note: '' }],
    }));

    const removeProduct = (i) => setForm(f => ({
        ...f,
        items: (f.items || []).filter((_, idx) => idx !== i),
    }));

    const updateItem = (i, field, val) => setForm(f => {
        const items = (f.items || []).map((p, idx) =>
            idx === i ? { ...p, [field]: val } : p   // ✅ lưu string thô
        );
        return { ...f, items };
    });

    const selectProduct = (i, prod) => {
        setForm(f => {
            const items = (f.items || []).map((p, idx) =>
                idx === i ? { ...p, name: prod.name, price: String(prod.price || prod.price_a || 0) } : p
            );
            return { ...f, items };
        });
        setOpenDropIdx(null);
    };

    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thông tin hợp đồng</Text>
            <HR />

            <Text style={S.subHead}>Bên mua</Text>
            <Text style={S.fieldLabel}>Tên khách hàng</Text>
            <TextInput style={S.input} placeholder="Nguyễn Văn A" placeholderTextColor="#CBD5E1"
                value={form.customer} onChangeText={v => setForm(f => ({ ...f, customer: v }))} />
            <Text style={S.fieldLabel}>Số điện thoại</Text>
            <TextInput style={S.input} placeholder="0901 234 567" keyboardType="phone-pad" placeholderTextColor="#CBD5E1"
                value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
            <Text style={S.fieldLabel}>Địa chỉ giao hàng</Text>
            <TextInput style={[S.input, { minHeight: 56 }]} placeholder="123 Đường ABC, Q.1, TP.HCM"
                multiline placeholderTextColor="#CBD5E1"
                value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} />

            <HR />
            <Text style={S.subHead}>Sản phẩm</Text>

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

                    {/* ✅ Dropdown chọn sản phẩm */}
                    <Text style={S.fieldLabel}>Sản phẩm</Text>
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

                    <View style={S.row2}>
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
                    <TextInput style={S.input} placeholder="Giao buổi sáng..." placeholderTextColor="#CBD5E1"
                        value={p.note || ''} onChangeText={v => updateItem(i, 'note', v)} />
                </View>
            ))}

            <TouchableOpacity style={S.addProdBtn} onPress={addProduct}>
                <Ionicons name="add" size={16} color="#185FA5" />
                <Text style={S.addProdText}>Thêm sản phẩm</Text>
            </TouchableOpacity>

            <HR />
            <Text style={S.fieldLabel}>Ghi chú đơn hàng</Text>
            <TextInput style={S.input} placeholder="Hướng dẫn đặc biệt..." placeholderTextColor="#CBD5E1"
                value={form.note || ''} onChangeText={v => setForm(f => ({ ...f, note: v }))} />
        </View>
    );
}

// ── NEW: mục "Thiết bị & Dịch vụ" nhập tay (độc lập với sản phẩm đơn hàng) ──
// Dùng cho cả mode=order lẫn mode=template — mỗi dòng: tên, SL, đơn vị, đơn giá, ghi chú,
// và cờ "Bao gồm" (miễn phí, không cộng vào tổng — giống các dòng "Bao gồm" trong ảnh mẫu).
function ServicesEditor({ services, setServices }) {
    const addService = () => setServices(s => [
        ...(s || []),
        { name: '', qty: '1', unit: 'Gói', price: '', origin: 'SWD', included: false, note: '' },
    ]);
    const removeService = (i) => setServices(s => (s || []).filter((_, idx) => idx !== i));
    const updateService = (i, field, val) => setServices(s => (s || []).map((sv, idx) =>
        idx === i ? { ...sv, [field]: val } : sv
    ));

    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thiết bị & Dịch vụ</Text>
            <Text style={S.svcHint}>Khảo sát, thi công, vật tư, vệ sinh... — nhập thủ công</Text>
            <HR />

            {(services || []).length === 0 && (
                <Text style={S.svcEmpty}>Chưa có dịch vụ nào. Bấm "Thêm dịch vụ" để bổ sung.</Text>
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

                    <View style={S.row2}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Số lượng</Text>
                            <TextInput style={S.input} keyboardType="numeric" placeholderTextColor="#CBD5E1"
                                value={String(sv.qty ?? '')} onChangeText={v => updateService(i, 'qty', v)} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.fieldLabel}>Đơn vị</Text>
                            <TextInput style={S.input} placeholder="Gói" placeholderTextColor="#CBD5E1"
                                value={sv.unit || ''} onChangeText={v => updateService(i, 'unit', v)} />
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
                            Bao gồm (miễn phí )
                        </Text>
                    </TouchableOpacity>

                    <Text style={S.fieldLabel}>Ghi chú</Text>
                    <TextInput style={S.input} placeholder="Ghi chú thêm..." placeholderTextColor="#CBD5E1"
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

// ── NEW: thông tin báo giá (mã báo giá, tên công ty KH, MST, hiệu lực) ──
function QuoteMetaEditor({ quoteMeta, setQuoteMeta }) {
    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Thông tin báo giá</Text>
            <HR />
            <Text style={S.fieldLabel}>Tên công ty khách hàng (nếu có)</Text>
            <TextInput style={S.input} placeholder="CÔNG TY TNHH ..." placeholderTextColor="#CBD5E1"
                value={quoteMeta.company} onChangeText={v => setQuoteMeta(m => ({ ...m, company: v }))} />
            <View style={S.row2}>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Mã số thuế</Text>
                    <TextInput style={S.input} placeholder="0319341685" placeholderTextColor="#CBD5E1"
                        value={quoteMeta.taxCode} onChangeText={v => setQuoteMeta(m => ({ ...m, taxCode: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={S.fieldLabel}>Hiệu lực (ngày)</Text>
                    <TextInput style={S.input} keyboardType="numeric" placeholder="7" placeholderTextColor="#CBD5E1"
                        value={String(quoteMeta.validDays ?? '')} onChangeText={v => setQuoteMeta(m => ({ ...m, validDays: v }))} />
                </View>
            </View>
            <Text style={S.fieldLabel}>Mã báo giá</Text>
            <TextInput style={S.input} placeholder="SWD-2026-08-06-KH-1" placeholderTextColor="#CBD5E1"
                value={quoteMeta.code} onChangeText={v => setQuoteMeta(m => ({ ...m, code: v }))} />
        </View>
    );
}

// ── NEW: thông tin ngân hàng + người gửi báo giá (nhập tay) ──
function BankInfoEditor({ bankInfo, setBankInfo }) {
    return (
        <View style={S.templateCard}>
            <Text style={S.sectionHead}>Ngân hàng & Người gửi</Text>
            <Text style={S.svcHint}>Hiển thị ở mục "Thông tin ngân hàng" và cuối bản báo giá</Text>
            <HR />

            <Text style={S.subHead}>Thông tin ngân hàng</Text>
            <Text style={S.fieldLabel}>Tên chủ tài khoản</Text>
            <TextInput style={S.input} placeholder="CÔNG TY CỔ PHẦN SPRING WATER DELIVERY" placeholderTextColor="#CBD5E1"
                value={bankInfo.bankAccountName} onChangeText={v => setBankInfo(b => ({ ...b, bankAccountName: v }))} />
            <Text style={S.fieldLabel}>Số tài khoản</Text>
            <TextInput style={S.input} placeholder="0123456789" keyboardType="numeric" placeholderTextColor="#CBD5E1"
                value={bankInfo.bankAccountNumber} onChangeText={v => setBankInfo(b => ({ ...b, bankAccountNumber: v }))} />
            <Text style={S.fieldLabel}>Ngân hàng</Text>
            <TextInput style={S.input} placeholder="Vietcombank" placeholderTextColor="#CBD5E1"
                value={bankInfo.bankName} onChangeText={v => setBankInfo(b => ({ ...b, bankName: v }))} />

            <HR />
            <Text style={S.subHead}>Người gửi báo giá</Text>
            <Text style={S.fieldLabel}>Họ tên người gửi</Text>
            <TextInput style={S.input} placeholder="Nguyễn Văn A" placeholderTextColor="#CBD5E1"
                value={bankInfo.senderName} onChangeText={v => setBankInfo(b => ({ ...b, senderName: v }))} />
            <Text style={S.fieldLabel}>Số điện thoại người gửi</Text>
            <TextInput style={S.input} placeholder="0901 234 567" keyboardType="phone-pad" placeholderTextColor="#CBD5E1"
                value={bankInfo.senderPhone} onChangeText={v => setBankInfo(b => ({ ...b, senderPhone: v }))} />
        </View>
    );
}

// ── NEW: điều khoản thanh toán theo nhiều đợt (tối đa 4 đợt) ──
// Mỗi đợt chỉ cần % giá trị đơn hàng + hạn thanh toán. Tự tính tổng % và cảnh báo nếu chưa đủ 100%.
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
            <Text style={S.svcHint}>Chia đợt thanh toán theo % giá trị đơn hàng (tối đa {MAX_PAYMENT_TERMS} đợt)</Text>
            <HR />

            {terms.length === 0 && (
                <Text style={S.svcEmpty}>Chưa có đợt thanh toán nào. Bấm "Thêm đợt thanh toán" để bổ sung.</Text>
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
                                <Text style={S.fieldLabel}>Hạn thanh toán</Text>
                                <TextInput style={S.input} placeholder="Trước khi lắp đặt" placeholderTextColor="#CBD5E1"
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
    const commRate = COMM[orderType] || 0.03;
    const comm = total * commRate;

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
                <Text style={S.calcFieldLabel}>Chiết khấu áp dụng</Text>
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
                <Text style={S.totalLabel}>Tổng thanh toán</Text>
                <Text style={S.totalVal}>{fmt(total)}</Text>
            </View>
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
        items: [{ name: '', qty: 1, price: 0, note: '' }],
    });

    // Shared calculator state — ✅ luôn fallback []
    const safeItems = Array.isArray(rawOrder.items) && rawOrder.items.length > 0
        ? rawOrder.items
        : mode === 'order' ? [] : form.items;

    const [items, setItems] = useState(safeItems);
    // ✅ NEW: mục Thiết bị & Dịch vụ — nhập tay, độc lập với sản phẩm đơn hàng, dùng chung cho cả 2 mode
    const [services, setServices] = useState(rawOrder.services || []);
    // ✅ NEW: thông tin báo giá (mã báo giá / công ty KH / MST / hiệu lực)
    const [quoteMeta, setQuoteMeta] = useState({
        company: rawOrder.customerCompany || '',
        taxCode: rawOrder.customerTaxCode || '',
        validDays: '7',
        code: '',
    });
    // ✅ NEW: thông tin ngân hàng + người gửi (nhập tay)
    const [bankInfo, setBankInfo] = useState({
        bankAccountName: '', bankAccountNumber: '', bankName: '',
        senderName: '', senderPhone: '',
    });
    // ✅ NEW: điều khoản thanh toán theo đợt (tối đa 4 đợt) — mặc định 1 đợt 100%
    const [paymentTerms, setPaymentTerms] = useState([
        { percent: '100', dueLabel: 'Trước khi lắp đặt' },
    ]);
    const [disc, setDisc] = useState('0');
    const [exporting, setExporting] = useState(false);

    // ✅ Fetch catalog sản phẩm từ Firestore
    const [catalog, setCatalog] = useState([]);
    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => setCatalog(
                snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0))
            ))
            .catch(e => console.warn('catalog fetch:', e));
    }, []);

    // ✅ Gợi ý thông tin ngân hàng/người gửi từ hồ sơ user khi có sẵn (không ghi đè nếu người dùng đã nhập)
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

    // Derived — ✅ guard items trước khi reduce
    const order = mode === 'order' ? rawOrder : form;
    const safeCalc = Array.isArray(items) ? items : [];
    const safeServices = Array.isArray(services) ? services : [];
    const itemsSubtotal = safeCalc.reduce((s, p) => s + parseNum(p.price) * parseNum(p.qty), 0);
    const servicesSubtotal = safeServices.reduce((s, sv) => s + (sv.included ? 0 : parseNum(sv.price) * parseNum(sv.qty || 1)), 0);
    const subtotal = itemsSubtotal + servicesSubtotal;
    const discAmt = subtotal * (parseNum(disc) / 100);
    const total = subtotal - discAmt;

    // ✅ Sync items từ form khi mode=template (tránh bug function updater)
    useEffect(() => {
        if (mode === 'template' && Array.isArray(form.items)) {
            setItems(form.items);
        }
    }, [form.items, mode]);

    const handleFormChange = (nextForm) => {
        setForm(nextForm); // React tự xử lý cả object lẫn function updater
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const logoBase64 = await getBase64Logo(); // ✅ fetch base64 trước
            const html = buildPDFHtml({
                order, seller: userDetail, items: safeCalc, services: safeServices,
                quoteMeta, disc, subtotal, total, discAmt, logoBase64,
                bankInfo, paymentTerms,
            });
            await exportPDF(html, isDesktop);
        } catch (e) { console.error(e); }
        finally { setExporting(false); }
    };

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
                        {mode === 'template' ? 'Hợp đồng mẫu' : `Đơn hàng #${rawOrder.id}`}
                    </Text>
                    <Text style={S.hSub}>
                        {mode === 'template' ? 'Điền thông tin để xem trước hợp đồng' : rawOrder.customer}
                    </Text>
                </View>
                {/* PDF Export button */}
                <TouchableOpacity style={S.pdfBtn} onPress={handleExport} disabled={exporting} activeOpacity={0.85}>
                    {exporting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="document-outline" size={15} color="#fff" />
                    }
                    <Text style={S.pdfBtnText}>{exporting ? 'Đang xuất...' : 'Xuất PDF'}</Text>
                </TouchableOpacity>
            </View>

            {/* Body — ✅ không còn preview hợp đồng, chỉ còn form nhập liệu chia 2 cột (desktop) */}
            <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={[S.body, isDesktop && S.bodyWeb]}
                keyboardShouldPersistTaps="handled"
            >
                {isDesktop ? (
                    <View style={S.grid2}>
                        <View style={S.gridCol}>
                            <QuoteMetaEditor quoteMeta={quoteMeta} setQuoteMeta={setQuoteMeta} />
                            {mode === 'template' && (
                                <TemplateForm form={form} setForm={handleFormChange} catalog={catalog} />
                            )}
                            <ServicesEditor services={safeServices} setServices={setServices} />
                        </View>
                        <View style={S.gridCol}>
                            <BankInfoEditor bankInfo={bankInfo} setBankInfo={setBankInfo} />
                            <PaymentTermsEditor paymentTerms={paymentTerms} setPaymentTerms={setPaymentTerms} total={total} />
                            <Calculator
                                items={safeCalc}
                                services={safeServices}
                                orderType={order.orderType || 'le'}
                                disc={disc}
                                setDisc={setDisc}
                            />
                        </View>
                    </View>
                ) : (
                    <View style={{ gap: 12 }}>
                        <QuoteMetaEditor quoteMeta={quoteMeta} setQuoteMeta={setQuoteMeta} />
                        {mode === 'template' && (
                            <TemplateForm form={form} setForm={handleFormChange} catalog={catalog} />
                        )}
                        <ServicesEditor services={safeServices} setServices={setServices} />
                        <BankInfoEditor bankInfo={bankInfo} setBankInfo={setBankInfo} />
                        <PaymentTermsEditor paymentTerms={paymentTerms} setPaymentTerms={setPaymentTerms} total={total} />
                        <Calculator
                            items={safeCalc}
                            services={safeServices}
                            orderType={order.orderType || 'le'}
                            disc={disc}
                            setDisc={setDisc}
                        />
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
    // Header
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    hTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    hSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0C447C', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
    pdfBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    // Layout
    body: { padding: 14, paddingBottom: 40 },
    bodyWeb: { padding: 20 },
    // ✅ 2 cột nhập liệu ngang bằng (đã bỏ cột preview hợp đồng)
    grid2: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    gridCol: { flex: 1, minWidth: 0, gap: 14 },
    hr: { height: 0.5, backgroundColor: '#E2E8F0', marginVertical: 13 },
    // Template Form / mục dùng chung
    templateCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0', marginBottom: 0 },
    sectionHead: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    subHead: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6 },
    fieldLabel: { fontSize: 11, color: '#64748B', marginBottom: 4, marginTop: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: '#0F172A' },
    inputDisabled: { color: '#CBD5E1' },
    row2: { flexDirection: 'row', gap: 10 },
    typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
    typeBtnActive: { backgroundColor: '#0C447C', borderColor: '#0C447C' },
    typeBtnText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    typeBtnTextActive: { color: '#fff' },
    prodFormRow: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 0.5, borderColor: '#E2E8F0' },
    prodFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    prodFormIdx: { fontSize: 11, fontWeight: '700', color: '#185FA5' },
    addProdBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 9, backgroundColor: '#EFF6FF', marginTop: 10 },
    addProdText: { fontSize: 13, color: '#185FA5', fontWeight: '600' },
    // Dịch vụ (services)
    svcHint: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
    svcEmpty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 },
    includedToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, paddingVertical: 2 },
    includedToggleText: { fontSize: 11.5, color: '#64748B', flexShrink: 1 },
    // Điều khoản thanh toán theo đợt
    percentBadgeOk: { backgroundColor: '#F0FDF4' },
    percentBadgeWarn: { backgroundColor: '#FEF2F2' },
    paymentTermAmt: { fontSize: 11, color: '#185FA5', fontWeight: '600', marginTop: 8 },
    totalPercentVal: { fontSize: 13, fontWeight: '700' },
    totalPercentOk: { color: '#16A34A' },
    totalPercentWarn: { color: '#DC2626' },
    // Calculator
    calcCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0' },
    calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    calcIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    calcTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
    editBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    editBadgeText: { fontSize: 10, color: '#185FA5', fontWeight: '700' },
    calcSvcHead: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 2, textTransform: 'uppercase', letterSpacing: .04 },
    calcRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
    calcProdIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    calcDropTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
    calcDropPlaceholder: { flex: 1, fontSize: 12, color: '#CBD5E1' },
    // Product Dropdown
    dropWrap: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#E2E8F0', marginTop: 2, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    dropSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    dropSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    dropItemIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    dropItemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    dropItemCap: { fontSize: 11, color: '#94A3B8' },
    dropItemPrice: { fontSize: 12, fontWeight: '600', color: '#185FA5' },
    dropEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    // Template dropdown trigger
    dropTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dropTriggerText: { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '500' },
    dropTriggerPlaceholder: { flex: 1, fontSize: 13, color: '#CBD5E1' },
    calcProdName: { fontSize: 12, fontWeight: '600', color: '#0F172A', marginBottom: 6 },
    calcInputs: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    calcField: { gap: 3 },
    calcFieldLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    tInput: { fontSize: 13, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center' },
    lineTotal: { fontSize: 13, fontWeight: '700', color: '#185FA5', paddingVertical: 6 },
    discRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    statLabel: { fontSize: 12, color: '#64748B' },
    statVal: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: '#E2E8F0', marginTop: 4 },
    totalLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    totalVal: { fontSize: 17, fontWeight: '700', color: '#185FA5' },
    readOnlyLabel: {
        fontSize: 12,
        color: '#64748B',
        marginRight: 10,
    },
    readOnlyVal: {
        fontWeight: '600',
        color: '#0F172A',
    },
});