// components/UI/CustomerDetail.jsx — style giống order panel

import { fmtDate, fmtPhone, getInitials } from '@/components/Utils/formatters';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const isWeb = Platform.OS === 'web';

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

export default function CustomerDetail({ customer, onClose, onEdit }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const [local, setLocal] = useState(null);

    useEffect(() => { if (customer) setLocal(customer); }, [customer]);
    if (!customer || !local) return null;

    const color = hashColor(local.name);
    const isCompany = local.bizModel === 'company';

    return (
        <View style={S.panel}>
            {/* Header */}
            <View style={S.header}>
                <View style={S.headerTop}>
                    <TouchableOpacity style={S.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={S.title} numberOfLines={1}>{local.name || local.companyName || '—'}</Text>
                        <Text style={S.subtitle}>{fmtPhone(local.phone)}</Text>
                    </View>
                    {/* Avatar */}
                    <View style={[S.headerAvatar, { backgroundColor: color + '20' }]}>
                        <Text style={[S.headerAvatarText, { color }]}>{getInitials(local.name)}</Text>
                    </View>
                </View>
                {/* Actions */}
                <View style={S.actions}>
                    {onEdit && (
                        <TouchableOpacity style={S.aBtn} onPress={onEdit}>
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={S.aBtnText}>Sửa</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[S.aBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                        onPress={() => router.push({ pathname: '/addOrder', params: { customerParams: JSON.stringify(customer) } })}>
                        <Ionicons name="add-circle-outline" size={13} color="#059669" />
                        <Text style={[S.aBtnText, { color: '#059669' }]}>Tạo đơn</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
        </View>
    );
}

const S = StyleSheet.create({
    panel: { width: 360, backgroundColor: '#fff', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', flexDirection: 'column', borderRadius: isWeb ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
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
    // Info section
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.07, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 80, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
});