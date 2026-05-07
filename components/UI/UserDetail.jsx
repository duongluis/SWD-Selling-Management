// components/UI/UserDetail.jsx — style giống order panel

import { showAlert } from '@/components/Main/showAlert';
import { fmtCurrency, fmtDate, fmtPhone } from '@/components/Utils/formatters';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    Platform,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
const hashColor = s => AVATAR_COLORS[(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const isWeb = Platform.OS === 'web';
const ROLE_LABEL = {
    'đại lý': 'Đại lý', 'cộng tác viên': 'CTV', 'Đối tác': 'Đối tác', 'admin': 'Admin',
};

function InfoRow({ icon, label, value }) {
    if (!value) return null;
    return (
        <View style={S.infoRow}>
            <View style={S.infoIconWrap}><Ionicons name={icon} size={13} color="#94A3B8" /></View>
            <Text style={S.infoLabel}>{label}</Text>
            <Text style={S.infoValue} numberOfLines={2}>{value}</Text>
        </View>
    );
}

function Section({ title, children }) {
    return (
        <View style={S.section}>
            <Text style={S.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

export default function UserDetail({ user, onClose, onUpdated }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const [local, setLocal] = useState(null);
    const [approving, setApproving] = useState(false);

    useEffect(() => { if (user) setLocal(user); }, [user]);
    if (!user || !local) return null;

    const color = hashColor(local.email);
    const isCompany = local.bizModel === 'company';
    const verified = !!local.verified;
    const roleLabel = ROLE_LABEL[local.role || local.member] || local.role || '—';

    const handleApprove = () => {
        showAlert('Phê duyệt', `Phê duyệt tài khoản "${local.name}"?`, async () => {
            setApproving(true);
            try {
                await updateDoc(doc(db, 'users', local.email), { verified: true });
                const next = { ...local, verified: true };
                setLocal(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setApproving(false); }
        });
    };

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
                        <Text style={S.subtitle} numberOfLines={1}>{local.email}</Text>
                    </View>
                    {/* Verified badge */}
                    <View style={[S.verBadge, verified ? S.verBadgeOk : S.verBadgePending]}>
                        <Ionicons name={verified ? 'checkmark-circle' : 'time'} size={13} color={verified ? '#16A34A' : '#D97706'} />
                        <Text style={[S.verText, { color: verified ? '#16A34A' : '#D97706' }]}>{verified ? 'Đã xác minh' : 'Chờ duyệt'}</Text>
                    </View>
                </View>
                {/* Actions */}
                <View style={S.actions}>
                    {!verified && (
                        <TouchableOpacity style={[S.aBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                            onPress={handleApprove} disabled={approving}>
                            <Ionicons name="checkmark-circle-outline" size={13} color="#059669" />
                            <Text style={[S.aBtnText, { color: '#059669' }]}>{approving ? 'Đang xử lý...' : 'Phê duyệt'}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={S.aBtn}
                        onPress={() => router.push({ pathname: '/editUser/[userEmail]', params: { userEmail: local.email, userParam: JSON.stringify(local) } })}>
                        <Ionicons name="create-outline" size={13} color="#2563EB" />
                        <Text style={S.aBtnText}>Chỉnh sửa</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <Section title="Thông tin tài khoản">
                    <InfoRow icon="mail-outline" label="Email" value={local.email} />
                    <InfoRow icon="call-outline" label="Điện thoại" value={fmtPhone(local.phone)} />
                    <InfoRow icon="location-outline" label="Địa chỉ" value={local.address} />
                    <InfoRow icon="briefcase-outline" label="Vai trò" value={roleLabel} />
                    <InfoRow icon="calendar-outline" label="Ngày tạo" value={fmtDate(local.createdAt)} />
                </Section>

                {isCompany && (
                    <Section title="Thông tin doanh nghiệp">
                        <InfoRow icon="business-outline" label="Công ty" value={local.companyName} />
                        <InfoRow icon="document-text-outline" label="MST" value={local.taxCode} />
                        <InfoRow icon="location-outline" label="Địa chỉ KD" value={local.bizAddress} />
                        {local.contactName && (
                            <InfoRow icon="person-outline" label="Người LH"
                                value={`${local.contactName} · ${fmtPhone(local.contactPhone)}`} />
                        )}
                    </Section>
                )}

                {local.committedRevenue > 0 && (
                    <Section title="Cam kết kinh doanh">
                        <InfoRow icon="trending-up-outline" label="Cam kết/năm" value={fmtCurrency(local.committedRevenue)} />
                        <InfoRow icon="git-branch-outline" label="Phân phối"
                            value={local.distributionType === 'exclusive' ? 'Độc quyền' : 'Không độc quyền'} />
                        <InfoRow icon="map-outline" label="Khu vực" value={local.regionName || local.region} />
                    </Section>
                )}

                {local.bank && (
                    <Section title="Ngân hàng">
                        <InfoRow icon="card-outline" label="Ngân hàng" value={local.bank.name} />
                        <InfoRow icon="keypad-outline" label="Số TK" value={local.bank.accountNo} />
                        <InfoRow icon="person-outline" label="Chủ TK" value={local.bank.accountName} />
                    </Section>
                )}

                {local.revenueTotal > 0 && (
                    <View style={S.totalBar}>
                        <Text style={S.totalLabel}>Tổng doanh số</Text>
                        <Text style={S.totalValue}>{fmtCurrency(local.revenueTotal)}</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
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
    verBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
    verBadgeOk: { backgroundColor: '#ECFDF5' },
    verBadgePending: { backgroundColor: '#FFFBEB' },
    verText: { fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.07, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 88, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
    totalBar: { margin: 16, borderRadius: 12, backgroundColor: '#1E3A5F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    totalLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    totalValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
});