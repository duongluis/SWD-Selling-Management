// app/addConsult/index.jsx

import BgWatermark from '@/components/Main/BgWatermark';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { createNotification } from '../../components/Utils/chatService';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';

const width = Dimensions.get('window').width
// ── Field component ───────────────────────────────────────────
function Field({ label, value, onChange, multiline, keyboard, required, placeholder }) {
    return (
        <View style={styles.fg}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 }}>
                <Text style={styles.label}>{label}</Text>
                {required && <Text style={styles.req}>*</Text>}
            </View>
            <View style={[styles.inputBox, multiline && { alignItems: 'flex-start', minHeight: 80 }]}>
                <TextInput
                    style={[styles.input, multiline && { textAlignVertical: 'top' }]}
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
    const { isDesktop } = useLayout();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [age, setAge] = useState('');
    const [products, setProducts] = useState([]);    // multi-select
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ── Fetch danh sách sản phẩm từ db/productPrice ───────────
    const [catalog, setCatalog] = useState([]);
    const [catalogLoad, setCatalogLoad] = useState(true);

    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => {
                const items = snap.docs
                    .map(doc => ({ ...doc.data(), docId: doc.id }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0));
                setCatalog(items);
            })
            .catch(console.error)
            .finally(() => setCatalogLoad(false));
    }, []);

    // const STATUS_OPTIONS = [
    //     { key: 'pending', label: 'Đang tư vấn', icon: 'time-outline', color: '#2563EB', bg: '#EFF6FF' },
    //     { key: 'success', label: 'Thành công', icon: 'checkmark-circle-outline', color: '#059669', bg: '#ECFDF5' },
    //     { key: 'failed', label: 'Thất bại', icon: 'close-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
    // ];

    const handleSubmit = async () => {
        if (!name.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên khách hàng'); return; }
        if (!phone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'consult'), {
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim(),
                age: age.trim() ? parseInt(age) : null,
                productIds: products,
                productNames: catalog
                    .filter(p => products.includes(String(p.id || p.docId)))
                    .map(p => p.name),
                status: 'pending',          // ← mặc định luôn là đang tư vấn
                reason: '',
                note: note.trim(),
                createdBy: userDetail?.email || '',
                createdAt: new Date().toISOString(),
            });
            showSuccess('Đã tạo!', `Đã ghi nhận khách hàng "${name.trim()}"`, () => router.replace('(tabs)/customerctv'));
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
        <View style={[styles.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('(tabs)/customerctv')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Thêm khách hàng tư vấn</Text>
                    <Text style={styles.headerSub}>Ghi nhận thông tin buổi tư vấn</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.scroll}
                >
                    <View style={isDesktop ? styles.gridWeb : undefined}>

                        {/* LEFT */}
                        <View style={isDesktop ? styles.colLeft : undefined}>
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="person-outline" size={15} color="#2563EB" />
                                    <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
                                </View>

                                <Field label="Tên khách hàng" value={name} onChange={setName} required placeholder="Nguyễn Văn A" />
                                <Field label="Số điện thoại" value={phone} onChange={setPhone} required keyboard="phone-pad" placeholder="0901 234 567" />
                                <Field label="Địa chỉ" value={address} onChange={setAddress} placeholder="Quận/huyện, tỉnh/thành..." />
                                <Field label="Tuổi" value={age} onChange={setAge} keyboard="numeric" placeholder="VD: 35" />
                                <Field label="Ghi chú" value={note} onChange={setNote} multiline placeholder="Ghi chú thêm..." />
                            </View>
                        </View>

                        {/* RIGHT */}
                        <View style={isDesktop ? styles.colRight : undefined}>

                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="water-outline" size={15} color="#7C3AED" />
                                    <Text style={[styles.sectionTitle, { color: '#7C3AED' }]}>Sản phẩm quan tâm</Text>
                                </View>
                                {catalogLoad ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                                        <ActivityIndicator size="small" color="#7C3AED" />
                                        <Text style={{ fontSize: 13, color: '#94A3B8' }}>Đang tải danh sách sản phẩm...</Text>
                                    </View>
                                ) : catalog.length === 0 ? (
                                    <Text style={{ fontSize: 13, color: '#94A3B8', padding: 8 }}>Chưa có sản phẩm trong danh mục</Text>
                                ) : (
                                    <View style={styles.tagGrid}>
                                        {catalog.map(p => {
                                            const key = String(p.id || p.docId);
                                            const selected = products.includes(key);
                                            return (
                                                <TouchableOpacity
                                                    key={key}
                                                    style={[styles.tag, selected && styles.tagSelected]}
                                                    onPress={() => setProducts(prev =>
                                                        prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
                                                    )}
                                                    activeOpacity={0.7}
                                                >
                                                    {selected && <Ionicons name="checkmark" size={12} color="#2563EB" />}
                                                    <Text style={[styles.tagText, selected && styles.tagTextSelected]} numberOfLines={1}>
                                                        {p.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                                {products.length > 0 && (
                                    <Text style={styles.selectedCount}>
                                        Đã chọn: {products.length} sản phẩm
                                        {' · '}{catalog.filter(p => products.includes(String(p.id || p.docId))).map(p => p.name).join(', ')}
                                    </Text>
                                )}
                            </View>



                        </View>
                    </View>

                    <View style={{ height: insets.bottom + 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('(tabs)/customerctv')} activeOpacity={0.8}>
                    <Text style={styles.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                >
                    <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{submitting ? 'Đang lưu...' : 'Lưu khách hàng'}</Text>
                </TouchableOpacity>
            </View>
        </View >
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    scroll: { paddingHorizontal: Platform.OS === 'web' && width >= 768 ? 32 : 16, paddingTop: 16 },
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
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: '#1E3A8A', shadowColor: '#1E3A8A', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});