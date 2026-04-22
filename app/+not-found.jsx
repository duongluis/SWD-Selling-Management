import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotFoundScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.iconWrap}>
                <Ionicons name="warning-outline" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.code}>404</Text>
            <Text style={styles.title}>Trang không tồn tại</Text>
            <Text style={styles.sub}>Đường dẫn bạn truy cập không hợp lệ hoặc đã bị xoá.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/home')}>
                <Ionicons name="home-outline" size={16} color="#fff" />
                <Text style={styles.btnText}>Về trang chủ</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    code: { fontSize: 64, fontWeight: '900', color: '#E2E8F0', letterSpacing: -2, marginBottom: 4 },
    title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    sub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});