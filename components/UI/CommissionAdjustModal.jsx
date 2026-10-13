// components/UI/CommissionAdjustModal.jsx
// Form điều chỉnh hoa hồng trực tiếp: tăng/giảm, số tiền, lý do.

import { showAlert } from '@/components/Main/showAlert';
import { adjustDeadline } from '@/components/Utils/commissionCalc';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const fmt = n => (n || 0).toLocaleString('vi-VN') + ' đ';
const digits = v => String(v || '').replace(/\D/g, '');

const DIRECTIONS = [
    { key: 'increase', label: 'Tăng', icon: 'arrow-up-circle-outline', c: '#16A34A', bg: '#DCFCE7' },
    { key: 'decrease', label: 'Giảm', icon: 'arrow-down-circle-outline', c: '#DC2626', bg: '#FEF2F2' },
];

/**
 * @param record    - bản ghi hoa hồng đang điều chỉnh (null = đóng)
 * @param onConfirm - async ({ direction, amount, reason }) => void; ném lỗi nếu thất bại
 */
export default function CommissionAdjustModal({ record, onClose, onConfirm }) {
    const [direction, setDirection] = useState('increase');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (record) { setDirection('increase'); setAmount(''); setReason(''); setSubmitting(false); }
    }, [record]);

    if (!record) return null;

    const current = Math.round(record.commission || 0);
    const delta = parseInt(amount, 10) || 0;
    const after = current + (direction === 'decrease' ? -delta : delta);
    // Ngày cuối còn điều chỉnh được = 1 ngày trước hạn khóa
    const lastDay = new Date(adjustDeadline(record.paidAt).getTime() - 1)
        .toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const handleClose = () => { if (!submitting) onClose(); };

    const handleSubmit = async () => {
        if (delta <= 0) { showAlert('Thông báo', 'Vui lòng nhập số tiền điều chỉnh'); return; }
        if (!reason.trim()) { showAlert('Thông báo', 'Vui lòng nhập lý do điều chỉnh'); return; }
        setSubmitting(true);
        try {
            await onConfirm({ direction, amount: delta, reason: reason.trim() });
        } catch (e) {
            showAlert('Lỗi', e.message);
            setSubmitting(false);
        }
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
            <View style={S.overlay}>
                <View style={S.box}>
                    <View style={S.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={S.title}>Điều chỉnh hoa hồng</Text>
                            <Text style={S.sub}>Đơn #{record.id} · {record.sellerEmail || '—'}</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={S.summary}>
                        <Text style={S.summaryLabel}>Hoa hồng hiện tại</Text>
                        <Text style={S.summaryValue}>{fmt(current)}</Text>
                    </View>

                    <Text style={S.label}>Loại điều chỉnh</Text>
                    <View style={S.dirRow}>
                        {DIRECTIONS.map(d => {
                            const active = direction === d.key;
                            return (
                                <TouchableOpacity
                                    key={d.key}
                                    style={[S.dirBtn, active && { backgroundColor: d.bg, borderColor: d.c }]}
                                    onPress={() => setDirection(d.key)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={d.icon} size={16} color={active ? d.c : '#94A3B8'} />
                                    <Text style={[S.dirText, active && { color: d.c }]}>{d.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={S.label}>Số tiền</Text>
                    <TextInput
                        style={S.input}
                        value={amount ? parseInt(amount, 10).toLocaleString('vi-VN') : ''}
                        onChangeText={v => setAmount(digits(v))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                    />

                    <Text style={S.label}>Lý do điều chỉnh</Text>
                    <TextInput
                        style={[S.input, S.textarea]}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Nhập lý do..."
                        placeholderTextColor="#94A3B8"
                        multiline
                    />

                    <View style={S.summary}>
                        <Text style={S.summaryLabel}>Hoa hồng sau điều chỉnh</Text>
                        <Text style={[S.summaryValue, { color: after < 0 ? '#DC2626' : '#2563EB' }]}>{fmt(after)}</Text>
                    </View>
                    <Text style={S.hint}>Được điều chỉnh đến hết ngày {lastDay}.</Text>

                    <TouchableOpacity style={[S.submit, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
                        {submitting
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={S.submitText}>Xác nhận điều chỉnh</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const S = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    summaryValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    label: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
    dirRow: { flexDirection: 'row', gap: 8 },
    dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    dirText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', marginBottom: 0 },
    textarea: { minHeight: 72, textAlignVertical: 'top', marginBottom: 14 },
    hint: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
    submit: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
    submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
