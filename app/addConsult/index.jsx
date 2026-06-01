// app/addConsult/index.jsx
// Tạo bản ghi tư vấn mới — lưu vào db/consult/{id}
// Khi tư vấn thành công → admin/CTV có thể chuyển thành khách hàng chính thức

import BgWatermark from '@/components/Main/BgWatermark';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { createNotification } from '../../components/Utils/chatService';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();

// ── Field component ───────────────────────────────────────────
function Field({ label, value, onChange, multiline, keyboard, required, placeholder }) {
    return (
        <View style={S.fg}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 }}>
                <Text style={S.label}>{label}</Text>
                {required && <Text style={S.req}>*</Text>}
            </View>
            <View style={[S.inputBox, multiline && { alignItems: 'flex-start', minHeight: 80 }]}>
                <TextInput
                    style={[S.input, multiline && { textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChange}
                    multiline={multiline}
                    keyboardType={keyboard || 'default'}
                    placeholder={placeholder || `Nhập ${label.toLowerCase()}...`}
                    placeholderTextColor="#94A3B8"
                />
            </View>
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function AddConsultScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [age, setAge] = useState('');
    const [products, setProducts] = useState([]);    // multi-select
    const [status, setStatus] = useState('');
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ── Fetch danh sách sản phẩm từ db/productPrice ───────────
    const [catalog, setCatalog] = useState([]);
    const [catalogLoad, setCatalogLoad] = useState(true);

    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => {
                const items = snap.docs
                    .map(d => ({ ...d.data(), docId: d.id }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0));
                setCatalog(items);
            })
            .catch(console.error)
            .finally(() => setCatalogLoad(false));
    }, []);

    const STATUS_OPTIONS = [
        { key: 'pending', label: 'Đang tư vấn', icon: 'time-outline', color: '#2563EB', bg: '#EFF6FF' },
        { key: 'success', label: 'Thành công', icon: 'checkmark-circle-outline', color: '#059669', bg: '#ECFDF5' },
        { key: 'failed', label: 'Thất bại', icon: 'close-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
    ];


    const handleSubmit = async () => {
        if (!name.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên khách hàng'); return; }
        if (!phone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }
        if (!status) { showAlert('Thông báo', 'Vui lòng chọn trạng thái tư vấn'); return; }
        if (status === 'failed' && !reason.trim()) {
            showAlert('Thông báo', 'Vui lòng nhập lý do thất bại'); return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'consult'), {
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim(),
                age: age.trim() ? parseInt(age) : null,
                // Lưu cả id lẫn tên để dễ đọc
                productIds: products,
                productNames: catalog
                    .filter(p => products.includes(String(p.id || p.docId)))
                    .map(p => p.name),
                status,
                reason: status === 'failed' ? reason.trim() : '',
                note: note.trim(),
                createdBy: userDetail?.email || '',
                createdAt: new Date().toISOString(),
            });
            showSuccess('Đã tạo!', `Đã ghi nhận khách hàng "${name.trim()}"`, () => router.back());
            getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))).then(adminSnap => {
                adminSnap.docs.forEach(d => {
                    const adminEmail = d.data().email;
                    if (adminEmail) createNotification({
                        userEmail: adminEmail,
                        type: 'new_consult',
                        title: 'Tư vấn mới',
                        body: `${userDetail?.name || userDetail?.email} đã thêm khách tư vấn: ${name.trim()} (${phone.trim()})`,
                    }).catch(() => { });
                });
            }).catch(() => { });
        } catch (e) {
            showAlert('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.headerTitle}>Thêm khách hàng tư vấn</Text>
                    <Text style={S.headerSub}>Ghi nhận thông tin buổi tư vấn</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={S.scroll}
                >
                    <View style={isDesktop ? S.gridWeb : undefined}>

                        {/* LEFT */}
                        <View style={isDesktop ? S.colLeft : undefined}>
                            <View style={S.section}>
                                <View style={S.sectionHeader}>
                                    <Ionicons name="person-outline" size={15} color="#2563EB" />
                                    <Text style={S.sectionTitle}>Thông tin khách hàng</Text>
                                </View>

                                <Field label="Tên khách hàng" value={name} onChange={setName} required placeholder="Nguyễn Văn A" />
                                <Field label="Số điện thoại" value={phone} onChange={setPhone} required keyboard="phone-pad" placeholder="0901 234 567" />
                                <Field label="Địa chỉ" value={address} onChange={setAddress} placeholder="Quận/huyện, tỉnh/thành..." />
                                <Field label="Tuổi" value={age} onChange={setAge} keyboard="numeric" placeholder="VD: 35" />
                                <Field label="Ghi chú" value={note} onChange={setNote} multiline placeholder="Ghi chú thêm..." />
                            </View>
                        </View>

                        {/* RIGHT */}
                        <View style={isDesktop ? S.colRight : undefined}>

                            <View style={S.section}>
                                <View style={S.sectionHeader}>
                                    <Ionicons name="water-outline" size={15} color="#7C3AED" />
                                    <Text style={[S.sectionTitle, { color: '#7C3AED' }]}>Sản phẩm quan tâm</Text>
                                </View>
                                {catalogLoad ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                                        <ActivityIndicator size="small" color="#7C3AED" />
                                        <Text style={{ fontSize: 13, color: '#94A3B8' }}>Đang tải danh sách sản phẩm...</Text>
                                    </View>
                                ) : catalog.length === 0 ? (
                                    <Text style={{ fontSize: 13, color: '#94A3B8', padding: 8 }}>Chưa có sản phẩm trong danh mục</Text>
                                ) : (
                                    <View style={S.tagGrid}>
                                        {catalog.map(p => {
                                            const key = String(p.id || p.docId);
                                            const selected = products.includes(key);
                                            return (
                                                <TouchableOpacity
                                                    key={key}
                                                    style={[S.tag, selected && S.tagSelected]}
                                                    onPress={() => setProducts(prev =>
                                                        prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
                                                    )}
                                                    activeOpacity={0.7}
                                                >
                                                    {selected && <Ionicons name="checkmark" size={12} color="#2563EB" />}
                                                    <Text style={[S.tagText, selected && S.tagTextSelected]} numberOfLines={1}>
                                                        {p.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                                {products.length > 0 && (
                                    <Text style={S.selectedCount}>
                                        Đã chọn: {products.length} sản phẩm
                                        {' · '}{catalog.filter(p => products.includes(String(p.id || p.docId))).map(p => p.name).join(', ')}
                                    </Text>
                                )}
                            </View>

                            {/* Trạng thái tư vấn */}
                            <View style={S.section}>
                                <View style={S.sectionHeader}>
                                    <Ionicons name="git-branch-outline" size={15} color="#F59E0B" />
                                    <Text style={[S.sectionTitle, { color: '#F59E0B' }]}>Kết quả tư vấn <Text style={S.req}>*</Text></Text>
                                </View>
                                <View style={{ gap: 8 }}>
                                    {STATUS_OPTIONS.map(opt => {
                                        const active = status === opt.key;
                                        return (
                                            <TouchableOpacity
                                                key={opt.key}
                                                style={[S.statusOpt, active && { borderColor: opt.color, backgroundColor: opt.bg }]}
                                                onPress={() => setStatus(opt.key)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name={opt.icon} size={18} color={active ? opt.color : '#94A3B8'} />
                                                <Text style={[S.statusOptText, active && { color: opt.color, fontWeight: '700' }]}>
                                                    {opt.label}
                                                </Text>
                                                {active && <Ionicons name="checkmark-circle" size={18} color={opt.color} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Lý do thất bại */}
                                {status === 'failed' && (
                                    <View style={{ marginTop: 12 }}>
                                        <View style={S.sectionHeader}>
                                            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                                            <Text style={[S.sectionTitle, { color: '#EF4444', fontSize: 12 }]}>Lý do thất bại <Text style={S.req}>*</Text></Text>
                                        </View>
                                        <View style={[S.inputBox, { alignItems: 'flex-start', minHeight: 80, borderColor: '#FECACA' }]}>
                                            <TextInput
                                                style={[S.input, { textAlignVertical: 'top' }]}
                                                value={reason}
                                                onChangeText={setReason}
                                                multiline
                                                placeholder="Khách chưa có nhu cầu, giá cao, đã mua chỗ khác..."
                                                placeholderTextColor="#94A3B8"
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>

                        </View>
                    </View>

                    <View style={{ height: insets.bottom + 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom bar */}
            <View style={[S.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={S.cancelBtn} onPress={() => router.back()} activeOpacity={0.8}>
                    <Text style={S.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[S.saveBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                >
                    <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                    <Text style={S.saveBtnText}>{submitting ? 'Đang lưu...' : 'Lưu khách hàng'}</Text>
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
    scroll: { paddingHorizontal: isDesktop ? 32 : 16, paddingTop: 16 },
    gridWeb: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    colLeft: { flex: 1.3 },
    colRight: { flex: 1 },
    section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
    fg: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '600', color: '#374151' },
    req: { fontSize: 12, color: '#EF4444' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 6 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    // Product tags
    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
    tagSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
    tagText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    tagTextSelected: { color: '#2563EB', fontWeight: '700' },
    selectedCount: { fontSize: 11, color: '#2563EB', marginTop: 8, fontWeight: '600' },
    // Status
    statusOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
    statusOptText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#374151' },
    // Bottom
    bottomBar: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', flexDirection: 'row', gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: '#1E3A8A', shadowColor: '#1E3A8A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});