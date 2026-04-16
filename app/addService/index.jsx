import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
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

const SERVICE_TYPES = [
    { key: 'MAINTENANCE', label: 'Bảo dưỡng', icon: 'construct-outline', color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'INSTALLATION', label: 'Lắp đặt', icon: 'build-outline', color: '#8B5CF6', bg: '#F5F3FF' },
    { key: 'SALT', label: 'Đổ muối', icon: 'water-outline', color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'DELIVERY', label: 'Giao hàng', icon: 'car-outline', color: '#10B981', bg: '#ECFDF5' },
    { key: 'CONSULTING', label: 'Tư vấn', icon: 'chatbubbles-outline', color: '#EC4899', bg: '#FDF2F8' },
];

export default function AddService() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);

    const [serviceType, setServiceType] = useState('MAINTENANCE');
    const [machineName, setMachineName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [address, setAddress] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const serviceId = 'SV-' + Date.now().toString().slice(-6);

    const handleSubmit = async () => {
        if (!customerName.trim()) {
            Alert.alert('Thông báo', 'Vui lòng nhập tên khách hàng');
            return;
        }
        if (!customerPhone.trim()) {
            Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại');
            return;
        }

        setSubmitting(true);
        try {
            const newService = {
                id: serviceId,
                type: serviceType,
                machineName: machineName.trim(),
                customer: customerName.trim(),
                phone: customerPhone.trim(),
                address: address.trim(),
                note: note.trim(),
                status: 'PENDING',
                createdBy: userDetail?.email || '',
                createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, 'service', serviceId), newService);

            Alert.alert('Thành công', `Dịch vụ ${serviceId} đã được tạo!`, [
                { text: 'OK', onPress: () => router.replace('/(tabs)/service') },
            ]);
        } catch (e) {
            console.error('Lỗi tạo dịch vụ:', e);
            Alert.alert('Lỗi', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedType = SERVICE_TYPES.find(t => t.key === serviceType);

    // ─────────────────────────────────────────────────────────
    // WEB LAYOUT
    // ─────────────────────────────────────────────────────────
    if (isWeb) {
        return (
            <View style={W.root}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>

                    {/* Page header */}
                    <View style={W.pageHeader}>
                        <View>
                            <Text style={W.pageTitle}>Tạo dịch vụ mới</Text>
                            <Text style={W.pageSub}>Điền thông tin để tạo yêu cầu dịch vụ mới</Text>
                        </View>
                        <TouchableOpacity style={W.cancelBtn} onPress={() => router.back()}>
                            <Ionicons name="close" size={16} color="#64748B" />
                            <Text style={W.cancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={W.grid}>
                        {/* LEFT */}
                        <View style={W.col}>

                            {/* Loại hình dịch vụ */}
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="construct-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Loại hình dịch vụ</Text>
                                </View>
                                <View style={W.typeGrid}>
                                    {SERVICE_TYPES.map(type => {
                                        const active = serviceType === type.key;
                                        return (
                                            <TouchableOpacity
                                                key={type.key}
                                                style={[
                                                    W.typeCard,
                                                    { borderColor: active ? type.color : '#E2E8F0' },
                                                    active && { backgroundColor: type.bg },
                                                ]}
                                                onPress={() => setServiceType(type.key)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[W.typeIcon, { backgroundColor: active ? type.color + '22' : '#F1F5F9' }]}>
                                                    <Ionicons name={type.icon} size={18} color={active ? type.color : '#94A3B8'} />
                                                </View>
                                                <Text style={[W.typeLabel, active && { color: type.color, fontWeight: '700' }]}>
                                                    {type.label}
                                                </Text>
                                                {active && (
                                                    <View style={[W.typeCheck, { backgroundColor: type.color }]}>
                                                        <Ionicons name="checkmark" size={10} color="#fff" />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Thông tin thiết bị */}
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="hardware-chip-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Thông tin thiết bị</Text>
                                </View>
                                <View style={W.inputGroup}>
                                    <Text style={W.label}>Tên máy / Thiết bị</Text>
                                    <View style={W.inputBox}>
                                        <Ionicons name="settings-outline" size={15} color="#94A3B8" />
                                        <TextInput
                                            style={W.input}
                                            placeholder="Nhập tên thiết bị..."
                                            placeholderTextColor="#94A3B8"
                                            value={machineName}
                                            onChangeText={setMachineName}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT */}
                        <View style={W.colRight}>

                            {/* Thông tin khách hàng */}
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="person-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Thông tin khách hàng</Text>
                                </View>

                                <View style={W.row2}>
                                    <View style={[W.inputGroup, { flex: 1 }]}>
                                        <Text style={W.label}>Tên khách hàng <Text style={W.required}>*</Text></Text>
                                        <View style={W.inputBox}>
                                            <Ionicons name="person-outline" size={15} color="#94A3B8" />
                                            <TextInput
                                                style={W.input}
                                                placeholder="Nguyễn Văn A"
                                                placeholderTextColor="#94A3B8"
                                                value={customerName}
                                                onChangeText={setCustomerName}
                                            />
                                        </View>
                                    </View>
                                    <View style={[W.inputGroup, { flex: 1 }]}>
                                        <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                                        <View style={W.inputBox}>
                                            <Ionicons name="call-outline" size={15} color="#94A3B8" />
                                            <TextInput
                                                style={W.input}
                                                placeholder="090x xxx xxx"
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="phone-pad"
                                                value={customerPhone}
                                                onChangeText={setCustomerPhone}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={W.inputGroup}>
                                    <Text style={W.label}>Địa chỉ</Text>
                                    <View style={W.inputBox}>
                                        <Ionicons name="location-outline" size={15} color="#94A3B8" />
                                        <TextInput
                                            style={W.input}
                                            placeholder="Quận/Huyện, TP..."
                                            placeholderTextColor="#94A3B8"
                                            value={address}
                                            onChangeText={setAddress}
                                        />
                                    </View>
                                </View>

                                <View style={W.inputGroup}>
                                    <Text style={W.label}>Ghi chú</Text>
                                    <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 90 }]}>
                                        <TextInput
                                            style={[W.input, { textAlignVertical: 'top' }]}
                                            placeholder="Yêu cầu cụ thể của khách hàng..."
                                            placeholderTextColor="#94A3B8"
                                            multiline
                                            value={note}
                                            onChangeText={setNote}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Preview */}
                            <View style={W.card}>
                                <View style={W.cardHeader}>
                                    <Ionicons name="eye-outline" size={16} color="#2563EB" />
                                    <Text style={W.cardTitle}>Xem trước</Text>
                                </View>
                                <View style={W.previewRow}>
                                    <View style={[W.previewIcon, { backgroundColor: selectedType?.bg }]}>
                                        <Ionicons name={selectedType?.icon} size={20} color={selectedType?.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={W.previewId}>{serviceId}</Text>
                                        <Text style={[W.previewType, { color: selectedType?.color }]}>{selectedType?.label}</Text>
                                    </View>
                                    <View style={[W.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                                        <View style={[W.statusDot, { backgroundColor: '#F59E0B' }]} />
                                        <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600' }}>Chờ xử lý</Text>
                                    </View>
                                </View>
                                {(customerName || customerPhone) && (
                                    <View style={W.previewCustomer}>
                                        <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                                        <Text style={W.previewCustomerText}>
                                            {customerName || '—'}{customerPhone ? ` · ${customerPhone}` : ''}
                                        </Text>
                                    </View>
                                )}
                                {machineName && (
                                    <View style={W.previewCustomer}>
                                        <Ionicons name="settings-outline" size={14} color="#94A3B8" />
                                        <Text style={W.previewCustomerText}>{machineName}</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[W.submitBtn, submitting && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={submitting ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                                <Text style={W.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo dịch vụ'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={W.cancelBtnFull} onPress={() => router.back()}>
                                <Text style={W.cancelBtnFullText}>Hủy bỏ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────
    // MOBILE LAYOUT — theo ảnh thiết kế
    // ─────────────────────────────────────────────────────────
    return (
        <View style={[M.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={M.header}>
                <TouchableOpacity onPress={() => router.back()} style={M.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <Text style={M.headerTitle}>Thêm dịch vụ</Text>
                <View style={M.headerAvatar}>
                    <Ionicons name="person" size={16} color="#64748B" />
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={M.scroll}
                >

                    {/* Banner */}
                    <View style={M.banner}>
                        <View style={[M.bannerIcon, { backgroundColor: selectedType?.color + '22' }]}>
                            <Ionicons name={selectedType?.icon} size={40} color={selectedType?.color} />
                        </View>
                        <Text style={M.bannerText}>Chi tiết thông tin dịch vụ mới</Text>
                    </View>

                    {/* Loại hình dịch vụ */}
                    <View style={M.card}>
                        <Text style={M.sectionTitle}>LOẠI HÌNH DỊCH VỤ</Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={M.typeScroll}>
                            {SERVICE_TYPES.map(type => {
                                const active = serviceType === type.key;
                                return (
                                    <TouchableOpacity
                                        key={type.key}
                                        style={[M.typeTab, active && M.typeTabActive]}
                                        onPress={() => setServiceType(type.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[M.typeTabText, active && M.typeTabTextActive]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <Text style={M.fieldLabel}>TÊN MÁY</Text>
                        <View style={M.inputBox}>
                            <Ionicons name="settings-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={M.input}
                                placeholder="Nhập tên thiết bị..."
                                placeholderTextColor="#94A3B8"
                                value={machineName}
                                onChangeText={setMachineName}
                            />
                        </View>
                    </View>

                    {/* Thông tin khách hàng */}
                    <View style={M.card}>
                        <Text style={M.sectionTitle}>THÔNG TIN KHÁCH HÀNG</Text>

                        <Text style={M.fieldLabel}>TÊN KHÁCH HÀNG</Text>
                        <View style={M.inputBox}>
                            <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={M.input}
                                placeholder="Nguyễn Văn A"
                                placeholderTextColor="#94A3B8"
                                value={customerName}
                                onChangeText={setCustomerName}
                            />
                        </View>

                        <Text style={M.fieldLabel}>SỐ ĐIỆN THOẠI</Text>
                        <View style={M.inputBox}>
                            <Ionicons name="call-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={M.input}
                                placeholder="090x xxx xxx"
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                                value={customerPhone}
                                onChangeText={setCustomerPhone}
                            />
                        </View>

                        <Text style={M.fieldLabel}>ĐỊA CHỈ</Text>
                        <View style={M.inputBox}>
                            <Ionicons name="location-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={M.input}
                                placeholder="Quận/Huyện, TP..."
                                placeholderTextColor="#94A3B8"
                                value={address}
                                onChangeText={setAddress}
                            />
                        </View>

                        <Text style={M.fieldLabel}>GHI CHÚ</Text>
                        <View style={[M.inputBox, { alignItems: 'flex-start', minHeight: 100 }]}>
                            <TextInput
                                style={[M.input, { textAlignVertical: 'top', paddingTop: 2 }]}
                                placeholder="Yêu cầu cụ thể của khách hàng..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>
                    </View>

                    <View style={{ height: insets.bottom + 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Submit button — fixed bottom */}
            <View style={[M.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity
                    style={[M.submitBtn, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                >
                    <Ionicons name={submitting ? 'hourglass-outline' : 'add-circle-outline'} size={22} color="#fff" />
                    <Text style={M.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo dịch vụ'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ── Web Styles ───────────────────────────────────────────────
const W = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scroll: {
        paddingHorizontal: 32,
        paddingTop: 28,
        paddingBottom: 40,
    },
    pageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 28,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    pageSub: {
        fontSize: 14,
        color: '#64748B',
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    grid: {
        flexDirection: 'row',
        gap: 20,
        alignItems: 'flex-start',
    },
    col: {
        flex: 3,
    },
    colRight: {
        flex: 2,
        gap: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    typeCard: {
        flex: 1,
        minWidth: 100,
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        position: 'relative',
        gap: 6,
    },
    typeIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        textAlign: 'center',
    },
    typeCheck: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row2: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    required: {
        color: '#EF4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '500',
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    previewIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewId: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    previewType: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    previewCustomer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginTop: 4,
    },
    previewCustomerText: {
        fontSize: 12,
        color: '#64748B',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#2563EB',
        borderRadius: 10,
        paddingVertical: 14,
        shadowColor: '#2563EB',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    cancelBtnFull: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelBtnFullText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
    },
});

// ── Mobile Styles ────────────────────────────────────────────
const M = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    scroll: {
        paddingBottom: 16,
    },

    // Banner
    banner: {
        backgroundColor: '#0F172A',
        margin: 16,
        borderRadius: 18,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        overflow: 'hidden',
    },
    bannerIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },

    // Card
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#2563EB',
        letterSpacing: 0.8,
        marginBottom: 14,
    },

    // Service type tabs
    typeScroll: {
        marginBottom: 18,
    },
    typeTab: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 25,
        marginRight: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    typeTabActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#2563EB',
    },
    typeTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    typeTabTextActive: {
        color: '#2563EB',
    },

    // Fields
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginTop: 6,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 4,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
    },

    // Bottom submit
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#2563EB',
        borderRadius: 16,
        paddingVertical: 17,
        shadowColor: '#2563EB',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});