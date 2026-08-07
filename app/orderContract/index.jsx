// app/orderContract/index.jsx
// Màn tính toán + hợp đồng đơn hàng
// mode=order  → pre-fill từ đơn hàng có sẵn
// mode=template → điền tay, không lưu DB
// Xuất PDF: web dùng window.print(), mobile dùng expo-print

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

function buildPDFHtml({ order, seller, items: itemsProp, disc, total, discAmt, logoBase64 }) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];
    const hdNum = `HD-${new Date().getFullYear()}-${(order.id || '001').slice(-6).padStart(6, '0')}`;
    const today = new Date().toLocaleDateString('vi-VN');
    const subtotal = items.reduce((s, p) => s + (p.price || 0) * (p.qty || 1), 0);

    // ── Gom nhóm theo category (nếu có), fallback về 1 nhóm chung ──
    const groups = {};
    items.forEach((p) => {
        const cat = p.category || 'SẢN PHẨM / DỊCH VỤ';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    });
    const groupKeys = Object.keys(groups);

    let stt = 0;
    const groupsHtml = groupKeys.map((cat, gi) => {
        const rows = groups[cat].map((p) => {
            stt += 1;
            const lineTotal = (p.price || 0) * (p.qty || 1);
            return `
            <tr>
                <td class="c">${stt}</td>
                <td>${p.name || ''}</td>
                <td class="c">${fmtN(p.qty)}</td>
                <td class="c">${p.unit || 'Cái'}</td>
                <td class="r">${p.price ? fmtN(p.price) : '—'}</td>
                <td class="r b">${lineTotal ? fmtN(lineTotal) : 'Đã bao gồm'}</td>
                <td class="note">${p.note || ''}</td>
            </tr>`;
        }).join('');

        return `
        <tr class="groupRow">
            <td colspan="7">${['I', 'II', 'III', 'IV', 'V'][gi] || gi + 1}. ${cat.toUpperCase()}</td>
        </tr>
        ${rows}`;
    }).join('');

    //header fix cứng hoặc tùy chỉnh theo từng người
    // <p class="companyName">${seller?.name || 'CÔNG TY CỔ PHẦN SPRING WATER DELIVERY'}</p>
    //     <div class="companyLine">Địa chỉ: ${seller?.address || 'Số 4 Ngõ 102 Kim Giang, P. Đại Kim, Q. Hoàng Mai, Tp. Hà Nội'}</div>
    // <div class="companyLine">Hotline: ${seller?.hotline || seller?.phone || '0329 111 000'} &nbsp;·&nbsp; Email: ${seller?.email || '—'}</div>
    // <div class="companyLine">MST: ${seller?.taxCode || '0110873471'}</div>

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">

<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 28px 32px; color: #0F172A; font-size: 12.5px; position: relative; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%); width: 70%; opacity: 0.06; pointer-events: none; z-index: 0; }
  body > *:not(.watermark) { position: relative; z-index: 1; }

  /* Header */
  .headerRow { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #185FA5; padding-bottom: 10px; margin-bottom: 14px; }
  .logo { width: 64px; height: 64px; object-fit: contain; }
  .companyBlock { flex: 1; text-align: center; }
  .companyName { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
  .companyLine { font-size: 11px; color: #334155; line-height: 1.5; }

  /* Title */
  .titleBlock { text-align: center; margin: 14px 0 18px; }
  .titleMain { font-size: 20px; font-weight: 800; letter-spacing: .04em; margin: 0; color: #0F172A; }
  .titleSub { font-size: 15px; font-weight: 700; margin: 2px 0 0; color: #0F172A; }

  /* Info block */
  .infoGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 12px; margin-bottom: 10px; }
  .infoGrid .label { color: #64748B; }
  .infoGrid .val { font-weight: 700; }
  .greeting { font-size: 12px; margin: 10px 0 4px; }
  .greeting b { color: #185FA5; }
  .introText { font-size: 11.5px; color: #475569; line-height: 1.6; margin-bottom: 14px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin: 6px 0 16px; }
  thead th {
    background: #DCE9F7; color: #0F172A; font-size: 11px; font-weight: 700;
    padding: 8px 6px; border: 1px solid #94A3B8; text-align: center;
  }
  td { padding: 7px 6px; border: 1px solid #CBD5E1; font-size: 11.5px; vertical-align: middle; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .note { color: #64748B; font-style: italic; font-size: 10.5px; }
  .groupRow td { background: #185FA5; color: #fff; font-weight: 700; font-size: 11.5px; padding: 6px 8px; border: 1px solid #185FA5; }

  .sumRow td { background: #F1F5F9; font-weight: 700; border: 1px solid #94A3B8; }
  .sumRow .r { font-size: 12.5px; }
  .totalRow td { background: #DCE9F7; font-weight: 800; font-size: 13px; border: 1px solid #185FA5; }
  .payRow td { background: #FDECEC; color: #B91C1C; font-weight: 800; font-size: 12px; border: 1px solid #F3B4B4; }

  /* Terms + bank */
  .sectionTitle { font-size: 12px; font-weight: 700; color: #0F172A; margin: 14px 0 6px; }
  .terms { font-size: 11px; color: #334155; line-height: 1.8; }
  .terms li { margin-bottom: 2px; }
  .terms .highlight { color: #B91C1C; font-weight: 700; }

  .bankTable { width: 60%; margin-top: 8px; border-collapse: collapse; }
  .bankTable td { border: 1px solid #CBD5E1; padding: 6px 10px; font-size: 11.5px; }
  .bankTable td:first-child { background: #F8FAFC; font-weight: 600; width: 40%; }

  /* Signature */
  .closing { font-size: 11.5px; font-style: italic; color: #185FA5; margin-top: 18px; text-align: center; }
  .sigBlock { text-align: right; margin-top: 8px; }
  .sigLabel { font-size: 11px; color: #64748B; }
  .sigName { font-size: 12.5px; font-weight: 700; margin-top: 46px; }

  @media print { body { padding: 16px 20px; } }
</style></head><body>
${logoBase64 ? `<img class="watermark" src="${logoBase64}" alt="" />` : ''}

<div class="headerRow">
  ${logoBase64 ? `<img class="logo" src="${logoBase64}" alt="logo" />` : ''}
  <div class="companyBlock">
    <p class="companyName">CÔNG TY CỔ PHẦN SPRING WATER DELIVERY</p>
    <div class="companyLine">Địa chỉ: ${'Số 4 Ngõ 102 Kim Giang, P. Đại Kim, Q. Hoàng Mai, Tp. Hà Nội'}</div>
    <div class="companyLine">Hotline: ${'0329 111 000'} &nbsp;·&nbsp; Email: ${seller?.email || '—'}</div>
    <div class="companyLine">MST: ${seller?.taxCode || '0110873471'}</div>
  </div>
</div>

<div class="titleBlock">
  <p class="titleMain">BÁO GIÁ</p>
  <p class="titleSub">HỆ THỐNG LỌC TỔNG NƯỚC SINH HOẠT</p>
</div>

<div class="infoGrid">
  <div>
    <div><span class="label">Kính gửi:</span> <span class="val">${order.customer || '—'}</span></div>
    <div><span class="label">SĐT:</span> ${order.phone || '—'}</div>
    <div><span class="label">Địa chỉ:</span> ${order.address || '—'}</div>
  </div>
  <div>
    <div><span class="label">Người gửi:</span> <span class="val">${seller?.name || '—'}</span></div>
    <div><span class="label">SĐT:</span> ${seller?.phone || '—'}</div>
    <div><span class="label">Số HĐ:</span> ${hdNum} &nbsp;·&nbsp; Ngày ${today}</div>
  </div>
</div>

<p class="introText">
  Chúng tôi chân thành cảm ơn sự quan tâm của Quý khách hàng đối với sản phẩm và dịch vụ của
  ${seller?.name || 'SWD'}. Hân hạnh gửi tới Quý khách hàng báo giá hệ thống lọc nước sinh hoạt như sau:
</p>

<table>
  <thead>
    <tr>
      <th style="width:26px">STT</th>
      <th>Hạng mục</th>
      <th style="width:50px">Số lượng</th>
      <th style="width:50px">Đơn vị</th>
      <th style="width:100px">Đơn giá (VNĐ)</th>
      <th style="width:110px">Thành tiền (VNĐ)</th>
      <th style="width:130px">Ghi chú</th>
    </tr>
  </thead>
  <tbody>
    ${groupsHtml}
    <tr class="sumRow">
      <td colspan="5">Tổng cộng</td>
      <td class="r">${fmtN(subtotal)}</td>
      <td></td>
    </tr>
    ${disc > 0 ? `
    <tr class="sumRow">
      <td colspan="5">Chiết khấu (${disc}%)</td>
      <td class="r" style="color:#B91C1C">- ${fmtN(discAmt)}</td>
      <td></td>
    </tr>` : ''}
    <tr class="totalRow">
      <td colspan="5">Thành tiền</td>
      <td class="r">${fmtN(total)}</td>
      <td></td>
    </tr>
    <tr class="payRow">
      <td colspan="5">Thanh toán 100% trước khi lắp đặt</td>
      <td class="r">${fmtN(total)}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<p class="sectionTitle">Điều khoản thanh toán:</p>
<ul class="terms">
  <li>Báo giá trên đã bao gồm thuế VAT (nếu có).</li>
  <li>Báo giá này có hiệu lực trong vòng 30 ngày kể từ ngày gửi.</li>
  <li class="highlight">Thanh toán 100% giá trị hợp đồng trước khi lắp đặt.</li>
  ${order.note ? `<li>Ghi chú: ${order.note}</li>` : ''}
</ul>

<p class="sectionTitle">Thông tin tài khoản thanh toán:</p>
<table class="bankTable">
  <tr><td>Tên tài khoản</td><td>${seller?.bankAccountName || seller?.name || '—'}</td></tr>
  <tr><td>Số tài khoản</td><td>${seller?.bankAccountNumber || '—'}</td></tr>
  <tr><td>Ngân hàng</td><td>${seller?.bankName || '—'}</td></tr>
</table>

<p class="closing">Rất chân thành cảm ơn sự tin tưởng của Quý khách hàng dành cho ${seller?.name || 'chúng tôi'}!</p>

<div class="sigBlock">
  <div class="sigLabel">Người gửi</div>
  <div class="sigName">${seller?.name || '—'}</div>
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

// ── Calculator ────────────────────────────────────────────────
function Calculator({ items: itemsProp, orderType, disc, setDisc }) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];

    const parseNum = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
    const subtotal = items.reduce((s, p) => s + parseNum(p.price) * parseNum(p.qty), 0);
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
                <View key={i} style={S.calcRow}>
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

            <HR />
            {/* Chiết khấu nếu mode template có thể cho nhập, nhưng nếu bạn muốn khóa hết thì đổi TextInput thành Text */}
            <View style={S.discRow}>
                <Text style={S.calcFieldLabel}>Chiết khấu áp dụng</Text>
                <TInput
                    value={String(disc ?? '')}
                    onChange={v => setDisc(v)} // <--- Dòng này cho phép thay đổi giá trị
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

            {/* <View style={S.commBox}>
                <View>
                    <Text style={S.commLabel}>Hoa hồng dự kiến</Text>
                    <Text style={S.commVal}>{fmt(comm)}</Text>
                    <Text style={S.commSub}>{(commRate * 100).toFixed(0)}% hoa hồng trên đơn</Text>
                </View>
                <Ionicons name="gift-outline" size={24} color="rgba(255,255,255,0.3)" />
            </View> */}
        </View>
    );
}

// ── Contract View ─────────────────────────────────────────────
function Contract({ order, seller, items: itemsProp, disc, total, discAmt }) {
    const items = Array.isArray(itemsProp) ? itemsProp : [];     // ✅ guard
    const hdNum = `HD-${new Date().getFullYear()}-${(order.id || Math.floor(Math.random() * 999 + 1).toString()).slice(-6).padStart(6, '0')}`;
    const today = new Date().toLocaleDateString('vi-VN');
    const { isDesktop } = useLayout();

    return (
        <View style={S.contractCard}>
            {/* Head */}
            <View style={S.cHead}>
                <View style={{ flex: 1 }}>
                    <Text style={S.cTitle}>Hợp đồng báo giá sản phẩm</Text>
                    <Text style={S.cNum}>Số HĐ: {hdNum}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[S.tBadge, order.orderType === 'buon' ? S.tBuon : S.tLe]}>
                        <Text style={[S.tBadgeT, order.orderType === 'buon' ? S.tBuonT : S.tLeT]}>
                            {order.orderType === 'buon' ? 'Đơn buôn' : 'Đơn lẻ'}
                        </Text>
                    </View>
                    <Text style={S.cDate}>Ngày {today}</Text>
                </View>
            </View>
            <HR />

            {/* Parties */}
            <View style={[S.partiesRow, isDesktop && { flexDirection: 'row', gap: 10 }]}>
                <View style={[S.partyBox, !isDesktop && { marginBottom: 10 }]}>
                    <View style={S.partyTR}>
                        <Ionicons name="person-outline" size={11} color="#185FA5" />
                        <Text style={S.partyTitle}>Bên mua (A)</Text>
                    </View>
                    <Text style={S.partyName}>{order.customer || '—'}</Text>
                    <Text style={S.partyD}>SĐT: {order.phone || '—'}</Text>
                    <Text style={S.partyD}>Địa chỉ: {order.address || '—'}</Text>
                </View>
                <View style={S.partyBox}>
                    <View style={S.partyTR}>
                        <Ionicons name="business-outline" size={11} color="#185FA5" />
                        <Text style={S.partyTitle}>Bên bán (B)</Text>
                    </View>
                    <Text style={S.partyName}>{seller?.name || 'SWD Company'}</Text>
                    <Text style={S.partyD}>SĐT: {seller?.phone || '—'}</Text>
                    <Text style={S.partyD}>Email: {seller?.email || '—'}</Text>
                </View>
            </View>
            <HR />

            {/* Table */}
            <Text style={S.secMini}>Chi tiết đơn hàng</Text>
            <View style={S.tableWrap}>
                <View style={[S.tRow, S.tHead]}>
                    <Text style={[S.th, { width: 22 }]}>#</Text>
                    <Text style={[S.th, { flex: 1 }]}>Sản phẩm</Text>
                    <Text style={[S.th, S.thR, { width: 36 }]}>SL</Text>
                    <Text style={[S.th, S.thR, { width: isDesktop ? 100 : 82 }]}>Đơn giá</Text>
                    <Text style={[S.th, S.thR, { width: isDesktop ? 108 : 90 }]}>Thành tiền</Text>
                    {isDesktop && <Text style={[S.th, { width: 110 }]}>Ghi chú</Text>}
                </View>
                {items.map((p, i) => (
                    <View key={i} style={[S.tRow, i % 2 === 1 && S.tRowAlt]}>
                        <Text style={[S.td, { width: 22, color: '#94A3B8' }]}>{i + 1}</Text>
                        <Text style={[S.td, { flex: 1 }]} numberOfLines={2}>{p.name || '—'}</Text>
                        <Text style={[S.td, S.tdR, { width: 36 }]}>{fmtN(p.qty)}</Text>
                        <Text style={[S.td, S.tdR, { width: isDesktop ? 100 : 82 }]}>{fmt(p.price)}</Text>
                        <Text style={[S.td, S.tdR, { width: isDesktop ? 108 : 90 }]}>{fmt((p.price || 0) * (p.qty || 1))}</Text>
                        {isDesktop && <Text style={[S.td, { width: 110, color: '#64748B', fontStyle: 'italic', fontSize: 11 }]}>{p.note || '—'}</Text>}
                    </View>
                ))}
                <View style={[S.tRow, S.tFoot]}>
                    <Text style={[S.td, { flex: 1, color: '#64748B', fontSize: 11 }]}>Chiết khấu{disc > 0 ? ` (${disc}%)` : ''}</Text>
                    <Text style={[S.td, S.tdR, { color: '#A32D2D' }]}>- {fmt(discAmt)}</Text>
                </View>
                <View style={[S.tRow, S.tFoot, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[S.td, { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' }]}>Tổng thanh toán</Text>
                    <Text style={[S.td, S.tdR, { fontSize: 15, fontWeight: '700', color: '#185FA5' }]}>{fmt(total)}</Text>
                </View>
            </View>
            <HR />

            {/* Info */}
            <View style={S.infoBox}>
                {/* <View style={S.infoRow}>
                    <Ionicons name="card-outline" size={12} color="#64748B" />
                    <Text style={S.infoL}>Thanh toán:</Text>
                    <Text style={S.infoV}>{order.paymentMethod === 'company' ? 'Doanh nghiệp thanh toán' : 'Khách hàng thanh toán'}</Text>
                </View> */}
                {order.note ? (
                    <View style={S.infoRow}>
                        <Ionicons name="document-text-outline" size={12} color="#64748B" />
                        <Text style={S.infoL}>Ghi chú:</Text>
                        <Text style={S.infoV}>{order.note}</Text>
                    </View>
                ) : null}
            </View>
            <HR />

            {/* Terms */}
            <Text style={S.termsT}>Điều khoản thanh toán</Text>
            <Text style={S.termsB}>
                {order.orderType === 'buon'
                    ? 'Thanh toán toàn bộ trước khi giao hàng. Hàng hoá được kiểm tra tại thời điểm giao nhận. Mọi khiếu nại cần phản ánh trong vòng 24 giờ kể từ khi nhận hàng.'
                    : 'Thanh toán khi nhận hàng hoặc chuyển khoản trước. Lắp đặt miễn phí trong vòng 24 giờ kể từ khi giao hàng thành công.'}
            </Text>
            <HR />

            {/* Signatures */}
            <View style={[S.sigRow, isDesktop && { flexDirection: 'row', gap: 40 }]}>
                <View style={[S.sigCol, !isDesktop && { marginBottom: 14 }]}>
                    <Text style={S.sigLabel}>Đại diện bên mua</Text>
                    <View style={S.sigLine} />
                    <Text style={S.sigName}>{order.customer || '—'}</Text>
                    <Text style={S.sigHint}>Ký và ghi rõ họ tên</Text>
                </View>
                <View style={S.sigCol}>
                    <Text style={S.sigLabel}>Đại diện bên bán</Text>
                    <View style={S.sigLine} />
                    <Text style={S.sigName}>{seller?.name || 'SWD Company'}</Text>
                    <Text style={S.sigHint}>Ký và đóng dấu</Text>
                </View>
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

    // Derived — ✅ guard items trước khi reduce
    const parseNum = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
    const order = mode === 'order' ? rawOrder : form;
    const safeCalc = Array.isArray(items) ? items : [];
    const subtotal = safeCalc.reduce((s, p) => s + parseNum(p.price) * parseNum(p.qty), 0);
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
            const html = buildPDFHtml({ order, seller: userDetail, items: safeCalc, disc, total, discAmt, logoBase64 });
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

            {/* Body */}
            <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={[S.body, isDesktop && S.bodyWeb]}
                keyboardShouldPersistTaps="handled"
            >
                {isDesktop ? (
                    <View style={S.grid}>

                        <View style={{ width: 340, flexShrink: 0, gap: 14 }}>
                            {mode === 'template' && (
                                <TemplateForm form={form} setForm={handleFormChange} catalog={catalog} />
                            )}
                            <Calculator
                                items={safeCalc} // safeCalc đã tự động lấy từ Order hoặc Template Form
                                orderType={order.orderType || 'le'}
                                disc={disc}
                                setDisc={setDisc}
                            />
                        </View>
                        {/* Right: Contract */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Contract
                                order={order}
                                seller={userDetail}
                                items={safeCalc}
                                disc={disc}
                                total={total}
                                discAmt={discAmt}
                            />
                        </View>
                    </View>
                ) : (
                    <View style={{ gap: 12 }}>
                        {mode === 'template' && (
                            <TemplateForm form={form} setForm={handleFormChange} catalog={catalog} />
                        )}
                        <Calculator
                            items={safeCalc} // safeCalc đã tự động lấy từ Order hoặc Template Form
                            orderType={order.orderType || 'le'}
                            disc={disc}
                            setDisc={setDisc}
                        />
                        <Contract
                            order={order}
                            seller={userDetail}
                            items={safeCalc}
                            disc={disc}
                            total={total}
                            discAmt={discAmt}
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
    grid: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    hr: { height: 0.5, backgroundColor: '#E2E8F0', marginVertical: 13 },
    // Template Form
    templateCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0', marginBottom: 0 },
    sectionHead: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    subHead: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6 },
    fieldLabel: { fontSize: 11, color: '#64748B', marginBottom: 4, marginTop: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: '#0F172A' },
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
    // Calculator
    calcCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: '#E2E8F0' },
    calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    calcIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    calcTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
    editBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    editBadgeText: { fontSize: 10, color: '#185FA5', fontWeight: '700' },
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
    commBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0C447C', borderRadius: 12, padding: 14, marginTop: 12 },
    commLabel: { fontSize: 9, letterSpacing: .07, color: '#85B7EB', marginBottom: 3, textTransform: 'uppercase' },
    commVal: { fontSize: 20, fontWeight: '700', color: '#fff' },
    commSub: { fontSize: 10, color: '#85B7EB', marginTop: 2 },
    commRate: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
    // Contract
    contractCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 0.5, borderColor: '#E2E8F0' },
    cHead: { flexDirection: 'row', alignItems: 'flex-start' },
    cTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', letterSpacing: -.3 },
    cNum: { fontSize: 11, color: '#64748B', marginTop: 3 },
    cDate: { fontSize: 11, color: '#94A3B8' },
    tBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    tBuon: { backgroundColor: '#ECFDF5', borderWidth: 0.5, borderColor: '#A7F3D0' },
    tLe: { backgroundColor: '#F5F3FF', borderWidth: 0.5, borderColor: '#DDD6FE' },
    tBadgeT: { fontSize: 11, fontWeight: '700' },
    tBuonT: { color: '#065F46' },
    tLeT: { color: '#5B21B6' },
    partiesRow: {},
    partyBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#E2E8F0' },
    partyTR: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
    partyTitle: { fontSize: 9, fontWeight: '700', letterSpacing: .07, color: '#185FA5', textTransform: 'uppercase' },
    partyName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    partyD: { fontSize: 11, color: '#64748B', lineHeight: 17 },
    secMini: { fontSize: 9, fontWeight: '700', letterSpacing: .07, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 9 },
    tableWrap: { borderWidth: 0.5, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
    tRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    tHead: { backgroundColor: '#F8FAFC' },
    tRowAlt: { backgroundColor: '#FAFBFF' },
    tFoot: { backgroundColor: '#F8FAFC', borderTopWidth: 0.5, borderTopColor: '#E2E8F0', borderBottomWidth: 0 },
    th: { fontSize: 9, fontWeight: '700', letterSpacing: .06, color: '#94A3B8', padding: 9, textTransform: 'uppercase' },
    thR: { textAlign: 'right' },
    td: { fontSize: 12, color: '#0F172A', padding: 9 },
    tdR: { textAlign: 'right' },
    infoBox: { backgroundColor: '#F8FAFC', borderRadius: 9, padding: 11, gap: 6 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    infoL: { fontSize: 12, color: '#64748B', minWidth: 68 },
    infoV: { flex: 1, fontSize: 12, color: '#374151', fontWeight: '500' },
    termsT: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 5 },
    termsB: { fontSize: 11, color: '#94A3B8', lineHeight: 17 },
    sigRow: {},
    sigCol: { flex: 1 },
    sigLabel: { fontSize: 11, color: '#64748B', marginBottom: 20 },
    sigLine: { height: 0.5, backgroundColor: '#CBD5E1', marginBottom: 7 },
    sigName: { fontSize: 12, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
    sigHint: { fontSize: 10, color: '#94A3B8' },
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