// app/editCustomer/index.jsx
import BgWatermark from '@/components/Main/BgWatermark';
import { showInfo } from '@/components/Main/showInfo';
import { db } from '@/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/components/Main/TabScreenLayout';

// ── Field Component ───────────────────────────────────────────
function Field({ label, required, children }) {
    return (
        <View style={F.wrap}>
            <Text style={F.label}>
                {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
            </Text>
            {children}
        </View>
    );
}

function Input({ value, onChange, placeholder, keyboardType = 'default', multiline = false }) {
    return (
        <TextInput
            style={[F.input, multiline && F.inputMulti]}
            value={value || ''}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor="#CBD5E1"
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
        />
    );
}

const F = StyleSheet.create({
    wrap: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
    inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
});

// ── Section Header ────────────────────────────────────────────
function SectionHead({ icon, title }) {
    return (
        <View style={S.sHead}>
            <View style={S.sIcon}><Ionicons name={icon} size={14} color="#2563EB" /></View>
            <Text style={S.sTitle}>{title}</Text>
        </View>
    );
}

const S = StyleSheet.create({
    sHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 8 },
    sIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    sTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
});

// ── Main ──────────────────────────────────────────────────────
export default function EditCustomerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const docId = params.customerId || params.docId || '';

    const { isDesktop } = useLayout();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [bizModel, setBizModel] = useState('individual'); // 'individual' | 'company'
    const [form, setForm] = useState({
        // Chung
        name: '', phone: '', email: '', address: '', note: '',
        // Doanh nghiệp
        companyName: '', taxCode: '', bizAddress: '',
        contactName: '', contactPhone: '', emailContact: '',
    });

    // ── Fetch data ──────────────────────────────────────────────
    useEffect(() => {
        if (!docId) { setLoading(false); return; }
        getDoc(doc(db, 'customers', docId))
            .then(snap => {
                if (!snap.exists()) { showInfo('Lỗi', 'Không tìm thấy khách hàng'); router.back(); return; }
                const d = snap.data();
                setBizModel(d.bizModel || 'individual');
                setForm({
                    name: d.name || '',
                    phone: d.phone || '',
                    email: d.email || '',
                    address: d.address || '',
                    note: d.note || '',
                    companyName: d.companyName || '',
                    taxCode: d.taxCode || '',
                    bizAddress: d.bizAddress || '',
                    contactName: d.contactName || '',
                    contactPhone: d.contactPhone || '',
                    emailContact: d.emailContact || d.email || '',
                });
            })
            .catch(e => { showInfo('Lỗi', e.message); router.back(); })
            .finally(() => setLoading(false));
    }, [docId]);

    const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

    // ── Save ────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.phone?.trim()) { showInfo('Thiếu thông tin', 'Vui lòng nhập số điện thoại'); return; }
        if (bizModel === 'individual' && !form.name?.trim()) {
            showInfo('Thiếu thông tin', 'Vui lòng nhập họ tên'); return;
        }
        if (bizModel === 'company' && !form.companyName?.trim()) {
            showInfo('Thiếu thông tin', 'Vui lòng nhập tên công ty'); return;
        }

        setSubmitting(true);
        try {
            const payload = {
                bizModel,
                phone: form.phone.trim(),
                address: form.address.trim(),
                note: form.note.trim(),
                updatedAt: new Date().toISOString(),
            };

            if (bizModel === 'individual') {
                Object.assign(payload, {
                    name: form.name.trim(),
                    email: form.email.trim(),
                });
            } else {
                Object.assign(payload, {
                    companyName: form.companyName.trim(),
                    taxCode: form.taxCode.trim(),
                    bizAddress: form.bizAddress.trim(),
                    contactName: form.contactName.trim(),
                    contactPhone: form.contactPhone.trim(),
                    emailContact: form.emailContact.trim(),
                    // name = companyName để tìm kiếm dễ
                    name: form.companyName.trim(),
                });
            }

            await updateDoc(doc(db, 'customers', docId), payload);
            showInfo('✅ Đã lưu', 'Cập nhật thông tin khách hàng thành công!');
            router.back();
        } catch (e) {
            showInfo('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ─────────────────────────────────────────────────
    if (loading) return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#2563EB" />
        </View>
    );

    const content = (
        <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[W.scroll, isDesktop && { maxWidth: 600, alignSelf: 'center', width: '100%' }]}
        >
            {/* Loại khách hàng */}
            <View style={W.card}>
                <SectionHead icon="person-outline" title="Loại khách hàng" />
                <View style={W.typeRow}>
                    {[
                        { key: 'individual', label: 'Cá nhân', icon: 'person-outline' },
                        { key: 'company', label: 'Doanh nghiệp', icon: 'business-outline' },
                    ].map(opt => (
                        <TouchableOpacity key={opt.key}
                            style={[W.typeBtn, bizModel === opt.key && W.typeBtnActive]}
                            onPress={() => setBizModel(opt.key)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={opt.icon} size={15}
                                color={bizModel === opt.key ? '#fff' : '#64748B'} />
                            <Text style={[W.typeBtnText, bizModel === opt.key && W.typeBtnTextActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Thông tin cá nhân */}
            {bizModel === 'individual' && (
                <View style={W.card}>
                    <SectionHead icon="person-outline" title="Thông tin cá nhân" />
                    <Field label="Họ và tên" required>
                        <Input value={form.name} onChange={set('name')} placeholder="Nguyễn Văn A" />
                    </Field>
                    <Field label="Số điện thoại" required>
                        <Input value={form.phone} onChange={set('phone')} placeholder="0901 234 567" keyboardType="phone-pad" />
                    </Field>
                    <Field label="Email">
                        <Input value={form.email} onChange={set('email')} placeholder="email@example.com" keyboardType="email-address" />
                    </Field>
                    <Field label="Địa chỉ">
                        <Input value={form.address} onChange={set('address')} placeholder="123 Đường ABC, Q.1, TP.HCM" multiline />
                    </Field>
                </View>
            )}

            {/* Thông tin doanh nghiệp */}
            {bizModel === 'company' && (
                <View style={W.card}>
                    <SectionHead icon="business-outline" title="Thông tin doanh nghiệp" />
                    <Field label="Tên công ty" required>
                        <Input value={form.companyName} onChange={set('companyName')} placeholder="Công ty TNHH ABC" />
                    </Field>
                    <Field label="Số điện thoại" required>
                        <Input value={form.phone} onChange={set('phone')} placeholder="0901 234 567" keyboardType="phone-pad" />
                    </Field>
                    <Field label="Mã số thuế">
                        <Input value={form.taxCode} onChange={set('taxCode')} placeholder="0123456789" keyboardType="numeric" />
                    </Field>
                    <Field label="Địa chỉ kinh doanh">
                        <Input value={form.bizAddress} onChange={set('bizAddress')} placeholder="123 Đường XYZ, Q.1" multiline />
                    </Field>

                    <View style={W.divider} />
                    <SectionHead icon="call-outline" title="Người liên hệ" />
                    <Field label="Tên người liên hệ">
                        <Input value={form.contactName} onChange={set('contactName')} placeholder="Nguyễn Thị B" />
                    </Field>
                    <Field label="SĐT người liên hệ">
                        <Input value={form.contactPhone} onChange={set('contactPhone')} placeholder="0901 234 567" keyboardType="phone-pad" />
                    </Field>
                    <Field label="Email liên hệ">
                        <Input value={form.emailContact} onChange={set('emailContact')} placeholder="contact@company.com" keyboardType="email-address" />
                    </Field>

                    <View style={W.divider} />
                    <SectionHead icon="location-outline" title="Địa chỉ giao hàng" />
                    <Field label="Địa chỉ">
                        <Input value={form.address} onChange={set('address')} placeholder="Địa chỉ giao hàng..." multiline />
                    </Field>
                </View>
            )}

            {/* Ghi chú */}
            <View style={W.card}>
                <SectionHead icon="document-text-outline" title="Ghi chú" />
                <Field label="Ghi chú thêm">
                    <Input value={form.note} onChange={set('note')} placeholder="Thông tin bổ sung về khách hàng..." multiline />
                </Field>
            </View>

            {/* Actions */}
            <View style={W.actions}>
                <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()} activeOpacity={0.8}>
                    <Text style={W.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={W.saveBtn} onPress={handleSave} disabled={submitting} activeOpacity={0.85}>
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="checkmark" size={16} color="#fff" />
                    }
                    <Text style={W.saveBtnText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 60 }} />
        </ScrollView>
    );

    return (
        <View style={[W.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={W.header}>
                <TouchableOpacity style={W.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={W.headerTitle}>Sửa khách hàng</Text>
                    <Text style={W.headerSub}>{form.name || form.companyName || form.phone || '—'}</Text>
                </View>
                {/* Quick save button trên header */}
                <TouchableOpacity style={W.headerSaveBtn} onPress={handleSave} disabled={submitting} activeOpacity={0.85}>
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={W.headerSaveBtnText}>Lưu</Text>
                    }
                </TouchableOpacity>
            </View>

            {/* Body */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {content}
            </KeyboardAvoidingView>
        </View>
    );
}

const W = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F6FA' },
    // Header
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
    headerSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2563EB', borderRadius: 9 },
    headerSaveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // Scroll
    scroll: { padding: 16, paddingBottom: 40 },
    // Card
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    divider: { height: 0.5, backgroundColor: '#E2E8F0', marginVertical: 14 },
    // Biz model selector
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    typeBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    typeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    typeBtnTextActive: { color: '#fff' },
    // Actions
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, backgroundColor: '#2563EB' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});