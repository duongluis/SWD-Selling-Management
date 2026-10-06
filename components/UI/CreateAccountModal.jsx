// components/UI/CreateAccountModal.jsx
// Admin tạo tài khoản hộ người dùng (tên + email + mật khẩu + vai trò), kèm các
// thông tin mà người dùng lẽ ra tự khai ở bước đăng ký (app/auth/userInfo.jsx).
// Tài khoản được tạo verified sẵn — người dùng chỉ cần đăng nhập, không qua bước duyệt.

import { showAlert } from '@/components/Main/showAlert';
import { showSuccess } from '@/components/Main/showSuccess';
import { useLayout } from '@/components/Main/TabScreenLayout';
import { createSupportRoom } from '@/components/Utils/chatService';
import BANKS from '@/config/banks.json';
import { db, firebaseConfig } from '@/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import bcrypt from 'bcryptjs';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import {
    Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const ROLE_OPTIONS = [
    { key: 'daily', label: 'Đại lý / NPP', value: 'đại lý', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF' },
    { key: 'phantan', label: 'Đối tác', value: 'Đối tác', icon: 'briefcase-outline', color: '#7C3AED', bg: '#F5F3FF' },
    { key: 'ctv', label: 'Cộng tác viên', value: 'cộng tác viên', icon: 'people-outline', color: '#059669', bg: '#ECFDF5' },
    { key: 'giamdoc', label: 'Giám đốc', value: 'giám đốc', icon: 'ribbon-outline', color: '#D97706', bg: '#FFFBEB' },
    { key: 'admin', label: 'Admin', value: 'admin', icon: 'shield-checkmark-outline', color: '#64748B', bg: '#F1F5F9' },
    { key: 'sale', label: 'Nhân viên bán hàng', value: 'nhân viên bán hàng', icon: 'cash-outline', color: '#CC3333', bg: '#FFFBEB' },
];

const BIZ_MODELS = [
    { key: 'individual', label: 'Cá nhân', icon: 'person-outline' },
    { key: 'company', label: 'Công ty / Hộ kinh doanh', icon: 'business-outline' },
];

const DISTRIBUTION_TYPES = [
    { key: 'exclusive', label: 'Độc quyền', icon: 'lock-closed-outline', color: '#DC2626', bg: '#FEF2F2' },
    { key: 'nonexclusive', label: 'Không độc quyền', icon: 'lock-open-outline', color: '#059669', bg: '#ECFDF5' },
];

// Vai trò nhận hoa hồng → có mã giới thiệu & tài khoản ngân hàng (giống userInfo.jsx)
const COMMISSION_ROLES = ['phantan', 'ctv', 'sale'];

// Mã giới thiệu 12 ký tự — giống hệt logic ở app/auth/userInfo.jsx
const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateCCCD = (v) => /^(\d{9}|\d{12})$/.test(v.trim());

// Các trường "đăng ký hộ" — đều tuỳ chọn, admin có thể bổ sung sau ở màn sửa người dùng
const EMPTY_INFO = {
    phone: '', address: '', bizModel: 'individual',
    companyName: '', taxCode: '', bizAddress: '', contactPhone: '',
    cccd: '', dob: '',
    referralCode: '',
    bank: null, accountNo: '', accountName: '',
    committedRevenue: '', distributionType: '', region: null, province: '',
};

function Field({ label, icon, hint, multiline, ...inputProps }) {
    return (
        <View style={S.fg}>
            <Text style={S.label}>{label}</Text>
            {hint ? <Text style={S.hint}>{hint}</Text> : null}
            <View style={[S.inputBox, multiline && { alignItems: 'flex-start', minHeight: 70 }]}>
                <Ionicons name={icon} size={15} color="#94A3B8" style={multiline && { marginTop: 2 }} />
                <TextInput
                    style={[S.input, multiline && { textAlignVertical: 'top' }]}
                    placeholderTextColor="#94A3B8"
                    multiline={multiline}
                    {...inputProps}
                />
            </View>
        </View>
    );
}

export default function CreateAccountModal({ visible, onClose, onCreated }) {
    const { isDesktop } = useLayout();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [roleKey, setRoleKey] = useState('ctv');
    const [submitting, setSubmitting] = useState(false);

    const [info, setInfo] = useState(EMPTY_INFO);
    const setField = (key) => (value) => setInfo(prev => ({ ...prev, [key]: value }));
    const [openDrop, setOpenDrop] = useState(null); // 'bank' | 'region' | 'province' | null
    const [dropSearch, setDropSearch] = useState('');
    const [regions, setRegions] = useState([]);
    const [regLoading, setRegLoading] = useState(false);

    const isCompany = info.bizModel === 'company';
    const isDaiLy = roleKey === 'daily';
    const hasCommission = COMMISSION_ROLES.includes(roleKey);
    const rev = parseInt(info.committedRevenue) || 0;

    const reset = () => {
        setName(''); setEmail(''); setPassword('');
        setShowPassword(false); setRoleKey('ctv'); setSubmitting(false);
        setInfo(EMPTY_INFO); setOpenDrop(null); setDropSearch('');
    };

    const handleClose = () => { if (!submitting) { reset(); onClose(); } };

    const toggleDrop = (key) => {
        setDropSearch('');
        setOpenDrop(prev => (prev === key ? null : key));
        if (key === 'region' && regions.length === 0 && !regLoading) {
            setRegLoading(true);
            getDocs(collection(db, 'province'))
                .then(snap => setRegions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
                .catch(e => console.error(e))
                .finally(() => setRegLoading(false));
        }
    };

    const accountNoError = () => {
        const { bank, accountNo } = info;
        if (!bank || !accountNo) return '';
        if (accountNo.length >= bank.minLen && accountNo.length <= bank.maxLen) return '';
        return `Số TK ${bank.name} phải có ${bank.minLen === bank.maxLen ? bank.minLen : `${bank.minLen}–${bank.maxLen}`} chữ số`;
    };

    const handleCreate = async () => {
        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const referralInput = hasCommission ? info.referralCode.trim().toUpperCase() : '';

        if (!trimmedName) { showAlert('Thông báo', 'Vui lòng nhập họ tên'); return; }
        if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) { showAlert('Thông báo', 'Email không hợp lệ'); return; }
        if (!password || password.length < 6) { showAlert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự'); return; }

        if (!isCompany) {
            if (info.cccd && !validateCCCD(info.cccd)) { showAlert('Thông báo', 'Số CCCD phải có 12 chữ số (hoặc CMND 9 chữ số)'); return; }
            if (info.dob && (parseInt(info.dob) < 1900 || parseInt(info.dob) > new Date().getFullYear())) {
                showAlert('Thông báo', 'Năm sinh không hợp lệ'); return;
            }
        }
        if (hasCommission && info.bank) {
            if (!info.accountNo.trim()) { showAlert('Thông báo', 'Vui lòng nhập số tài khoản'); return; }
            if (accountNoError()) { showAlert('Thông báo', accountNoError()); return; }
            if (!info.accountName.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên chủ tài khoản'); return; }
        }
        if (isDaiLy && info.distributionType === 'exclusive' && (!info.region || !info.province)) {
            showAlert('Thông báo', 'Vui lòng chọn vùng/miền và tỉnh/thành phố khi chọn phân phối độc quyền');
            return;
        }

        setSubmitting(true);


        // Dùng 1 Firebase App phụ (secondary instance) để tạo tài khoản — tránh
        // createUserWithEmailAndPassword tự động đăng nhập vào tài khoản mới đó
        // trên CHÍNH phiên hiện tại của admin (hành vi mặc định của Firebase Auth
        // client SDK), khiến admin bị đăng xuất khỏi tài khoản của mình.

        const secondaryApp = initializeApp(firebaseConfig, `create-account-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const existing = await getDoc(doc(db, 'users', normalizedEmail));
            if (existing.exists()) {
                showAlert('Thông báo', 'Email này đã có tài khoản trong hệ thống.');
                return;
            }

            // Kiểm tra mã giới thiệu TRƯỚC khi tạo tài khoản Auth — tránh để lại tài khoản mồ côi
            let advisor = null;
            if (referralInput) {
                const snap = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referralInput)));
                if (snap.empty) {
                    showAlert('Mã giới thiệu không hợp lệ', 'Vui lòng kiểm tra lại mã.');
                    return;
                }
                advisor = snap.docs[0].data().email;
            }

            const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
            const uid = cred.user.uid;
            await signOut(secondaryAuth);

            const passwordHash = await bcrypt.hash(password, 10);
            const roleCfg = ROLE_OPTIONS.find(r => r.key === roleKey) || ROLE_OPTIONS[2];

            const payload = {
                uid,
                email: normalizedEmail,
                name: trimmedName,
                phone: info.phone.trim(),
                address: info.address.trim(),
                role: roleCfg.value,
                member: roleCfg.value,
                bizModel: info.bizModel,
                verified: true,
                createdAt: new Date().toISOString(),
                passwordHash,
            };
            if (isCompany) {
                // Giống userInfo.jsx: tên hiển thị là tên công ty, họ tên là người liên hệ
                payload.companyName = info.companyName.trim();
                payload.taxCode = info.taxCode.trim();
                payload.bizAddress = info.bizAddress.trim();
                payload.name = info.companyName.trim() || trimmedName;
                payload.contactName = trimmedName;
                payload.contactPhone = info.contactPhone.trim();
            } else {
                if (info.cccd.trim()) payload.cccd = info.cccd.trim();
                if (info.dob) payload.dob = info.dob;
            }
            if (isDaiLy) {
                if (rev) payload.committedRevenue = rev;
                if (info.distributionType) payload.distributionType = info.distributionType;
                if (info.region) {
                    payload.region = info.region.id;
                    payload.regionName = info.region.name;
                    payload.province = info.province || null;
                }
            }
            if (hasCommission && info.bank) {
                payload.bank = { id: info.bank.id, name: info.bank.name, accountNo: info.accountNo.trim(), accountName: info.accountName.trim() };
            }
            if (advisor) payload.advisor = advisor;
            // Giống logic userInfo.jsx: chỉ ctv/đối tác không có mã giới thiệu riêng
            if (roleKey !== 'ctv' && roleKey !== 'phantan') {
                payload.referralCode = generateReferralCode();
            }

            await setDoc(doc(db, 'users', normalizedEmail), payload);

            createSupportRoom({
                userEmail: normalizedEmail,
                userName: payload.name || normalizedEmail,
            }).catch(err => console.warn('Lỗi tạo phòng support:', err));

            showSuccess('Đã tạo tài khoản!', `${normalizedEmail} có thể đăng nhập ngay bằng mật khẩu đã nhập.`, () => { });
            onCreated?.(payload);
            reset();
            onClose();
        } catch (e) {
            const msg = e.code === 'auth/email-already-in-use'
                ? 'Email này đã được đăng ký trên Firebase Auth.'
                : e.message;
            showAlert('Lỗi', msg);
        } finally {
            setSubmitting(false);
            deleteApp(secondaryApp).catch(() => { });
        }
    };

    // Dropdown chọn 1 giá trị (ngân hàng / vùng / tỉnh)
    const renderDrop = ({ dropKey, icon, placeholder, selectedLabel, items, getKey, getLabel, onSelect, searchable, emptyText }) => {
        const open = openDrop === dropKey;
        const keyword = dropSearch.toLowerCase();
        const shown = searchable && keyword ? items.filter(it => getLabel(it).toLowerCase().includes(keyword)) : items;
        return (
            <>
                <TouchableOpacity style={[S.inputBox, open && { borderColor: '#2563EB' }]} onPress={() => toggleDrop(dropKey)} activeOpacity={0.8}>
                    <Ionicons name={icon} size={15} color="#94A3B8" />
                    <Text style={[S.input, !selectedLabel && { color: '#94A3B8' }]}>{selectedLabel || placeholder}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                </TouchableOpacity>
                {open && (
                    <View style={S.drop}>
                        {searchable && (
                            <View style={S.dropSearchRow}>
                                <Ionicons name="search-outline" size={13} color="#94A3B8" />
                                <TextInput style={{ flex: 1, fontSize: 13, color: '#0F172A' }} placeholder="Tìm kiếm..." placeholderTextColor="#94A3B8" value={dropSearch} onChangeText={setDropSearch} />
                            </View>
                        )}
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                            {shown.length === 0 ? <Text style={S.dropEmpty}>{emptyText || 'Không tìm thấy'}</Text>
                                : shown.map(it => {
                                    const active = getLabel(it) === selectedLabel;
                                    return (
                                        <TouchableOpacity key={getKey(it)} style={[S.dropItem, active && S.dropActive]} onPress={() => { onSelect(it); setOpenDrop(null); setDropSearch(''); }} activeOpacity={0.7}>
                                            <Text style={[S.dropText, active && { color: '#2563EB', fontWeight: '700' }]}>{getLabel(it)}</Text>
                                            {active && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                    </View>
                )}
            </>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={S.overlay}>
                <View style={[S.card, isDesktop && S.cardDesktop]}>
                    {/* Header */}
                    <View style={S.header}>
                        <View style={S.headerIcon}>
                            <Ionicons name="person-add" size={18} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={S.title}>Tạo tài khoản hộ</Text>
                            <Text style={S.subtitle}>Tài khoản mẫu — người dùng chỉ cần đăng nhập</Text>
                        </View>
                        <TouchableOpacity style={S.closeBtn} onPress={handleClose} disabled={submitting}>
                            <Ionicons name="close" size={16} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={S.body} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                        {/* Họ tên */}
                        <View style={S.fg}>
                            <Text style={S.label}>Họ và tên <Text style={S.req}>*</Text></Text>
                            <View style={S.inputBox}>
                                <Ionicons name="person-outline" size={15} color="#94A3B8" />
                                <TextInput
                                    style={S.input}
                                    placeholder="Nguyễn Văn A"
                                    placeholderTextColor="#94A3B8"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        </View>

                        {/* Email */}
                        <View style={S.fg}>
                            <Text style={S.label}>Email <Text style={S.req}>*</Text></Text>
                            <View style={S.inputBox}>
                                <Ionicons name="mail-outline" size={15} color="#94A3B8" />
                                <TextInput
                                    style={S.input}
                                    placeholder="name@company.com"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                        </View>

                        {/* Mật khẩu */}
                        <View style={S.fg}>
                            <Text style={S.label}>Mật khẩu <Text style={S.req}>*</Text></Text>
                            <Text style={S.hint}>Tối thiểu 6 ký tự — gửi lại cho người dùng để họ đăng nhập</Text>
                            <View style={S.inputBox}>
                                <Ionicons name="lock-closed-outline" size={15} color="#94A3B8" />
                                <TextInput
                                    style={S.input}
                                    placeholder="Nhập mật khẩu..."
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={8}>
                                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={15} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Vai trò */}
                        <View style={S.fg}>
                            <Text style={S.label}>Vai trò <Text style={S.req}>*</Text></Text>
                            <Text style={S.hint}>Không thể đổi sau khi tạo — chọn kỹ trước khi lưu</Text>
                            <View style={S.roleGrid}>
                                {ROLE_OPTIONS.map(r => {
                                    const active = roleKey === r.key;
                                    return (
                                        <TouchableOpacity
                                            key={r.key}
                                            style={[S.roleChip, { borderColor: active ? r.color : '#E2E8F0' }, active && { backgroundColor: r.bg }]}
                                            onPress={() => setRoleKey(r.key)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={r.icon} size={14} color={active ? r.color : '#94A3B8'} />
                                            <Text style={[S.roleChipText, active && { color: r.color, fontWeight: '700' }]}>{r.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* ── Thông tin đăng ký hộ (tuỳ chọn) ── */}
                        <View style={S.sectionHeader}>
                            <Ionicons name="clipboard-outline" size={14} color="#2563EB" />
                            <Text style={S.sectionTitle}>Thông tin đăng ký</Text>
                            <Text style={S.sectionNote}>(tuỳ chọn)</Text>
                        </View>

                        <Field label="Số điện thoại" icon="call-outline" placeholder="0901 234 567" keyboardType="phone-pad" value={info.phone} onChangeText={setField('phone')} />
                        <Field label="Địa chỉ giao dịch" icon="location-outline" placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..." multiline value={info.address} onChangeText={setField('address')} />

                        {/* Mô hình kinh doanh */}
                        <View style={S.fg}>
                            <Text style={S.label}>Mô hình kinh doanh</Text>
                            <View style={S.roleGrid}>
                                {BIZ_MODELS.map(m => {
                                    const active = info.bizModel === m.key;
                                    return (
                                        <TouchableOpacity
                                            key={m.key}
                                            style={[S.roleChip, { borderColor: active ? '#2563EB' : '#E2E8F0' }, active && { backgroundColor: '#EFF6FF' }]}
                                            onPress={() => setField('bizModel')(m.key)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={m.icon} size={14} color={active ? '#2563EB' : '#94A3B8'} />
                                            <Text style={[S.roleChipText, active && { color: '#2563EB', fontWeight: '700' }]}>{m.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {isCompany ? (
                            <>
                                <Field label="Tên công ty / Hộ kinh doanh" icon="business-outline" hint="Dùng làm tên hiển thị — họ tên ở trên là người liên hệ" placeholder="Công ty TNHH ABC..." value={info.companyName} onChangeText={setField('companyName')} />
                                <Field label="Mã số thuế" icon="document-text-outline" placeholder="0123456789" keyboardType="numeric" value={info.taxCode} onChangeText={setField('taxCode')} />
                                <Field label="Địa chỉ đăng ký kinh doanh" icon="location-outline" placeholder="Địa chỉ theo ĐKKD..." multiline value={info.bizAddress} onChangeText={setField('bizAddress')} />
                                <Field label="Số điện thoại người liên hệ" icon="call-outline" placeholder="0901 234 567" keyboardType="phone-pad" value={info.contactPhone} onChangeText={setField('contactPhone')} />
                            </>
                        ) : (
                            <>
                                <Field label="Số CCCD / CMND" icon="card-outline" hint="12 chữ số (CCCD mới) hoặc 9 chữ số (CMND cũ)" placeholder="001234567890" keyboardType="numeric" maxLength={12} value={info.cccd} onChangeText={v => setField('cccd')(v.replace(/\D/g, ''))} />
                                <Field label="Năm sinh" icon="calendar-outline" placeholder="VD: 1990" keyboardType="numeric" maxLength={4} value={info.dob} onChangeText={v => setField('dob')(v.replace(/\D/g, ''))} />
                            </>
                        )}

                        {/* Đại lý: cam kết doanh thu & phân phối */}
                        {isDaiLy && (
                            <>
                                <Field
                                    label="Doanh thu cam kết (năm)" icon="cash-outline" placeholder="Nhập số tiền (VNĐ)..." keyboardType="numeric"
                                    value={rev ? rev.toLocaleString('vi-VN') : ''}
                                    onChangeText={v => setField('committedRevenue')(v.replace(/\D/g, ''))}
                                />
                                <View style={S.fg}>
                                    <Text style={S.label}>Hình thức phân phối</Text>
                                    <View style={S.roleGrid}>
                                        {DISTRIBUTION_TYPES.map(dt => {
                                            const active = info.distributionType === dt.key;
                                            return (
                                                <TouchableOpacity
                                                    key={dt.key}
                                                    style={[S.roleChip, { borderColor: active ? dt.color : '#E2E8F0' }, active && { backgroundColor: dt.bg }]}
                                                    onPress={() => setField('distributionType')(active ? '' : dt.key)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name={dt.icon} size={14} color={active ? dt.color : '#94A3B8'} />
                                                    <Text style={[S.roleChipText, active && { color: dt.color, fontWeight: '700' }]}>{dt.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                                <View style={S.fg}>
                                    <Text style={S.label}>Khu vực phụ trách</Text>
                                    <Text style={S.hint}>Bắt buộc nếu chọn Độc quyền</Text>
                                    <View style={{ gap: 8 }}>
                                        {renderDrop({
                                            dropKey: 'region', icon: 'map-outline', placeholder: 'Chọn vùng / miền...',
                                            selectedLabel: info.region?.name, items: regions,
                                            getKey: r => r.id, getLabel: r => r.name,
                                            onSelect: r => setInfo(prev => ({ ...prev, region: r, province: '' })),
                                            emptyText: regLoading ? 'Đang tải...' : 'Chưa có dữ liệu',
                                        })}
                                        {info.region && renderDrop({
                                            dropKey: 'province', icon: 'business-outline', placeholder: 'Chọn tỉnh / thành phố...',
                                            selectedLabel: info.province, items: (info.region.cities || []).map(c => c.ten),
                                            getKey: p => p, getLabel: p => p,
                                            onSelect: setField('province'), searchable: true,
                                        })}
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Đối tác / CTV / NVBH: mã giới thiệu & ngân hàng nhận hoa hồng */}
                        {hasCommission && (
                            <>
                                <Field label="Mã giới thiệu" icon="gift-outline" hint="Mã của người giới thiệu — tài khoản sẽ được gắn vào người này" placeholder="Nhập mã giới thiệu" autoCapitalize="characters" value={info.referralCode} onChangeText={setField('referralCode')} />
                                <View style={S.fg}>
                                    <Text style={S.label}>Ngân hàng</Text>
                                    <Text style={S.hint}>Dùng để nhận hoa hồng và thanh toán</Text>
                                    {renderDrop({
                                        dropKey: 'bank', icon: 'search-outline', placeholder: 'Tìm và chọn ngân hàng...',
                                        selectedLabel: info.bank?.name, items: BANKS,
                                        getKey: b => b.id, getLabel: b => b.name,
                                        onSelect: b => setInfo(prev => ({ ...prev, bank: b, accountNo: '' })),
                                        searchable: true,
                                    })}
                                </View>
                                {info.bank && (
                                    <>
                                        <Field label="Số tài khoản" icon="card-outline" placeholder="Nhập số tài khoản..." keyboardType="numeric" value={info.accountNo} onChangeText={v => setField('accountNo')(v.replace(/\D/g, ''))} />
                                        {accountNoError() ? <Text style={S.errText}>{accountNoError()}</Text> : null}
                                        <Field label="Tên chủ tài khoản" icon="person-outline" hint="Nhập chính xác như trên thẻ ngân hàng (IN HOA)" placeholder="NGUYEN VAN A" autoCapitalize="characters" value={info.accountName} onChangeText={t => setField('accountName')(t.toUpperCase())} />
                                        <TouchableOpacity style={S.clearBank} onPress={() => setInfo(prev => ({ ...prev, bank: null, accountNo: '', accountName: '' }))}>
                                            <Ionicons name="close-circle-outline" size={13} color="#94A3B8" />
                                            <Text style={S.clearBankText}>Bỏ thông tin ngân hàng</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={S.footer}>
                        <TouchableOpacity style={S.cancelBtn} onPress={handleClose} disabled={submitting}>
                            <Text style={S.cancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[S.createBtn, submitting && { opacity: 0.7 }]}
                            onPress={handleCreate}
                            disabled={submitting}
                        >
                            <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
                            <Text style={S.createBtnText}>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const S = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
        alignItems: 'center', justifyContent: 'center', padding: 16,
    },
    card: {
        width: '100%', maxWidth: 480, maxHeight: '90%',
        backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    },
    cardDesktop: { borderRadius: 14 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    subtitle: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    body: { paddingHorizontal: 16, paddingTop: 14 },
    fg: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
    req: { color: '#EF4444' },
    hint: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
    errText: { fontSize: 11, color: '#EF4444', marginTop: -10, marginBottom: 12 },
    inputBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#F8FAFC', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 11,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    input: { flex: 1, fontSize: 14, color: '#0F172A' },

    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingTop: 14, marginBottom: 14,
        borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    sectionNote: { fontSize: 11, color: '#94A3B8' },

    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1.5, backgroundColor: '#fff',
    },
    roleChipText: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },

    drop: { marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
    dropSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    dropActive: { backgroundColor: '#EFF6FF' },
    dropText: { flex: 1, fontSize: 13, color: '#374151' },
    dropEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },

    clearBank: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: -6, marginBottom: 16 },
    clearBankText: { fontSize: 11.5, color: '#94A3B8', fontWeight: '600' },

    footer: {
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 16, paddingVertical: 14,
        borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9' },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    createBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563EB' },
    createBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
