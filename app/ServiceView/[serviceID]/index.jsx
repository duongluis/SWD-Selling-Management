import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function ServiceDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userDetail } = useContext(UserDetailContext);
    const params = useLocalSearchParams();

    const [service, setService] = useState(
        params.serviceParam ? JSON.parse(params.serviceParam) : {}
    );
    const [updating, setUpdating] = useState(false);

    const typeCfg = SERVICE_TYPES[service.type] || SERVICE_TYPES.MAINTENANCE;
    const statusCfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.PENDING;

    const handleUpdateStatus = async (newStatus) => {
        Alert.alert(
            'Xác nhận',
            `Cập nhật trạng thái sang "${STATUS_CONFIG[newStatus]?.label}"?`,
            [
                { text: 'Huỷ', style: 'cancel' },
                {
                    text: 'Xác nhận',
                    onPress: async () => {
                        setUpdating(true);
                        try {
                            await updateDoc(doc(db, 'service', service.id), { status: newStatus });
                            setService(prev => ({ ...prev, status: newStatus }));
                            Alert.alert('✅ Thành công', 'Đã cập nhật trạng thái!');
                        } catch (e) {
                            Alert.alert('Lỗi', e.message);
                        } finally {
                            setUpdating(false);
                        }
                    },
                },
            ]
        );
    };

    const currentStep = STATUS_FLOW.indexOf(service.status);
    const nextStatus = STATUS_FLOW[currentStep + 1];
    const nextStatusCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;

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

    return (
        <View style={[styles.container, !isWeb && { paddingTop: insets.top }]}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={18} color="#64748B" />
                    {isWeb && <Text style={styles.backText}>Quay lại</Text>}
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chi tiết dịch vụ</Text>
                <View style={{ width: isWeb ? 80 : 36 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, isWeb && styles.scrollWeb]}
            >
                {isWeb ? (
                    // ── WEB: 2 column ──────────────────────────────
                    <View style={styles.webGrid}>

                        {/* LEFT */}
                        <View style={styles.webCol}>

                            {/* Service identity */}
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
                                        <Text style={styles.createdAt}>
                                            {service.createdAt
                                                ? new Date(service.createdAt).toLocaleString('vi-VN')
                                                : '—'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Thông tin khách hàng */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
                                    <Text style={styles.cardTitle}>Thông tin khách hàng</Text>
                                </View>
                                <InfoRow icon="person-outline" label="Tên khách hàng" value={service.customer} />
                                <InfoRow icon="call-outline" label="Số điện thoại" value={service.phone} color="#2563EB" />
                                <InfoRow icon="location-outline" label="Địa chỉ" value={service.address} />
                            </View>

                            {/* Ghi chú */}
                            {service.note && (
                                <View style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                                        <Text style={styles.cardTitle}>Ghi chú</Text>
                                    </View>
                                    <Text style={styles.noteText}>{service.note}</Text>
                                </View>
                            )}
                        </View>

                        {/* RIGHT */}
                        <View style={styles.webColRight}>

                            {/* Thiết bị */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="settings-outline" size={16} color="#2563EB" />
                                    <Text style={styles.cardTitle}>Thiết bị</Text>
                                </View>
                                <InfoRow icon="hardware-chip-outline" label="Tên máy" value={service.machineName || 'Chưa nhập'} />
                                <InfoRow icon="construct-outline" label="Loại dịch vụ" value={typeCfg.label} color={typeCfg.color} />
                            </View>

                            {/* Timeline trạng thái */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="git-branch-outline" size={16} color="#2563EB" />
                                    <Text style={styles.cardTitle}>Tiến trình</Text>
                                </View>
                                <View style={styles.timeline}>
                                    {STATUS_FLOW.map((status, index) => {
                                        const cfg = STATUS_CONFIG[status];
                                        const done = index <= currentStep;
                                        const curr = index === currentStep;
                                        return (
                                            <View key={status} style={styles.timelineItem}>
                                                <View style={styles.timelineLeft}>
                                                    <View style={[
                                                        styles.timelineDot,
                                                        done && { backgroundColor: cfg.color, borderColor: cfg.color },
                                                        curr && styles.timelineDotCurrent,
                                                    ]}>
                                                        {done && <Ionicons name={curr ? cfg.icon : 'checkmark'} size={10} color="#fff" />}
                                                    </View>
                                                    {index < STATUS_FLOW.length - 1 && (
                                                        <View style={[styles.timelineLine, done && index < currentStep && { backgroundColor: '#10B981' }]} />
                                                    )}
                                                </View>
                                                <View style={styles.timelineContent}>
                                                    <Text style={[styles.timelineLabel, done && { color: cfg.color, fontWeight: '700' }]}>
                                                        {cfg.label}
                                                    </Text>
                                                    {curr && (
                                                        <Text style={styles.timelineCurrent}>Trạng thái hiện tại</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Action buttons */}
                            {nextStatus && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: nextStatusCfg?.color }, updating && { opacity: 0.7 }]}
                                    onPress={() => handleUpdateStatus(nextStatus)}
                                    disabled={updating}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={nextStatusCfg?.icon} size={16} color="#fff" />
                                    <Text style={styles.actionBtnText}>
                                        {updating ? 'Đang cập nhật...' : `Chuyển sang: ${nextStatusCfg?.label}`}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {service.status !== 'CANCELLED' && service.status !== 'COMPLETED' && (
                                <TouchableOpacity
                                    style={[styles.actionBtnOutline, { borderColor: '#EF4444' }]}
                                    onPress={() => handleUpdateStatus('CANCELLED')}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                                    <Text style={[styles.actionBtnOutlineText, { color: '#EF4444' }]}>Hủy dịch vụ</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                ) : (
                    // ── MOBILE ──────────────────────────────────────
                    <>
                        {/* Service identity card */}
                        <View style={styles.card}>
                            <View style={styles.serviceTopRow}>
                                <View style={[styles.serviceTypeIcon, { backgroundColor: typeCfg.bg, borderColor: typeCfg.border }]}>
                                    <Ionicons name={typeCfg.icon} size={26} color={typeCfg.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.serviceId}>#{service.id}</Text>
                                    <View style={styles.pillsRow}>
                                        <View style={[styles.typePill, { backgroundColor: typeCfg.bg }]}>
                                            <Text style={[styles.typePillText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                                        </View>
                                        <View style={[styles.statusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                                            <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.createdAt}>
                                        {service.createdAt ? new Date(service.createdAt).toLocaleString('vi-VN') : '—'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Thiết bị */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="settings-outline" size={16} color="#2563EB" />
                                <Text style={styles.cardTitle}>Thiết bị</Text>
                            </View>
                            <InfoRow icon="hardware-chip-outline" label="Tên máy" value={service.machineName || 'Chưa nhập'} />
                            <InfoRow icon="construct-outline" label="Loại dịch vụ" value={typeCfg.label} color={typeCfg.color} />
                        </View>

                        {/* Thông tin khách hàng */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
                                <Text style={styles.cardTitle}>Thông tin khách hàng</Text>
                            </View>
                            <InfoRow icon="person-outline" label="Tên khách hàng" value={service.customer} />
                            <InfoRow icon="call-outline" label="Số điện thoại" value={service.phone} color="#2563EB" />
                            <InfoRow icon="location-outline" label="Địa chỉ" value={service.address} />
                        </View>

                        {/* Ghi chú */}
                        {service.note && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                                    <Text style={styles.cardTitle}>Ghi chú</Text>
                                </View>
                                <Text style={styles.noteText}>{service.note}</Text>
                            </View>
                        )}

                        {/* Timeline */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="git-branch-outline" size={16} color="#2563EB" />
                                <Text style={styles.cardTitle}>Tiến trình</Text>
                            </View>
                            <View style={styles.timeline}>
                                {STATUS_FLOW.map((status, index) => {
                                    const cfg = STATUS_CONFIG[status];
                                    const done = index <= currentStep;
                                    const curr = index === currentStep;
                                    return (
                                        <View key={status} style={styles.timelineItem}>
                                            <View style={styles.timelineLeft}>
                                                <View style={[
                                                    styles.timelineDot,
                                                    done && { backgroundColor: cfg.color, borderColor: cfg.color },
                                                    curr && styles.timelineDotCurrent,
                                                ]}>
                                                    {done && <Ionicons name={curr ? cfg.icon : 'checkmark'} size={10} color="#fff" />}
                                                </View>
                                                {index < STATUS_FLOW.length - 1 && (
                                                    <View style={[styles.timelineLine, done && index < currentStep && { backgroundColor: '#10B981' }]} />
                                                )}
                                            </View>
                                            <View style={styles.timelineContent}>
                                                <Text style={[styles.timelineLabel, done && { color: cfg.color, fontWeight: '700' }]}>
                                                    {cfg.label}
                                                </Text>
                                                {curr && <Text style={styles.timelineCurrent}>Trạng thái hiện tại</Text>}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Action buttons */}
                        {nextStatus && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: nextStatusCfg?.color }, updating && { opacity: 0.7 }]}
                                onPress={() => handleUpdateStatus(nextStatus)}
                                disabled={updating}
                                activeOpacity={0.85}
                            >
                                <Ionicons name={nextStatusCfg?.icon} size={18} color="#fff" />
                                <Text style={styles.actionBtnText}>
                                    {updating ? 'Đang cập nhật...' : `Chuyển sang: ${nextStatusCfg?.label}`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {service.status !== 'CANCELLED' && service.status !== 'COMPLETED' && (
                            <TouchableOpacity
                                style={[styles.actionBtnOutline, { borderColor: '#EF4444' }]}
                                onPress={() => handleUpdateStatus('CANCELLED')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                                <Text style={[styles.actionBtnOutlineText, { color: '#EF4444' }]}>Hủy dịch vụ</Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: insets.bottom + 24 }} />
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isWeb ? 32 : 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: isWeb ? 12 : 0,
        paddingVertical: isWeb ? 6 : 0,
        borderRadius: 8,
        backgroundColor: isWeb ? '#F1F5F9' : 'transparent',
        borderWidth: isWeb ? 1 : 0,
        borderColor: '#E2E8F0',
    },
    backText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: isWeb ? 16 : 17,
        fontWeight: '800',
        color: '#0F172A',
    },

    // Scroll
    scroll: {
        padding: isWeb ? 0 : 16,
    },
    scrollWeb: {
        padding: 32,
    },

    // Web grid
    webGrid: {
        flexDirection: 'row',
        gap: 20,
        alignItems: 'flex-start',
    },
    webCol: {
        flex: 3,
    },
    webColRight: {
        flex: 2,
        gap: 16,
    },

    // Card
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: isWeb ? 20 : 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },

    // Service identity
    serviceTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    serviceTypeIcon: {
        width: isWeb ? 56 : 50,
        height: isWeb ? 56 : 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    serviceIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    serviceId: {
        fontSize: isWeb ? 20 : 16,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    pillsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 6,
    },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
    },
    typePillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    createdAt: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
    },

    // Info row
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    infoIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    infoLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },

    noteText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#2563EB',
    },

    // Timeline
    timeline: {
        paddingLeft: 4,
    },
    timelineItem: {
        flexDirection: 'row',
        gap: 12,
        minHeight: 50,
    },
    timelineLeft: {
        alignItems: 'center',
        width: 20,
    },
    timelineDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotCurrent: {
        width: 22,
        height: 22,
        borderRadius: 11,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#E2E8F0',
        marginVertical: 2,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 16,
        paddingTop: 1,
    },
    timelineLabel: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
    },
    timelineCurrent: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },

    // Actions
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    actionBtnOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 12,
        paddingVertical: 13,
        borderWidth: 1.5,
        backgroundColor: '#FFFFFF',
        marginBottom: 10,
    },
    actionBtnOutlineText: {
        fontSize: 14,
        fontWeight: '600',
    },
});