import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../Main/showAlert';

// Ngày lưu dạng 'YYYY-MM-DD' theo giờ máy — so sánh chuỗi được luôn vì cùng định dạng.
export const toDateStr = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};
export const todayStr = () => toDateStr(new Date());
export const toDisplayStr = (s) => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fromDateStr = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

const BOX = { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 };

/**
 * Ô chọn ngày dùng chung. `minDate`/`maxDate` dạng 'YYYY-MM-DD' (bỏ trống = không giới hạn).
 * Web dùng <input type="date">, native dùng DateTimePicker.
 */
export default function DateField({ value, onChange, minDate, maxDate, placeholder = 'Chọn ngày...', boxStyle }) {
    const [show, setShow] = useState(false);

    const pick = (str) => {
        if (minDate && str < minDate) { showAlert('Ngày không hợp lệ', `Không thể chọn ngày trước ${toDisplayStr(minDate)}`); return; }
        if (maxDate && str > maxDate) { showAlert('Ngày không hợp lệ', `Không thể chọn ngày sau ${toDisplayStr(maxDate)}`); return; }
        onChange(str);
    };

    if (Platform.OS === 'web') {
        return (
            <View style={boxStyle || BOX}>
                {/* lang="sv-SE" ép thứ tự nhập yyyy/mm/dd (năm trước) thay vì dd/mm/yyyy theo locale máy,
                    tránh báo sai ngày khi năm mới gõ được 1-2 chữ số */}
                <input
                    type="date"
                    lang="sv-SE"
                    value={value ? value.slice(0, 10) : ''}
                    min={minDate}
                    max={maxDate}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', fontWeight: '500', cursor: 'pointer', width: '100%' }}
                    onChange={e => { if (e.target.value) pick(e.target.value); }}
                />
                <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
            </View>
        );
    }

    const sel = value ? fromDateStr(value) : new Date();
    const onNative = (_, date) => {
        if (Platform.OS === 'android') setShow(false);
        if (date) pick(toDateStr(date));
    };
    const pickerProps = {
        value: sel,
        mode: 'date',
        onChange: onNative,
        minimumDate: minDate ? fromDateStr(minDate) : undefined,
        maximumDate: maxDate ? fromDateStr(maxDate) : undefined,
    };

    return (
        <>
            <TouchableOpacity style={boxStyle || BOX} onPress={() => setShow(true)} activeOpacity={0.8}>
                <Text style={{ flex: 1, fontSize: 14, color: value ? '#0F172A' : '#B0B0C8' }}>
                    {value ? toDisplayStr(value) : placeholder}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#B0B0C8" />
            </TouchableOpacity>
            {show && Platform.OS === 'ios' && (
                <Modal transparent animationType="slide">
                    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShow(false)} />
                    <View style={{ backgroundColor: '#fff', padding: 16 }}>
                        <DateTimePicker {...pickerProps} display="spinner" />
                        <Pressable onPress={() => setShow(false)} style={{ alignItems: 'center', padding: 12 }}>
                            <Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text>
                        </Pressable>
                    </View>
                </Modal>
            )}
            {show && Platform.OS === 'android' && <DateTimePicker {...pickerProps} display="default" />}
        </>
    );
}
