// components/UI/CreateAccountModal.jsx
// Admin tạo tài khoản mẫu hộ người dùng (tên + email + mật khẩu + vai trò).
// Tài khoản được tạo verified sẵn — người dùng chỉ cần đăng nhập, không qua bước duyệt.

import { showAlert } from '@/components/Main/showAlert';
import { showSuccess } from '@/components/Main/showSuccess';
import { useLayout } from '@/components/Main/TabScreenLayout';
import { createSupportRoom } from '@/components/Utils/chatService';
import { db, firebaseConfig } from '@/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import bcrypt from 'bcryptjs';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
];

// Mã giới thiệu 12 ký tự — giống hệt logic ở app/auth/userInfo.jsx
const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateAccountModal({ visible, onClose, onCreated }) {
    const { isDesktop } = useLayout();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [roleKey, setRoleKey] = useState('ctv');
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setName(''); setEmail(''); setPassword('');
        setShowPassword(false); setRoleKey('ctv'); setSubmitting(false);
    };

    const handleClose = () => { if (!submitting) { reset(); onClose(); } };

    const handleCreate = async () => {
        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!trimmedName) { showAlert('Thông báo', 'Vui lòng nhập họ tên'); return; }
        if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) { showAlert('Thông báo', 'Email không hợp lệ'); return; }
        if (!password || password.length < 6) { showAlert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự'); return; }

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

            const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
            const uid = cred.user.uid;
            await signOut(secondaryAuth);

            const passwordHash = await bcrypt.hash(password, 10);
            const roleCfg = ROLE_OPTIONS.find(r => r.key === roleKey) || ROLE_OPTIONS[2];

            const payload = {
                uid,
                email: normalizedEmail,
                name: trimmedName,
                phone: '',
                address: '',
                role: roleCfg.value,
                member: roleCfg.value,
                bizModel: 'individual',
                verified: true,
                createdAt: new Date().toISOString(),
                passwordHash,
            };
            // Giống logic userInfo.jsx: chỉ ctv/đối tác không có mã giới thiệu riêng
            if (roleKey !== 'ctv' && roleKey !== 'phantan') {
                payload.referralCode = generateReferralCode();
            }

            await setDoc(doc(db, 'users', normalizedEmail), payload);

            createSupportRoom({
                userEmail: normalizedEmail,
                userName: trimmedName || normalizedEmail,
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

                    <ScrollView style={S.body} showsVerticalScrollIndicator={true}>
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
    inputBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#F8FAFC', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 11,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    input: { flex: 1, fontSize: 14, color: '#0F172A' },

    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1.5, backgroundColor: '#fff',
    },
    roleChipText: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },

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
