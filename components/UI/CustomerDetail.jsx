// components/UI/CustomerDetail.jsx — style giống order panel

import { showAlert } from '@/components/Main/showAlert';
import { createNotification } from '@/components/Utils/chatService';
import { deleteCustomerGuarded } from '@/components/Utils/deleteCustomer';
import { fmtDate, fmtPhone, getInitials } from '@/components/Utils/formatters';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getRole } from '../Utils/roleHelper';


const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const hashColor = s => AVATAR_COLORS[(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

function InfoSection({ title, rows }) {
    return (
        <View style={S.section}>
            <Text style={S.sectionTitle}>{title}</Text>
            {rows.filter(r => r.value).map((r, i) => (
                <View key={i} style={S.infoRow}>
                    <View style={S.infoIconWrap}>
                        <Ionicons name={r.icon} size={13} color="#94A3B8" />
                    </View>
                    <Text style={S.infoLabel}>{r.label}</Text>
                    <Text style={S.infoValue}>{r.value}</Text>
                </View>
            ))}
        </View>
    );
}

export default function CustomerDetail({ customer, onClose, onEdit, onDeleted }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail); // ← thêm getRole
    const [local, setLocal] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { if (customer) setLocal(customer); }, [customer]);

    // Chỉ admin được xoá — khớp rule Firestore `customers.allow delete: if isAdmin()`,
    // nếu cho role khác bấm thì Firestore chặn và người dùng chỉ thấy lỗi khó hiểu.
    const canDeleteCustomer = role === 'admin';

    const handleDelete = () => {
        if (!canDeleteCustomer || !local?.docId) return;
        showAlert(
            'Xoá khách hàng',
            `Bạn có chắc muốn xoá khách hàng "${local.name || local.companyName || local.phone}"? Không thể hoàn tác.`,
            async () => {
                setDeleting(true);
                try {
                    const { ok, linkedOrders } = await deleteCustomerGuarded(local);
                    if (!ok) {
                        showAlert(
                            'Không thể xoá',
                            `Khách hàng này còn ${linkedOrders} đơn hàng. Hãy xoá các đơn đó trước, nếu không đơn sẽ trỏ tới khách hàng không còn tồn tại.`
                        );
                        return;
                    }
                    if (local.createdBy && local.createdBy !== userDetail?.email) {
                        await createNotification({
                            userEmail: local.createdBy,
                            type: 'customer_deleted',
                            title: '🗑️ Khách hàng đã bị xoá',
                            body: `Khách hàng ${local.name || local.phone || '—'} đã bị admin xoá khỏi hệ thống`,
                            path: '/(tabs)/customer',
                        }).catch(() => { });
                    }
                    onDeleted?.(local);
                    onClose?.();
                } catch (e) {
                    showAlert('Lỗi', 'Không thể xoá khách hàng: ' + e.message);
                } finally {
                    setDeleting(false);
                }
            }
        );
    };

    if (!customer || !local) return null;

    const color = hashColor(local.name);
    const isCompany = local.bizModel === 'company';

    // Được sửa nếu: là admin HOẶC là người tạo khách hàng
    const canEditCustomer = role === 'admin' ||
        role === 'giamdoc' && false ||
        (userDetail?.email && local.createdBy === userDetail.email);

    return (
        <View style={S.panel}>
            <View style={S.header}>
                <View style={S.headerTop}>
                    <TouchableOpacity style={S.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={S.title} numberOfLines={1}>{local.name || local.companyName || '—'}</Text>
                        <Text style={S.subtitle}>{fmtPhone(local.phone)}</Text>
                    </View>
                    <View style={[S.headerAvatar, { backgroundColor: color + '20' }]}>
                        <Text style={[S.headerAvatarText, { color }]}>{getInitials(local.name)}</Text>
                    </View>
                </View>

                <View style={S.actions}>
                    {/* Nút Sửa: chỉ hiện nếu có onEdit và được quyền */}
                    {onEdit && canEditCustomer && (
                        <TouchableOpacity style={S.aBtn} onPress={onEdit}>
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={S.aBtnText}>Sửa</Text>
                        </TouchableOpacity>
                    )}
                    {/* Nút Tạo đơn: ẩn với giamdoc */}
                    {role !== 'giamdoc' && (
                        <TouchableOpacity
                            style={[S.aBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                            onPress={() => router.push({ pathname: '/addOrder', params: { customerParams: JSON.stringify(customer) } })}
                        >
                            <Ionicons name="add-circle-outline" size={13} color="#059669" />
                            <Text style={[S.aBtnText, { color: '#059669' }]}>Tạo đơn</Text>
                        </TouchableOpacity>
                    )}
                    {canDeleteCustomer && (
                        <TouchableOpacity
                            style={[S.aBtn, S.aBtnDanger, deleting && { opacity: 0.6 }]}
                            onPress={handleDelete}
                            disabled={deleting}
                        >
                            <Ionicons name="trash-outline" size={13} color="#DC2626" />
                            <Text style={[S.aBtnText, S.aBtnDangerText]}>{deleting ? 'Đang xoá...' : 'Xoá'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                <InfoSection
                    title="Thông tin liên hệ"
                    rows={[
                        { icon: 'call-outline', label: 'Điện thoại', value: fmtPhone(local.phone) },
                        { icon: 'mail-outline', label: 'Email', value: local.email || local.emailContact },
                        { icon: 'location-outline', label: 'Địa chỉ', value: local.address },
                        { icon: 'calendar-outline', label: 'Ngày tạo', value: fmtDate(local.createdAt) },
                    ]}
                />

                {isCompany && (
                    <InfoSection
                        title="Thông tin doanh nghiệp"
                        rows={[
                            { icon: 'business-outline', label: 'Công ty', value: local.companyName },
                            { icon: 'document-text-outline', label: 'MST', value: local.taxCode },
                            { icon: 'location-outline', label: 'Địa chỉ KD', value: local.bizAddress },
                            { icon: 'person-outline', label: 'Người LH', value: local.contactName ? `${local.contactName} · ${fmtPhone(local.contactPhone)}` : null },
                        ]}
                    />
                )}

                {!isCompany && (local.cccd || local.dob) && (
                    <InfoSection
                        title="Thông tin cá nhân"
                        rows={[
                            { icon: 'card-outline', label: 'CCCD', value: local.cccd },
                            { icon: 'calendar-outline', label: 'Năm sinh', value: local.dob },
                        ]}
                    />
                )}

                <InfoSection
                    title="Nguồn"
                    rows={[
                        { icon: 'person-add-outline', label: 'Tạo bởi', value: local.createdBy },
                    ]}
                />
                <View style={{ height: 32 }} />
            </ScrollView>
        </View >
    );
}

const S = StyleSheet.create({
    panel: { width: 360, backgroundColor: '#fff', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', flexDirection: 'column', borderRadius: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
    header: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    closeBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
    headerAvatar: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    headerAvatarText: { fontSize: 15, fontWeight: '800' },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    aBtnDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    aBtnDangerText: { color: '#DC2626' },
    // Info section
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.07, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 80, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
});