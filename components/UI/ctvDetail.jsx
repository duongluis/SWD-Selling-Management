// components/UI/ctvDetail.jsx
// Giao diện panel (giống CustomerDetail) + luồng nghiệp vụ (từ customerView)

import { showAlert } from '@/components/Main/showAlert';
import { createNotification } from '@/components/Utils/chatService';
import { fmtDate, fmtPhone, getInitials } from '@/components/Utils/formatters';
import { canEditConsult, getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    Dimensions,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

// ── Helpers ───────────────────────────────────────────────────
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const hashColor = (s) =>
    AVATAR_COLORS[(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const handleCall = async (phone) => {
    try {
        const can = await Linking.canOpenURL(`tel:${phone}`);
        if (can) await Linking.openURL(`tel:${phone}`);
    } catch (e) { console.error(e); }
};
const handleZalo = async (phone) => {
    const z = `zalo://chat?phone=${phone}`;
    const f = `https://zalo.me/${phone}`;
    try {
        const can = await Linking.canOpenURL(z);
        await Linking.openURL(can ? z : f);
    } catch (e) { console.error(e); }
};
const handleSMS = async (phone) => {
    try {
        const can = await Linking.canOpenURL(`sms:${phone}`);
        if (can) await Linking.openURL(`sms:${phone}`);
    } catch (e) { console.error(e); }
};

// ── Trạng thái tư vấn ─────────────────────────────────────────
const CONSULT_STATUS_CFG = {
    pending: { label: 'Đang tư vấn', icon: 'time-outline', color: '#2563EB', bg: '#EFF6FF' },
    success: { label: 'Thành công', icon: 'checkmark-circle-outline', color: '#059669', bg: '#ECFDF5' },
    failed: { label: 'Thất bại', icon: 'close-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
    none: { label: 'Chưa tư vấn', icon: 'ellipse-outline', color: '#94A3B8', bg: '#F1F5F9' },
};

// ── InfoRow ───────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
    if (!value) return null;
    return (
        <View style={S.infoRow}>
            <View style={S.infoIconWrap}>
                <Ionicons name={icon} size={13} color="#94A3B8" />
            </View>
            <Text style={S.infoLabel}>{label}</Text>
            <Text style={S.infoValue}>{value}</Text>
        </View>
    );
}

// ── InfoSection ───────────────────────────────────────────────
function InfoSection({ title, children }) {
    return (
        <View style={S.section}>
            <Text style={S.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function CtvDetail({ customer, onClose, onUpdated }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);

    const [local, setLocal] = useState(null);
    const [consultStatus, setConsultStatus] = useState(customer?.status || 'none');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showFailureInput, setShowFailureInput] = useState(false);
    const [failureReason, setFailureReason] = useState(customer?.reason || '');

    useEffect(() => {
        if (customer) {
            setLocal(customer);
            setConsultStatus(customer.status || 'none');
            setFailureReason(customer.reason || '');
            setShowFailureInput(false);
        }
    }, [customer]);

    if (!customer || !local) return null;

    const isConsult = ['none', 'pending', 'success', 'failed'].includes(local.status);
    const color = hashColor(local.name);
    const isCompany = local.bizModel === 'company';
    const canChangeStatus = canEditConsult(role) && ['pending', 'none'].includes(consultStatus);

    // ── Update status ─────────────────────────────────────────
    const handleConsultStatusChange = (newStatus) => {
        if (newStatus === consultStatus || !local.docId) return;
        if (newStatus === 'failed') { setShowFailureInput(true); return; }
        doUpdateStatus(newStatus, '');
    };

    const doUpdateStatus = async (newStatus, reason) => {
        setUpdatingStatus(true);
        try {
            const updateData = { status: newStatus };
            if (reason) updateData.reason = reason;
            await updateDoc(doc(db, 'consult', local.docId), updateData);
            setConsultStatus(newStatus);
            onUpdated?.({ ...local, status: newStatus, ...(reason ? { reason } : {}) });

            if (newStatus === 'success') {
                // Notify admins
                getDocs(query(collection(db, 'users'), where('role', '==', 'admin')))
                    .then(snap => {
                        snap.docs.forEach(d => {
                            const adminEmail = d.data().email;
                            if (adminEmail) createNotification({
                                userEmail: adminEmail,
                                type: 'consult_success',
                                title: 'Tư vấn thành công',
                                body: `${userDetail?.name || userDetail?.email} đã tư vấn thành công khách hàng ${local.name} (${local.phone})`,
                            }).catch(() => { });
                        });
                    }).catch(() => { });

                router.push({
                    pathname: '/addCustomer',
                    params: {
                        name: local.name || '',
                        phone: local.phone || '',
                        address: local.address || '',
                        note: local.note || '',
                        consultCreatedBy: local.createdBy || '',
                        consultDocId: local.docId || '',
                        fromConsult: 'true',
                    },
                });
            }
        } catch (e) { console.error(e); }
        finally { setUpdatingStatus(false); }
    };

    const statusCfg = CONSULT_STATUS_CFG[consultStatus] || CONSULT_STATUS_CFG.none;

    return (
        <View style={S.panel}>

            {/* ── Header ── */}
            <View style={S.header}>
                <View style={S.headerTop}>
                    <TouchableOpacity style={S.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={S.title} numberOfLines={1}>{local.name || '—'}</Text>
                        <Text style={S.subtitle}>{fmtPhone(local.phone)}</Text>
                    </View>
                    <View style={[S.headerAvatar, { backgroundColor: color + '20' }]}>
                        <Text style={[S.headerAvatarText, { color }]}>{getInitials(local.name)}</Text>
                    </View>
                </View>

                {/* Status badge */}
                <View style={[S.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
                    <Text style={[S.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>

                {/* ── Actions: gọi, SMS, Zalo, tạo đơn ── */}
                <View style={S.actions}>
                    {local.phone && (
                        <TouchableOpacity style={S.aBtn} onPress={() => handleCall(local.phone)}>
                            <Ionicons name="call-outline" size={13} color="#2563EB" />
                            <Text style={S.aBtnText}>Gọi</Text>
                        </TouchableOpacity>
                    )}
                    {local.phone && (
                        <TouchableOpacity style={[S.aBtn, { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }]}
                            onPress={() => handleSMS(local.phone)}>
                            <Ionicons name="chatbubble-outline" size={13} color="#059669" />
                            <Text style={[S.aBtnText, { color: '#059669' }]}>SMS</Text>
                        </TouchableOpacity>
                    )}
                    {local.phone && (
                        <TouchableOpacity style={[S.aBtn, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
                            onPress={() => handleZalo(local.phone)}>
                            <Ionicons name="logo-whatsapp" size={13} color="#0284C7" />
                            <Text style={[S.aBtnText, { color: '#0284C7' }]}>Zalo</Text>
                        </TouchableOpacity>
                    )}
                    {!isConsult && (
                        <TouchableOpacity
                            style={[S.aBtn, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}
                            onPress={() => router.push({
                                pathname: '/addOrder',
                                params: { customerParam: JSON.stringify(local) },
                            })}>
                            <Ionicons name="add-circle-outline" size={13} color="#7C3AED" />
                            <Text style={[S.aBtnText, { color: '#7C3AED' }]}>Tạo đơn</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>

                {/* ── Thông tin liên hệ ── */}
                <InfoSection title="Thông tin liên hệ">
                    <InfoRow icon="call-outline" label="Điện thoại" value={fmtPhone(local.phone)} />
                    <InfoRow icon="mail-outline" label="Email" value={local.email || local.emailContact} />
                    <InfoRow icon="location-outline" label="Địa chỉ" value={local.address} />
                    <InfoRow icon="calendar-outline" label="Ngày tạo" value={fmtDate(local.createdAt)} />
                    <InfoRow icon="person-outline" label="Tạo bởi" value={local.createdBy} />
                </InfoSection>

                {/* ── Thông tin doanh nghiệp ── */}
                {isCompany && (
                    <InfoSection title="Thông tin doanh nghiệp">
                        <InfoRow icon="business-outline" label="Công ty" value={local.companyName} />
                        <InfoRow icon="document-text-outline" label="MST" value={local.taxCode} />
                        <InfoRow icon="location-outline" label="Địa chỉ KD" value={local.bizAddress} />
                        <InfoRow icon="person-outline" label="Người LH"
                            value={local.contactName ? `${local.contactName} · ${fmtPhone(local.contactPhone)}` : null} />
                    </InfoSection>
                )}

                {/* ── Sản phẩm quan tâm ── */}
                {isConsult && (local.productNames?.length > 0 || canEditConsult(role)) && (
                    <InfoSection title="Sản phẩm quan tâm">
                        {(local.productNames || []).length > 0 ? (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                {local.productNames.map((p, i) => (
                                    <View key={i} style={S.productTag}>
                                        <Text style={S.productTagText}>{p}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={S.emptyText}>Chưa có sản phẩm nào được chọn</Text>
                        )}
                    </InfoSection>
                )}

                {/* ── Trạng thái tư vấn ── */}
                {isConsult && (
                    <InfoSection title="Trạng thái tư vấn">
                        {Object.entries(CONSULT_STATUS_CFG)
                            .filter(([k]) => k !== 'none')
                            .map(([key, cfg]) => {
                                const active = consultStatus === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[S.statusOpt, active && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                                        onPress={() => handleConsultStatusChange(key)}
                                        activeOpacity={0.8}
                                        disabled={updatingStatus || !canChangeStatus}
                                    >
                                        <Ionicons name={cfg.icon} size={16}
                                            color={active ? cfg.color : '#CBD5E1'} />
                                        <Text style={[S.statusOptText, active && { color: cfg.color, fontWeight: '700' }]}>
                                            {cfg.label}
                                        </Text>
                                        {active && (
                                            <Ionicons name="checkmark-circle" size={16} color={cfg.color} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                        {/* Input lý do thất bại */}
                        {showFailureInput && (
                            <View style={{ marginTop: 8, gap: 8 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>
                                    Lý do thất bại *
                                </Text>
                                <View style={[S.statusOpt, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                                    <TextInput
                                        style={{ flex: 1, fontSize: 13, color: '#0F172A', minHeight: 56, textAlignVertical: 'top' }}
                                        placeholder="Nhập lý do thất bại..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        value={failureReason}
                                        onChangeText={setFailureReason}
                                    />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={S.failCancelBtn}
                                        onPress={() => { setShowFailureInput(false); setFailureReason(''); }}
                                    >
                                        <Text style={S.failCancelText}>Hủy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={S.failConfirmBtn}
                                        onPress={() => {
                                            if (!failureReason.trim()) {
                                                showAlert('Thông báo', 'Vui lòng nhập lý do thất bại');
                                                return;
                                            }
                                            setShowFailureInput(false);
                                            doUpdateStatus('failed', failureReason.trim());
                                        }}
                                        disabled={updatingStatus}
                                    >
                                        <Text style={S.failConfirmText}>Xác nhận</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Hiển thị lý do thất bại đã lưu */}
                        {consultStatus === 'failed' && (local.reason || failureReason) && (
                            <View style={S.failReasonBox}>
                                <Text style={S.failReasonLabel}>LÝ DO THẤT BẠI</Text>
                                <Text style={S.failReasonText}>{local.reason || failureReason}</Text>
                            </View>
                        )}
                    </InfoSection>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </View >
    );
}

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
    panel: {
        width: 360,
        backgroundColor: '#fff',
        borderLeftWidth: 0.5,
        borderLeftColor: '#E2E8F0',
        flexDirection: 'column',
        borderRadius: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 12 : 0,
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: -4, height: 0 },
        elevation: 8,
    },
    header: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    closeBtn: {
        width: 26, height: 26, borderRadius: 7,
        backgroundColor: '#F1F5F9',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
    headerAvatar: {
        width: 42, height: 42, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    headerAvatarText: { fontSize: 15, fontWeight: '800' },

    // Status badge ở header
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 20,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },

    // Action buttons
    actions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
    aBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 11, paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },

    // Info section
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: {
        fontSize: 10, fontWeight: '700', color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingVertical: 7,
        borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC',
        gap: 8,
    },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 80, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },

    // Sản phẩm
    productTag: {
        backgroundColor: '#EFF6FF', borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: '#BFDBFE',
    },
    productTagText: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
    emptyText: { fontSize: 12, color: '#94A3B8', paddingVertical: 4 },

    // Trạng thái tư vấn
    statusOpt: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 9, borderWidth: 1.5, borderColor: '#E2E8F0',
        backgroundColor: '#fff', marginBottom: 6,
    },
    statusOptText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },

    // Failure input
    failCancelBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 9,
        borderRadius: 8, backgroundColor: '#F1F5F9',
    },
    failCancelText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    failConfirmBtn: {
        flex: 2, alignItems: 'center', paddingVertical: 9,
        borderRadius: 8, backgroundColor: '#EF4444',
    },
    failConfirmText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    failReasonBox: {
        marginTop: 8, backgroundColor: '#FEF2F2',
        borderRadius: 9, padding: 12,
    },
    failReasonLabel: {
        fontSize: 10, fontWeight: '700', color: '#EF4444',
        marginBottom: 4, letterSpacing: 0.5,
    },
    failReasonText: { fontSize: 12, color: '#374151' },
});