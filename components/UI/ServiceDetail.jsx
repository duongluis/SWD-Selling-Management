// components/UI/ServiceDetail.jsx — style giống order panel

import { showAlert } from '@/components/Main/showAlert';
import { fmtCurrency, fmtDate, fmtPhone } from '@/components/Utils/formatters';
import { getRole } from '@/components/Utils/roleHelper';
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

const PARSE = v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
const isWeb = Platform.OS === 'web';
const STATUS_CFG = {
    'Chờ xử lý': { c: '#D97706', bg: '#FFFBEB' },
    'Đang xử lý': { c: '#2563EB', bg: '#EFF6FF' },
    'Hoàn thành': { c: '#16A34A', bg: '#DCFCE7' },
    'Đã hủy': { c: '#DC2626', bg: '#FEF2F2' },
};
const scfg = s => STATUS_CFG[s] || { c: '#64748B', bg: '#F1F5F9' };

const TYPE_LABEL = {
    INSTALLATION: 'Lắp đặt',
    DELIVERY: 'Giao hàng',
    MAINTENANCE: 'Bảo dưỡng',
};

const STATUS_OPTIONS = ['Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Đã hủy'];

function InfoRow({ icon, label, value }) {
    if (!value) return null;
    return (
        <View style={S.infoRow}>
            <View style={S.infoIconWrap}><Ionicons name={icon} size={13} color="#94A3B8" /></View>
            <Text style={S.infoLabel}>{label}</Text>
            <Text style={S.infoValue}>{value}</Text>
        </View>
    );
}

export default function ServiceDetail({ service, onClose, onUpdated }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const admin = role === 'admin';

    const [local, setLocal] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => { if (service) setLocal(service); }, [service]);
    if (!service || !local) return null;

    const typLabel = TYPE_LABEL[local.type] || 'Dịch vụ';
    const statusCfg = scfg(local.status);
    const items = local.orderItems || local.items || [];
    const total = items.reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);

    const handleStatusChange = async (newStatus) => {
        if (!admin || !local.docId) return;
        showAlert('Cập nhật', `Chuyển sang "${newStatus}"?`, async () => {
            setUpdating(true);
            try {
                await updateDoc(doc(db, 'service', local.docId), { status: newStatus });
                const next = { ...local, status: newStatus };
                setLocal(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setUpdating(false); }
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
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={S.title}>{typLabel} · {local.id || local.docId?.slice(-6)}</Text>
                            <View style={[S.statusPill, { backgroundColor: statusCfg.bg }]}>
                                <View style={[S.statusDot, { backgroundColor: statusCfg.c }]} />
                                <Text style={[S.statusText, { color: statusCfg.c }]}>{local.status || 'Chờ xử lý'}</Text>
                            </View>
                        </View>
                        <Text style={S.subtitle}>{local.customer}</Text>
                    </View>
                </View>
                {/* Actions */}
                <View style={S.actions}>
                    {admin && (
                        <TouchableOpacity style={S.aBtn}
                            onPress={() => router.push({ pathname: '/editService/[serviceID]', params: { serviceID: local.docId, serviceParam: JSON.stringify(local) } })}>
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={S.aBtnText}>Chỉnh sửa</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Thông tin dịch vụ */}
                <View style={S.section}>
                    <Text style={S.sectionTitle}>Thông tin dịch vụ</Text>
                    <InfoRow icon="build-outline" label="Loại" value={typLabel} />
                    <InfoRow icon="person-outline" label="Khách hàng" value={local.customer} />
                    <InfoRow icon="call-outline" label="Điện thoại" value={fmtPhone(local.phone)} />
                    <InfoRow icon="location-outline" label="Địa chỉ" value={local.address} />
                    <InfoRow icon="receipt-outline" label="Đơn hàng" value={local.orderId} />
                    <InfoRow icon="calendar-outline" label="Ngày tạo" value={fmtDate(local.createdAt)} />
                    {local.note && <InfoRow icon="document-text-outline" label="Ghi chú" value={local.note} />}
                </View>

                {/* Sản phẩm */}
                {items.length > 0 && (
                    <View style={S.section}>
                        <Text style={S.sectionTitle}>Sản phẩm</Text>
                        {/* Table header */}
                        <View style={S.tableHead}>
                            <Text style={[S.th, { flex: 2 }]}>Sản phẩm</Text>
                            <Text style={[S.th, { width: 36, textAlign: 'center' }]}>SL</Text>
                            <Text style={[S.th, { width: 90, textAlign: 'right' }]}>Đơn giá</Text>
                            <Text style={[S.th, { width: 90, textAlign: 'right' }]}>Thành tiền</Text>
                        </View>
                        {items.map((p, i) => (
                            <View key={i} style={[S.tableRow, i % 2 === 1 && { backgroundColor: '#FAFBFF' }]}>
                                <Text style={[S.td, { flex: 2 }]}>{p.name}</Text>
                                <Text style={[S.td, { width: 36, textAlign: 'center' }]}>{p.qty || 1}</Text>
                                <Text style={[S.td, { width: 90, textAlign: 'right' }]}>{(PARSE(p.price)).toLocaleString('vi-VN')}đ</Text>
                                <Text style={[S.td, { width: 90, textAlign: 'right', fontWeight: '700' }]}>{(PARSE(p.price) * PARSE(p.qty || 1)).toLocaleString('vi-VN')}đ</Text>
                            </View>
                        ))}
                        {/* Total */}
                        <View style={S.tableFoot}>
                            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Tổng cộng</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#2563EB' }}>{fmtCurrency(total)}</Text>
                        </View>
                    </View>
                )}

                {/* Cập nhật trạng thái */}
                {admin && (
                    <View style={S.section}>
                        <Text style={S.sectionTitle}>Cập nhật trạng thái</Text>
                        <View style={S.statusBtns}>
                            {STATUS_OPTIONS.map(st => {
                                const cfg = scfg(st);
                                const active = local.status === st;
                                return (
                                    <TouchableOpacity key={st}
                                        style={[S.statusBtn, { backgroundColor: active ? cfg.c : cfg.bg, borderColor: cfg.c + '40' }, active && { borderColor: cfg.c }]}
                                        onPress={() => handleStatusChange(st)}
                                        disabled={updating || active}
                                    >
                                        <Text style={[S.statusBtnText, { color: active ? '#fff' : cfg.c }]}>{st}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
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
    title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 5, height: 5, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8 },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.07, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 80, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
    tableHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
    th: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
    td: { fontSize: 12, color: '#0F172A' },
    tableFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 8, marginTop: 4 },
    statusBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    statusBtnText: { fontSize: 12, fontWeight: '700' },
});