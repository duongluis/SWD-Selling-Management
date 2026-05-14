import BgWatermark from '@/components/Main/BgWatermark';
import { showAlert } from '@/components/Main/showAlert';
import auth from '@/config/firebaseConfig';
import Colors from '@/constant/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator, Platform, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';

const isWeb = Platform.OS === 'web';

function PwField({ label, value, onChange, show, toggleShow, placeholder }) {
    return (
        <View style={S.formGroup}>
            <Text style={S.label}>{label}</Text>
            <View style={S.inputWrap}>
                <TextInput
                    style={S.input}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={!show}
                    placeholderTextColor={Colors.LightGray}
                    placeholder={placeholder}
                    autoCapitalize="none"
                />
                <TouchableOpacity onPress={toggleShow} style={S.eyeBtn}>
                    <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function ChangePassword() {
    const [current, setCurrent] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showC, setShowC] = useState(false);
    const [showN, setShowN] = useState(false);
    const [showCf, setShowCf] = useState(false);

    const handleChange = async () => {
        if (!current || !newPw || !confirm) {
            showAlert('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường');
            return;
        }
        if (newPw.length < 6) {
            showAlert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (newPw !== confirm) {
            showAlert('Không khớp', 'Mật khẩu mới và xác nhận không khớp');
            return;
        }
        setLoading(true);
        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, current);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPw);
            showAlert('Thành công', 'Mật khẩu đã được cập nhật thành công');
            router.back();
        } catch (e) {
            const isWrongPw = e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential';
            showAlert('Lỗi', isWrongPw ? 'Mật khẩu hiện tại không đúng' : e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={S.root}>
            <BgWatermark />
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back-circle-outline" size={28} color={Colors.TextPrimary} />
            </TouchableOpacity>

            <View style={S.icon}>
                <View style={S.iconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={36} color="#2563EB" />
                </View>
            </View>
            <Text style={S.title}>Đổi mật khẩu</Text>
            <Text style={S.subtitle}>Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật</Text>

            <View style={S.card}>
                <PwField label="Mật khẩu hiện tại" value={current} onChange={setCurrent}
                    show={showC} toggleShow={() => setShowC(p => !p)} placeholder="••••••••" />
                <PwField label="Mật khẩu mới" value={newPw} onChange={setNewPw}
                    show={showN} toggleShow={() => setShowN(p => !p)} placeholder="Tối thiểu 6 ký tự" />
                <PwField label="Xác nhận mật khẩu mới" value={confirm} onChange={setConfirm}
                    show={showCf} toggleShow={() => setShowCf(p => !p)} placeholder="Nhập lại mật khẩu mới" />

                <TouchableOpacity style={[S.btn, loading && { opacity: 0.7 }]} onPress={handleChange} disabled={loading}>
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={S.btnText}>Cập nhật mật khẩu</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/auth/resetPassword')} style={{ marginTop: 14, alignItems: 'center' }}>
                    <Text style={S.link}>Quên mật khẩu hiện tại?</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center' },
    backBtn: { position: 'absolute', top: isWeb ? 20 : 50, left: 20, zIndex: 10 },
    icon: { alignItems: 'center', marginBottom: 12 },
    iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#BFDBFE' },
    title: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 28, paddingHorizontal: 32 },
    card: { width: 360, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 },
    formGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 7 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#F8FAFC' },
    input: { flex: 1, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
    eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
    btn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    link: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
});
