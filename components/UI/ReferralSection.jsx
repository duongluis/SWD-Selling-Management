// components/UI/ReferralSection.jsx
// Nút "Được giới thiệu" + form người giới thiệu (người ngoài không có tài khoản).
// Chỉ admin@swd.vn thấy — màn gọi tự kiểm tra quyền (canAdjustCommissionAccount).
// Dùng ở màn Tạo khách hàng và Sửa khách hàng; logic lưu/tính hoa hồng ở commissionCalc.js.

import { normalizePhone } from '@/components/Utils/commissionCalc';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BANKS from '../../config/banks.json';

export const EMPTY_REFERRAL_FORM = { percent: '', name: '', phone: '', bankId: '', accountNo: '', accountOwner: '' };

/** Dữ liệu `referral` đã lưu → giá trị form */
export const referralToForm = (r) => r ? {
    percent: String(r.percent ?? ''),
    name: r.name || '',
    phone: r.phone || '',
    bankId: r.bankId || '',
    accountNo: r.accountNo || '',
    accountOwner: r.accountOwner || '',
} : EMPTY_REFERRAL_FORM;

export const findBank = (id) => BANKS.find(b => b.id === id) || null;

/**
 * @param enabled     nút "Được giới thiệu" đang bật
 * @param onToggle    (bool) => void
 * @param form        { percent, name, phone, bankId, accountNo, accountOwner }
 * @param onChange    (field, value) => void
 * @param usedOrderId khi quyền giới thiệu đã dùng: hiện thông tin chỉ đọc, khoá sửa
 */
export default function ReferralSection({ enabled, onToggle, form, onChange, usedOrderId }) {
    const [showBanks, setShowBanks] = useState(false);
    const [bankSearch, setBankSearch] = useState('');
    const bank = findBank(form.bankId);
    const locked = !!usedOrderId;

    const q = bankSearch.trim().toLowerCase();
    const banks = q
        ? BANKS.filter(b => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q))
        : BANKS;

    // Chỉ nhận số và 1 dấu thập phân (chấp nhận cả dấu phẩy kiểu Việt Nam)
    const handlePercent = (v) => {
        const clean = v.replace(',', '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        onChange('percent', clean);
    };

    return (
        <View style={[S.wrap, enabled && S.wrapOn]}>
            <View style={S.headRow}>
                <View style={[S.iconBox, enabled && S.iconBoxOn]}>
                    <Ionicons name="gift-outline" size={16} color={enabled ? '#fff' : '#2563EB'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={S.title}>Được giới thiệu</Text>
                    <Text style={S.sub}>
                        {locked
                            ? `Đã dùng hoa hồng giới thiệu cho đơn #${usedOrderId}`
                            : 'Người ngoài (không có tài khoản) giới thiệu khách. Đơn đã thanh toán đầu tiên có hoa hồng theo %.'}
                    </Text>
                </View>
                {!locked && (
                    <Switch
                        value={enabled}
                        onValueChange={onToggle}
                        trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                        thumbColor={enabled ? '#2563EB' : '#F8FAFC'}
                    />
                )}
            </View>

            {enabled && (
                <View style={S.body}>
                    <Field label="Hoa hồng đơn đầu tiên (%)" required>
                        <View style={S.inputBox}>
                            <Ionicons name="trending-up-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={S.input}
                                value={form.percent}
                                onChangeText={handlePercent}
                                placeholder="VD: 2.5"
                                placeholderTextColor="#94A3B8"
                                keyboardType="decimal-pad"
                                editable={!locked}
                            />
                            <Text style={S.suffix}>%</Text>
                        </View>
                    </Field>

                    <Field label="Tên người giới thiệu" required>
                        <View style={S.inputBox}>
                            <Ionicons name="person-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={S.input}
                                value={form.name}
                                onChangeText={v => onChange('name', v)}
                                placeholder="Họ và tên"
                                placeholderTextColor="#94A3B8"
                                editable={!locked}
                            />
                        </View>
                    </Field>

                    <Field label="SĐT người giới thiệu" required>
                        <View style={S.inputBox}>
                            <Ionicons name="call-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={S.input}
                                value={form.phone}
                                onChangeText={v => onChange('phone', normalizePhone(v))}
                                placeholder="0901234567"
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                                maxLength={11}
                                editable={!locked}
                            />
                        </View>
                    </Field>

                    <Field label="Ngân hàng" required>
                        <TouchableOpacity
                            style={S.inputBox}
                            onPress={() => !locked && setShowBanks(p => !p)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="business-outline" size={16} color="#94A3B8" />
                            <Text style={[S.input, !bank && { color: '#94A3B8' }]} numberOfLines={1}>
                                {bank ? `${bank.shortName} — ${bank.name}` : 'Chọn ngân hàng'}
                            </Text>
                            {!locked && <Ionicons name={showBanks ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />}
                        </TouchableOpacity>
                        {showBanks && (
                            <View style={S.dropdown}>
                                <View style={S.searchRow}>
                                    <Ionicons name="search-outline" size={14} color="#94A3B8" />
                                    <TextInput
                                        style={S.searchInput}
                                        value={bankSearch}
                                        onChangeText={setBankSearch}
                                        placeholder="Tìm ngân hàng..."
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {banks.map(b => (
                                        <TouchableOpacity
                                            key={b.id}
                                            style={[S.bankItem, b.id === form.bankId && S.bankItemActive]}
                                            onPress={() => { onChange('bankId', b.id); setShowBanks(false); setBankSearch(''); }}
                                        >
                                            <Text style={[S.bankText, b.id === form.bankId && { color: '#2563EB', fontWeight: '700' }]}>
                                                {b.shortName} — {b.name}
                                            </Text>
                                            {b.id === form.bankId && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                                        </TouchableOpacity>
                                    ))}
                                    {banks.length === 0 && <Text style={S.empty}>Không tìm thấy ngân hàng</Text>}
                                </ScrollView>
                            </View>
                        )}
                    </Field>

                    <Field label="Số tài khoản" required>
                        <View style={S.inputBox}>
                            <Ionicons name="card-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={S.input}
                                value={form.accountNo}
                                onChangeText={v => onChange('accountNo', normalizePhone(v))}
                                placeholder={bank ? `${bank.minLen === bank.maxLen ? bank.minLen : `${bank.minLen}–${bank.maxLen}`} chữ số` : 'Số tài khoản'}
                                placeholderTextColor="#94A3B8"
                                keyboardType="number-pad"
                                maxLength={bank?.maxLen || 20}
                                editable={!locked}
                            />
                        </View>
                    </Field>

                    <Field label="Chủ tài khoản" required last>
                        <View style={S.inputBox}>
                            <Ionicons name="person-circle-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={S.input}
                                value={form.accountOwner}
                                onChangeText={v => onChange('accountOwner', v)}
                                placeholder="NGUYEN VAN A"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="characters"
                                editable={!locked}
                            />
                        </View>
                    </Field>
                </View>
            )}
        </View>
    );
}

function Field({ label, required, last, children }) {
    return (
        <View style={[S.field, last && { marginBottom: 0 }]}>
            <Text style={S.label}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text>
            {children}
        </View>
    );
}

const S = StyleSheet.create({
    // Thẻ đứng riêng, nằm trên thẻ "Thông tin cá nhân" (nền trang xám nên thẻ để nền trắng)
    wrap: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, backgroundColor: '#FFFFFF', marginBottom: 16 },
    wrapOn: { borderColor: '#BFDBFE', backgroundColor: '#F5F9FF' },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    iconBoxOn: { backgroundColor: '#2563EB' },
    title: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    sub: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
    body: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14 },
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500', padding: 0 },
    suffix: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    dropdown: { marginTop: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    searchInput: { flex: 1, fontSize: 13, color: '#0F172A', padding: 0 },
    bankItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    bankItemActive: { backgroundColor: '#EFF6FF' },
    bankText: { fontSize: 13, color: '#374151', flex: 1 },
    empty: { padding: 12, fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});
