import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
    Modal, Platform, Pressable, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../../components/Main/showAlert';
import { db } from '../../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

const SERVICE_TYPES = {
    MAINTENANCE: { label: 'Bảo dưỡng', icon: 'construct-outline', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
    INSTALLATION: { label: 'Lắp đặt', icon: 'build-outline', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
    SALT: { label: 'Đổ muối', icon: 'water-outline', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
    DELIVERY: { label: 'Giao hàng', icon: 'car-outline', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
    CONSULTING: { label: 'Tư vấn', icon: 'chatbubbles-outline', color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8' },
};

const STATUS_CONFIG = {
    PENDING: { label: 'Chờ xử lý', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: 'time-outline' },
    PROCESSING: { label: 'Đang xử lý', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', icon: 'reload-outline' },
    COMPLETED: { label: 'Hoàn thành', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: 'checkmark-circle' },
    CANCELLED: { label: 'Đã hủy', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: 'close-circle-outline' },
};

const STATUS_FLOW = ['PENDING', 'PROCESSING', 'COMPLETED'];
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

// ── Status Picker Modal ───────────────────────────────────────
function StatusPickerModal({ currentStatus, onSelect, onClose, visible }) {
    const ALL_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <Pressable style={M.overlay} onPress={onClose}>
                <View style={M.sheet} onStartShouldSetResponder={() => true}>
                    <View style={M.sheetHeader}>
                        <Text style={M.sheetTitle}>Chọn trạng thái</Text>
                        <TouchableOpacity onPress={onClose} style={M.sheetClose}>
                            <Ionicons name="close" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    {ALL_STATUSES.map(status => {
                        const cfg = STATUS_CONFIG[status];
                        const active = currentStatus === status;
                        return (
                            <TouchableOpacity
                                key={status}
                                style={[M.statusItem, active && M.statusItemActive]}
                                onPress={() => onSelect(status)}
                                activeOpacity={0.7}
                            >
                                <View style={[M.statusIconWrap, { backgroundColor: cfg.bg }]}>
                                    <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                                </View>
                                <Text style={[M.statusItemText, active && { color: cfg.color, fontWeight: '700' }]}>
                                    {cfg.label}
                                </Text>
                                {active && <Ionicons name="checkmark-circle" size={18} color={cfg.color} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Pressable>
        </Modal>
    );
}

const M = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 360, overflow: 'hidden' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    sheetClose: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    statusItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    statusItemActive: { backgroundColor: '#F8FAFC' },
    statusIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    statusItemText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
});

export default function ServiceDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);
    const params = useLocalSearchParams();

    const [service, setService] = useState(params.serviceParam ? JSON.parse(params.serviceParam) : {});
    const [updating, setUpdating] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    const isAdmin = (userDetail?.role || userDetail?.member || '').toLowerCase() === 'admin';
    const typeCfg = SERVICE_TYPES[service.type] || SERVICE_TYPES.MAINTENANCE;
    const statusCfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.PENDING;
    const currentStep = STATUS_FLOW.indexOf(service.status);

    const handleUpdateStatus = (newStatus) => {
        setShowStatusPicker(false);
        if (newStatus === service.status) return;

        showAlert(
            'Xác nhận thay đổi trạng thái',
            `Cập nhật sang "${STATUS_CONFIG[newStatus]?.label}"?`,
            async () => {
                setUpdating(true);
                try {
                    await updateDoc(doc(db, 'service', service.id), { status: newStatus });
                    setService(prev => ({ ...prev, status: newStatus }));
                } catch (e) {
                    showAlert('Lỗi', e.message);
                } finally {
                    setUpdating(false);
                }
            }
        );
    };

    const InfoRow = ({ icon, label, value, color }) => {
        if (!value) return null;
        return (
            <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                    <Ionicons name={icon} size={15} color={color || '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value}</Text>
                </View>
            </View>
        );
    };

    // ── Shared status section ─────────────────────────────────
    const StatusSection = () => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Ionicons name="git-branch-outline" size={16} color="#2563EB" />
                <Text style={styles.cardTitle}>Tiến trình</Text>
                {/* ✅ Chỉ admin được đổi trạng thái */}
                {isAdmin && (
                    <TouchableOpacity
                        style={[styles.changeStatusBtn, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}
                        onPress={() => setShowStatusPicker(true)}
                        disabled={updating}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                        <Text style={[styles.changeStatusText, { color: statusCfg.color }]}>
                            {updating ? 'Đang cập nhật...' : statusCfg.label}
                        </Text>
                        <Ionicons name="chevron-down" size={13} color={statusCfg.color} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Timeline */}
            <View style={styles.timeline}>
                {STATUS_FLOW.map((status, index) => {
                    const cfg = STATUS_CONFIG[status];
                    const done = index <= currentStep;
                    const curr = index === currentStep;
                    return (
                        <View key={status} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                                <View style={[styles.timelineDot, done && { backgroundColor: cfg.color, borderColor: cfg.color }, curr && styles.timelineDotCurrent]}>
                                    {done && <Ionicons name={curr ? cfg.icon : 'checkmark'} size={10} color="#fff" />}
                                </View>
                                {index < STATUS_FLOW.length - 1 && (
                                    <View style={[styles.timelineLine, done && index < currentStep && { backgroundColor: '#10B981' }]} />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={[styles.timelineLabel, done && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                                {curr && <Text style={styles.timelineCurrent}>Trạng thái hiện tại</Text>}
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* Cancelled badge */}
            {service.status === 'CANCELLED' && (
                <View style={[styles.cancelledBanner, { backgroundColor: STATUS_CONFIG.CANCELLED.bg, borderColor: STATUS_CONFIG.CANCELLED.border }]}>
                    <Ionicons name="close-circle-outline" size={15} color={STATUS_CONFIG.CANCELLED.color} />
                    <Text style={[styles.cancelledText, { color: STATUS_CONFIG.CANCELLED.color }]}>Dịch vụ này đã bị hủy</Text>
                </View>
            )}
        </View>
    );

    // ── Order items section ───────────────────────────────────
    const OrderItemsSection = () => {
        if (!service.orderId && !service.orderItems?.length) return null;
        const total = (service.orderItems || []).reduce((s, p) => s + (p.price * p.qty || 0), 0);
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="cube-outline" size={16} color="#2563EB" />
                    <Text style={styles.cardTitle}>Sản phẩm đính kèm</Text>
                    {service.orderId && (
                        <View style={styles.orderTag}>
                            <Ionicons name="receipt-outline" size={11} color="#2563EB" />
                            <Text style={styles.orderTagText}>#{service.orderId}</Text>
                        </View>
                    )}
                </View>
                {(service.orderItems || []).map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                        <View style={styles.itemIcon}><Ionicons name="water-outline" size={13} color="#2563EB" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemMeta}>x{item.qty} · {fmt(item.price)}</Text>
                        </View>
                        <Text style={styles.itemTotal}>{fmt(item.price * item.qty)}</Text>
                    </View>
                ))}
                {total > 0 && (
                    <View style={styles.itemTotalRow}>
                        <Text style={styles.itemTotalLabel}>Tổng giá trị</Text>
                        <Text style={styles.itemTotalValue}>{fmt(total)}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, !isWeb && { paddingTop: insets.top }]}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={18} color="#64748B" />
                    {isWeb && <Text style={styles.backText}>Quay lại</Text>}
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chi tiết dịch vụ</Text>
                {/* ✅ Nút sửa dịch vụ */}
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => router.push({
                        pathname: '/editService/[serviceID]',
                        params: { serviceID: service.id, serviceParam: JSON.stringify(service) },
                    })}
                >
                    <Ionicons name="create-outline" size={16} color="#2563EB" />
                    {isWeb && <Text style={styles.editBtnText}>Sửa</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, isWeb && styles.scrollWeb]}>
                {isWeb ? (
                    <View style={styles.webGrid}>
                        {/* LEFT */}
                        <View style={styles.webCol}>
                            {/* Identity */}
                            <View style={styles.card}>
                                <View style={styles.serviceTopRow}>
                                    <View style={[styles.serviceTypeIcon, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
                                        <Ionicons name={typeCfg.icon} size={28} color={typeCfg.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.serviceIdRow}>
                                            <Text style={styles.serviceId}>#{service.id}</Text>
                                            <View style={[styles.statusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                                                <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                                                <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.typePill, { backgroundColor: typeCfg.bg }]}>
                                            <Ionicons name={typeCfg.icon} size={12} color={typeCfg.color} />
                                            <Text style={[styles.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                                        </View>
                                        <Text style={styles.createdAt}>{service.createdAt ? new Date(service.createdAt).toLocaleString('vi-VN') : '—'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}><Ionicons name="person-circle-outline" size={16} color="#2563EB" /><Text style={styles.cardTitle}>Thông tin khách hàng</Text></View>
                                <InfoRow icon="person-outline" label="Tên khách hàng" value={service.customer} />
                                <InfoRow icon="call-outline" label="Số điện thoại" value={service.phone} color="#2563EB" />
                                <InfoRow icon="location-outline" label="Địa chỉ" value={service.address} />
                            </View>

                            {service.note && (
                                <View style={styles.card}>
                                    <View style={styles.cardHeader}><Ionicons name="document-text-outline" size={16} color="#2563EB" /><Text style={styles.cardTitle}>Ghi chú</Text></View>
                                    <Text style={styles.noteText}>{service.note}</Text>
                                </View>
                            )}

                            <OrderItemsSection />
                        </View>

                        {/* RIGHT */}
                        <View style={styles.webColRight}>
                            <StatusSection />
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <View style={styles.serviceTopRow}>
                                <View style={[styles.serviceTypeIcon, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
                                    <Ionicons name={typeCfg.icon} size={26} color={typeCfg.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.serviceId}>#{service.id}</Text>
                                    <View style={styles.pillsRow}>
                                        <View style={[styles.typePill, { backgroundColor: typeCfg.bg }]}><Text style={[styles.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text></View>
                                        <View style={[styles.statusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                                            <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.createdAt}>{service.createdAt ? new Date(service.createdAt).toLocaleString('vi-VN') : '—'}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <View style={styles.cardHeader}><Ionicons name="person-circle-outline" size={16} color="#2563EB" /><Text style={styles.cardTitle}>Thông tin khách hàng</Text></View>
                            <InfoRow icon="person-outline" label="Tên khách hàng" value={service.customer} />
                            <InfoRow icon="call-outline" label="Số điện thoại" value={service.phone} color="#2563EB" />
                            <InfoRow icon="location-outline" label="Địa chỉ" value={service.address} />
                        </View>

                        {service.note && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}><Ionicons name="document-text-outline" size={16} color="#2563EB" /><Text style={styles.cardTitle}>Ghi chú</Text></View>
                                <Text style={styles.noteText}>{service.note}</Text>
                            </View>
                        )}

                        <OrderItemsSection />
                        <StatusSection />
                        <View style={{ height: insets.bottom + 24 }} />
                    </>
                )}
            </ScrollView>

            {/* Status picker modal */}
            <StatusPickerModal
                visible={showStatusPicker}
                currentStatus={service.status}
                onSelect={handleUpdateStatus}
                onClose={() => setShowStatusPicker(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isWeb ? 32 : 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: isWeb ? 12 : 0, paddingVertical: isWeb ? 6 : 0, borderRadius: 8, backgroundColor: isWeb ? '#F1F5F9' : 'transparent', borderWidth: isWeb ? 1 : 0, borderColor: '#E2E8F0' },
    backText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    headerTitle: { fontSize: isWeb ? 16 : 17, fontWeight: '800', color: '#0F172A' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: isWeb ? 12 : 8, paddingVertical: isWeb ? 7 : 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    editBtnText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
    scroll: { padding: isWeb ? 0 : 16 },
    scrollWeb: { padding: 32 },
    webGrid: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    webCol: { flex: 3 },
    webColRight: { flex: 2, gap: 16 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: isWeb ? 20 : 16,
        borderWidth: 1,
        borderColor: '#E7F6FC',
        marginBottom: 14,
        overflow: 'hidden', // ✅ giữ bo góc cho header
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 12,
        paddingTop: 12,
        paddingHorizontal: isWeb ? 20 : 16,  // ✅ tự thêm padding ngang
        borderBottomWidth: 1,
        borderBottomColor: '#E7F6FC',
        backgroundColor: '#E7F6FC',

        // ✅ kéo ra bù lại padding của card
        marginTop: -(isWeb ? 20 : 16),
        marginHorizontal: -(isWeb ? 20 : 16),
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 },
    serviceTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    serviceTypeIcon: { width: isWeb ? 56 : 50, height: isWeb ? 56 : 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    serviceIdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
    serviceId: { fontSize: isWeb ? 20 : 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
    typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    typePillText: { fontSize: 11, fontWeight: '700' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    createdAt: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    infoIconWrap: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginBottom: 2 },
    infoValue: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
    noteText: { fontSize: 14, color: '#374151', lineHeight: 20, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
    // Status section
    changeStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    changeStatusText: { fontSize: 12, fontWeight: '700' },
    timeline: { paddingLeft: 4 },
    timelineItem: { flexDirection: 'row', gap: 12, minHeight: 50 },
    timelineLeft: { alignItems: 'center', width: 20 },
    timelineDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    timelineDotCurrent: { width: 22, height: 22, borderRadius: 11, shadowColor: '#000', shadowopacity: 0.05, shadowRadius: 4, elevation: 3 },
    timelineLine: { flex: 1, width: 2, backgroundColor: '#E2E8F0', marginVertical: 2 },
    timelineContent: { flex: 1, paddingBottom: 16, paddingTop: 1 },
    timelineLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
    timelineCurrent: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1 },
    cancelledText: { fontSize: 13, fontWeight: '600' },
    // Order items
    orderTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    orderTagText: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    itemIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    itemMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
    itemTotal: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
    itemTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    itemTotalLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    itemTotalValue: { fontSize: 18, fontWeight: '900', color: '#2563EB', letterSpacing: -0.5 },
});