import Colors from '@/constant/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

const ROLES = [
    { key: 'đại lý', label: 'Đại lý', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF', desc: 'Phân phối trực tiếp tới khách hàng cuối' },
    { key: 'nhà phân phối', label: 'Nhà phân phối', icon: 'car-outline', color: '#7C3AED', bg: '#F5F3FF', desc: 'Phân phối hàng hóa theo khu vực rộng lớn' },
    { key: 'cộng tác viên', label: 'Cộng tác viên', icon: 'people-outline', color: '#059669', bg: '#ECFDF5', desc: 'Giới thiệu và hỗ trợ bán hàng theo hoa hồng' },
];

export default function UserInfo() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
    const [selectedRole, setSelectedRole] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { Alert.alert('Thông báo', 'Vui lòng nhập họ và tên'); return; }
        if (!form.phone.trim()) { Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }
        if (!selectedRole) { Alert.alert('Thông báo', 'Vui lòng chọn vị trí'); return; }

        setSubmitting(true);
        try {
            // ✅ Lấy email từ Firebase Auth hiện tại (đã đăng ký ở signUp)
            const auth = getAuth();
            const email = auth.currentUser?.email;
            if (!email) throw new Error('Không tìm thấy tài khoản. Vui lòng đăng ký lại.');

            // ✅ Lưu toàn bộ thông tin vào DB — chỉ 1 lần, sau khi user điền xong
            await setDoc(doc(db, 'users', email), {
                uid: auth.currentUser.uid,
                email: email,
                name: form.name.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                note: form.note.trim(),
                role: selectedRole,
                member: selectedRole,
                verified: false,     // ← admin phải xác thực
                revenue: 0,
                advisor: "",
                createdAt: new Date().toISOString(),
            });

            // ✅ Chuyển sang màn chờ xác thực
            router.replace('/(tabs)/home');
        } catch (e) {
            Alert.alert('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Role Card ───────────────────────────────────────────────
    const RoleCard = ({ role }) => {
        const active = selectedRole === role.key;
        return (
            <TouchableOpacity
                style={[styles.roleCard, active && { borderColor: role.color, backgroundColor: role.bg }]}
                onPress={() => setSelectedRole(role.key)}
                activeOpacity={0.7}
            >
                <View style={[styles.roleIcon, { backgroundColor: active ? role.color + '22' : '#F1F5F9' }]}>
                    <Ionicons name={role.icon} size={22} color={active ? role.color : '#94A3B8'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, active && { color: role.color }]}>{role.label}</Text>
                    <Text style={styles.roleDesc}>{role.desc}</Text>
                </View>
                <View style={[styles.roleCheck, active && { backgroundColor: role.color, borderColor: role.color }]}>
                    {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    // ── WEB ─────────────────────────────────────────────────────
    if (isWeb) {
        return (
            <View style={W.root}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>

                    <View style={W.header}>
                        <View style={W.logoWrap}>
                            <Ionicons name="person-add" size={28} color="#2563EB" />
                        </View>
                        <Text style={W.title}>Hoàn thiện hồ sơ</Text>
                        <Text style={W.sub}>Điền đầy đủ thông tin để admin xét duyệt tài khoản của bạn</Text>
                    </View>

                    {/* Step indicator */}
                    <View style={W.steps}>
                        <View style={W.stepDone}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                        <View style={W.stepLine} />
                        <View style={W.stepActive}>
                            <Text style={W.stepNum}>2</Text>
                        </View>
                        <View style={[W.stepLine, { backgroundColor: '#E2E8F0' }]} />
                        <View style={W.stepPending}>
                            <Text style={[W.stepNum, { color: '#94A3B8' }]}>3</Text>
                        </View>
                    </View>
                    <View style={W.stepLabels}>
                        <Text style={W.stepLabelDone}>Tài khoản</Text>
                        <Text style={W.stepLabelActive}>Thông tin</Text>
                        <Text style={W.stepLabelPending}>Xét duyệt</Text>
                    </View>

                    <View style={W.grid}>
                        {/* LEFT */}
                        <View style={W.col}>
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Thông tin cá nhân</Text>
                                </View>

                                <View style={W.row2}>
                                    <View style={[W.inputGroup, { flex: 1 }]}>
                                        <Text style={W.label}>Họ và tên <Text style={W.required}>*</Text></Text>
                                        <View style={W.inputBox}>
                                            <Ionicons name="person-outline" size={15} color="#94A3B8" />
                                            <TextInput style={W.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={form.name} onChangeText={v => set('name', v)} />
                                        </View>
                                    </View>
                                    <View style={[W.inputGroup, { flex: 1 }]}>
                                        <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                                        <View style={W.inputBox}>
                                            <Ionicons name="call-outline" size={15} color="#94A3B8" />
                                            <TextInput style={W.input} placeholder="0901 234 567" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={form.phone} onChangeText={v => set('phone', v)} />
                                        </View>
                                    </View>
                                </View>

                                <View style={W.inputGroup}>
                                    <Text style={W.label}>Địa chỉ</Text>
                                    <View style={W.inputBox}>
                                        <Ionicons name="location-outline" size={15} color="#94A3B8" />
                                        <TextInput style={W.input} placeholder="Số nhà, đường, quận/huyện..." placeholderTextColor="#94A3B8" value={form.address} onChangeText={v => set('address', v)} />
                                    </View>
                                </View>

                                <View style={W.inputGroup}>
                                    <Text style={W.label}>Ghi chú (tuỳ chọn)</Text>
                                    <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}>
                                        <TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder="Thông tin thêm về bản thân..." placeholderTextColor="#94A3B8" multiline value={form.note} onChangeText={v => set('note', v)} />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT */}
                        <View style={W.colRight}>
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="briefcase-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Chọn vị trí <Text style={W.required}>*</Text></Text>
                                </View>
                                {ROLES.map(role => <RoleCard key={role.key} role={role} />)}
                            </View>

                            <View style={W.infoBanner}>
                                <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
                                <Text style={W.infoBannerText}>
                                    Thông tin sẽ được gửi đến admin xét duyệt. Bạn có thể sử dụng app sau khi được xác thực.
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[W.submitBtn, submitting && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={submitting ? 'hourglass-outline' : 'send-outline'} size={16} color="#fff" />
                                <Text style={W.submitBtnText}>{submitting ? 'Đang lưu...' : 'Hoàn tất đăng ký'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // ── MOBILE ──────────────────────────────────────────────────
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <Ionicons name="person-add" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Hoàn thiện hồ sơ</Text>
                    <Text style={styles.headerSub}>Bước 2/3 — Thông tin cá nhân</Text>
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

                    {/* Progress */}
                    <View style={styles.progressRow}>
                        {[1, 2, 3].map((s, i) => (
                            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                                <View style={[styles.stepDot, s < 2 && styles.stepDone, s === 2 && styles.stepCurrent]}>
                                    {s < 2
                                        ? <Ionicons name="checkmark" size={10} color="#fff" />
                                        : <Text style={[styles.stepDotText, s === 2 && { color: '#fff' }]}>{s}</Text>
                                    }
                                </View>
                                {i < 2 && <View style={[styles.stepConnector, s < 2 && { backgroundColor: '#2563EB' }]} />}
                            </View>
                        ))}
                    </View>

                    {/* Form */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="person-circle-outline" size={18} color="#2563EB" />
                            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
                        </View>

                        {[
                            { label: 'Họ và tên', field: 'name', placeholder: 'Nguyễn Văn A', required: true },
                            { label: 'Số điện thoại', field: 'phone', placeholder: '0901 234 567', required: true, keyboard: 'phone-pad' },
                            { label: 'Địa chỉ', field: 'address', placeholder: 'Số nhà, đường, Q/H...' },
                        ].map(f => (
                            <View style={styles.inputGroup} key={f.field}>
                                <Text style={styles.label}>{f.label}{f.required && <Text style={styles.required}> *</Text>}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={f.placeholder}
                                    placeholderTextColor="#94A3B8"
                                    keyboardType={f.keyboard || 'default'}
                                    value={form[f.field]}
                                    onChangeText={v => set(f.field, v)}
                                />
                            </View>
                        ))}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Ghi chú</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                placeholder="Thông tin thêm..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={form.note}
                                onChangeText={v => set('note', v)}
                            />
                        </View>
                    </View>

                    {/* Vị trí */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
                            <Text style={styles.sectionTitle}>Chọn vị trí <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        </View>
                        {ROLES.map(role => <RoleCard key={role.key} role={role} />)}
                    </View>

                    <View style={styles.infoBanner}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
                        <Text style={styles.infoBannerText}>
                            Tài khoản sẽ chờ admin xét duyệt trước khi sử dụng đầy đủ tính năng.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        <Ionicons name={submitting ? 'hourglass-outline' : 'send-outline'} size={18} color="#fff" />
                        <Text style={styles.submitBtnText}>{submitting ? 'Đang lưu...' : 'Hoàn tất đăng ký'}</Text>
                    </TouchableOpacity>

                    <View style={{ height: insets.bottom + 32 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

// ── Web Styles ───────────────────────────────────────────────
const W = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 32, paddingTop: 36, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: 24 },
    logoWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
    title: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5, marginBottom: 8 },
    sub: { fontSize: 15, color: '#64748B', textAlign: 'center', maxWidth: 480, lineHeight: 22 },

    // Steps
    steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8 },
    stepDone: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    stepActive: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    stepPending: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    stepLine: { width: 60, height: 2, backgroundColor: '#2563EB' },
    stepNum: { fontSize: 12, fontWeight: '700', color: '#fff' },
    stepLabels: { flexDirection: 'row', justifyContent: 'center', gap: 72, marginBottom: 32 },
    stepLabelDone: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
    stepLabelActive: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
    stepLabelPending: { fontSize: 11, color: '#94A3B8' },

    grid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
    col: { flex: 3 },
    colRight: { flex: 2, gap: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    row2: { flexDirection: 'row', gap: 12 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
    required: { color: '#EF4444' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 10, backgroundColor: '#FFFFFF' },
    roleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    roleLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    roleDesc: { fontSize: 12, color: '#94A3B8' },
    roleCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#BFDBFE' },
    infoBannerText: { flex: 1, fontSize: 13, color: '#2563EB', lineHeight: 18 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, marginTop: 4, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ── Mobile Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.Background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },

    // Progress steps
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 24 },
    stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    stepDone: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    stepCurrent: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    stepDotText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    stepConnector: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 4 },

    section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    inputGroup: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    required: { color: '#EF4444' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 10, backgroundColor: '#FFFFFF' },
    roleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    roleLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    roleDesc: { fontSize: 11, color: '#94A3B8' },
    roleCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
    infoBannerText: { flex: 1, fontSize: 12, color: '#2563EB', lineHeight: 17 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, marginBottom: 12, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});