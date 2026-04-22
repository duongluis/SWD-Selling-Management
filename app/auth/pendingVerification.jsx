import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../../components/Main/showAlert';
import auth from '../../config/firebaseConfig';

export default function PendingVerification() {
    const router = useRouter();

    const handleLogout = () => {
        showAlert(
            'Đăng xuất',
            'Bạn có chắc muốn đăng xuất?',
            async () => {
                await signOut(auth);
                router.replace('/auth/signIn');
            }
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Icon */}
                <View style={styles.iconWrap}>
                    <Ionicons name="time-outline" size={52} color="#F59E0B" />
                </View>

                {/* Text */}
                <Text style={styles.title}>Chờ xác thực tài khoản</Text>
                <Text style={styles.sub}>
                    Tài khoản của bạn đã được tạo thành công.{'\n'}
                    Vui lòng chờ admin xét duyệt trước khi sử dụng.
                </Text>

                {/* Info banner */}
                <View style={styles.banner}>
                    <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
                    <Text style={styles.bannerText}>
                        Sau khi được xác thực, hãy đăng nhập lại để vào ứng dụng.
                    </Text>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                    <Ionicons name="log-out-outline" size={18} color="#64748B" />
                    <Text style={styles.logoutText}>Đăng xuất</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', maxWidth: 420, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
    iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#FDE68A' },
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 },
    sub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 28, width: '100%' },
    bannerText: { flex: 1, fontSize: 13, color: '#2563EB', lineHeight: 18 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    logoutText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
});