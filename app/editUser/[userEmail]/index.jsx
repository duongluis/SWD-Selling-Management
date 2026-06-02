// app/editUser/index.jsx
import BgWatermark from '@/components/Main/BgWatermark';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../../components/Main/showAlert';
import { showSuccess } from '../../../components/Main/showSuccess';
import { db } from '../../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';

const ROLE_CONFIG = {
    'đại lý': { color: '#2563EB', bg: '#EFF6FF', label: 'Đại lý / NPP' },
    'đối tác': { color: '#7C3AED', bg: '#F5F3FF', label: 'Đối tác' },
    'partner': { color: '#7C3AED', bg: '#F5F3FF', label: 'Đối tác' },
    'cộng tác viên': { color: '#059669', bg: '#ECFDF5', label: 'Cộng tác viên' },
    'ctv': { color: '#059669', bg: '#ECFDF5', label: 'Cộng tác viên' },
};
const getRoleCfg = (role) =>
    ROLE_CONFIG[(role || '').toLowerCase()] ||
    { color: '#64748B', bg: '#F1F5F9', label: role || 'Chưa rõ' };

// ── Field component ───────────────────────────────────────────
function Field({ label, value, onChange, multiline, keyboard, required, hint, readOnly }) {
    return (
        <View style={F.group}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Text style={F.label}>{label}</Text>
                {required && <Text style={F.req}>*</Text>}
                {hint && <Text style={F.hint}>{hint}</Text>}
            </View>
            {readOnly ? (
                <View style={[F.inputBox, { backgroundColor: '#F8FAFC' }]}>
                    <Text style={[F.input, { color: '#94A3B8' }]}>{value || '—'}</Text>
                    <Ionicons name="lock-closed-outline" size={13} color="#CBD5E1" />
                </View>
            ) : (
                <View style={[F.inputBox, multiline && { alignItems: 'flex-start', minHeight: 80 }]}>
                    <TextInput
                        style={[F.input, multiline && { textAlignVertical: 'top' }]}
                        value={value || ''}
                        onChangeText={onChange}
                        multiline={multiline}
                        keyboardType={keyboard || 'default'}
                        placeholderTextColor="#94A3B8"
                        placeholder={`Nhập ${label.toLowerCase()}...`}
                    />
                </View>
            )}
        </View>
    );
}

// ── Section header ─────────────────────────────────────────────
function Section({ icon, title, color = '#2563EB', children }) {
    return (
        <View style={S.section}>
            <View style={[S.sectionHeader, { borderLeftColor: color }]}>
                <Ionicons name={icon} size={15} color={color} />
                <Text style={[S.sectionTitle, { color }]}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function EditUserScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { isDesktop } = useLayout();

    const user = params.userParam ? JSON.parse(params.userParam) : {};
    const roleCfg = getRoleCfg(user.role || user.member);

    const isCompany = user.bizModel === 'company';
    const isIndiv = user.bizModel === 'individual';
    const isDaiLy = (user.role || user.member || '').toLowerCase().includes('đại lý');
    const needsBank = ['đối tác', 'partner', 'cộng tác viên', 'ctv'].some(r =>
        (user.role || user.member || '').toLowerCase().includes(r)
    );

    // ── Form state ───────────────────────────────────────────
    const [name, setName] = useState(user.name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [address, setAddress] = useState(user.address || '');
    const [adminNote, setAdminNote] = useState(user.adminNote || '');
    // Company
    const [companyName, setCompanyName] = useState(user.companyName || '');
    const [taxCode, setTaxCode] = useState(user.taxCode || '');
    const [bizAddress, setBizAddress] = useState(user.bizAddress || '');
    // Individual
    const [cccd, setCccd] = useState(user.cccd || '');
    // Đại lý
    const [committedRevenue] = useState(user.committedRevenue || 0);
    const [distributionType] = useState(user.distributionType || '');
    // Bank
    const [accountName, setAccountName] = useState(user.bank?.accountName || '');

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) { showAlert('Thông báo', 'Vui lòng nhập họ tên'); return; }
        if (!phone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim(),
                adminNote: adminNote.trim(),
            };
            if (isCompany) {
                payload.companyName = companyName.trim();
                payload.taxCode = taxCode.trim();
                payload.bizAddress = bizAddress.trim();
            }
            if (isIndiv) {
                payload.cccd = cccd.trim();
            }
            if (needsBank && user.bank) {
                payload.bank = { ...user.bank, accountName: accountName.trim() };
            }

            await updateDoc(doc(db, 'users', user.email), payload);
            showSuccess('Đã lưu', 'Thông tin tài khoản đã được cập nhật.', () => router.back());
        } catch (e) {
            showAlert('Lỗi', e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/user')} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.headerTitle}>Chỉnh sửa tài khoản</Text>
                    <Text style={S.headerSub}>{user.email}</Text>
                </View>
                {/* Role badge */}
                <View style={[S.roleBadge, { backgroundColor: roleCfg.bg }]}>
                    <Text style={[S.roleBadgeText, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[S.scroll, { padding: isDesktop ? 32 : 16 }]}
                >
                    <View style={isDesktop ? S.gridWeb : undefined}>

                        {/* ── LEFT col ── */}
                        <View style={isDesktop ? S.colLeft : undefined}>

                            {/* Thông tin liên hệ */}
                            <Section icon="person-circle-outline" title="Thông tin liên hệ">
                                <Field label="Họ và tên" value={name} onChange={setName} required />
                                <Field label="Số điện thoại" value={phone} onChange={setPhone} required keyboard="phone-pad" />
                                <Field label="Địa chỉ" value={address} onChange={setAddress} multiline />
                                <Field label="Email tài khoản" value={user.email} readOnly />
                                {user.emailContact && <Field label="Email liên hệ" value={user.emailContact} readOnly />}
                                <Field label="Ngày đăng ký" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'} readOnly />
                            </Section>

                            {/* Doanh nghiệp */}
                            {isCompany && (
                                <Section icon="business-outline" title="Thông tin doanh nghiệp" color="#7C3AED">
                                    <Field label="Tên công ty / HKD" value={companyName} onChange={setCompanyName} required />
                                    <Field label="Mã số thuế" value={taxCode} onChange={setTaxCode} required keyboard="numeric" />
                                    <Field label="Địa chỉ đăng ký kinh doanh" value={bizAddress} onChange={setBizAddress} multiline required />
                                </Section>
                            )}

                            {/* Cá nhân */}
                            {isIndiv && (
                                <Section icon="card-outline" title="Thông tin cá nhân" color="#7C3AED">
                                    <Field label="Số CCCD / CMND" value={cccd} onChange={setCccd} keyboard="numeric"
                                        hint="(9 hoặc 12 chữ số)" />
                                    {user.dob && <Field label="Ngày sinh" value={user.dob} readOnly />}
                                </Section>
                            )}
                        </View>

                        {/* ── RIGHT col ── */}
                        <View style={isDesktop ? S.colRight : undefined}>

                            {/* Cam kết đại lý */}
                            {isDaiLy && (
                                <Section icon="trending-up-outline" title="Cam kết đại lý" color="#F59E0B">
                                    <Field
                                        label="Doanh thu cam kết"
                                        value={committedRevenue ? committedRevenue.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '—'}
                                        readOnly
                                    />
                                    <Field
                                        label="Hình thức phân phối"
                                        value={distributionType === 'exclusive' ? 'Độc quyền' : distributionType === 'nonexclusive' ? 'Không độc quyền' : '—'}
                                        readOnly
                                    />
                                    {user.regionName && (
                                        <Field
                                            label="Khu vực"
                                            value={`${user.regionName}${user.province ? ` · ${user.province}` : ''}`}
                                            readOnly
                                        />
                                    )}
                                </Section>
                            )}

                            {/* Ngân hàng */}
                            {needsBank && user.bank && (
                                <Section icon="card-outline" title="Thông tin ngân hàng" color="#059669">
                                    <Field label="Ngân hàng" value={`${user.bank.name} (${user.bank.id})`} readOnly />
                                    <Field label="Số tài khoản" value={user.bank.accountNo} readOnly />
                                    <Field label="Tên chủ tài khoản" value={accountName} onChange={setAccountName} />
                                </Section>
                            )}

                            {/* Trạng thái */}
                            <Section icon="shield-checkmark-outline" title="Trạng thái tài khoản" color="#64748B">
                                <Field
                                    label="Trạng thái"
                                    value={user.verified ? `✅ Đã xác thực · ${user.verifiedAt ? new Date(user.verifiedAt).toLocaleDateString('vi-VN') : ''}` : '⏳ Chờ xác thực'}
                                    readOnly
                                />
                                <Field label="Mô hình kinh doanh"
                                    value={user.bizModel === 'company' ? 'Công ty / Hộ kinh doanh' : user.bizModel === 'individual' ? 'Cá nhân' : '—'}
                                    readOnly
                                />
                            </Section>

                            {/* Admin note */}
                            <Section icon="create-outline" title="Ghi chú admin" color="#94A3B8">
                                <Field label="Ghi chú nội bộ" value={adminNote} onChange={setAdminNote} multiline
                                    hint="(Không hiển thị cho người dùng)" />
                            </Section>

                        </View>
                    </View>

                    <View style={{ height: insets.bottom + 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom save bar */}
            <View style={[S.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={S.cancelBtn} onPress={() => router.back()} activeOpacity={0.8}>
                    <Text style={S.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[S.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    <Ionicons name={saving ? 'hourglass-outline' : 'save-outline'} size={17} color="#fff" />
                    <Text style={S.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    roleBadgeText: { fontSize: 11, fontWeight: '700' },
    scroll: {},
    gridWeb: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    colLeft: { flex: 1.4 },
    colRight: { flex: 1 },
    section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderLeftWidth: 3, paddingLeft: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '700' },
    bottomBar: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', flexDirection: 'row', gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: '#2563EB', shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

const F = StyleSheet.create({
    group: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '600', color: '#374151' },
    req: { fontSize: 12, color: '#EF4444' },
    hint: { fontSize: 11, color: '#94A3B8' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 6 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
});