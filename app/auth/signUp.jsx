import BgWatermark from '@/components/Main/BgWatermark';
import { useLayout } from '@/components/Main/TabScreenLayout';
import Colors from '@/constant/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert, Linking, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';

// ✅ Màn này CHỈ validate email + password
// Firebase Auth được tạo ở cuối bước userInfo (sau khi điền đủ thông tin)

export default function SignUp() {
  const router = useRouter();
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showRePass, setShowRePass] = useState(false);

  const { isDesktop } = useLayout();
  const validate = () => {
    if (!gmail.trim()) { Alert.alert('Thông báo', 'Vui lòng nhập email'); return false; }
    if (!password) { Alert.alert('Thông báo', 'Vui lòng nhập mật khẩu'); return false; }
    if (password.length < 6) { Alert.alert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự'); return false; }
    if (password !== rePassword) { Alert.alert('Thông báo', 'Mật khẩu xác nhận không khớp'); return false; }
    if (!agree) { Alert.alert('Thông báo', 'Vui lòng đồng ý với điều khoản'); return false; }
    return true;
  };

  const handleSignUp = () => {
    if (!validate()) return;
    // ✅ Không tạo Firebase Auth ở đây
    // Chỉ truyền email + password sang userInfo làm params
    // Firebase Auth + DB sẽ được tạo sau khi user điền đủ thông tin
    router.push({
      pathname: '/auth/userInfo',
      params: { email: gmail.trim(), password },
    });
  };

  return (
    <View style={styles.container}>
      <BgWatermark />
      {/* Logo */}
      <View style={styles.logoWrap}>
        <Ionicons name="storefront" size={28} color="#2563EB" />
      </View>

      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.subtitle}>Nhập email và mật khẩu để bắt đầu</Text>

      {/* Email */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Địa chỉ email</Text>
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={16} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="name@company.com"
            placeholderTextColor={Colors.LightGray}
            value={gmail}
            onChangeText={setGmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Password */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Mật khẩu</Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Tối thiểu 6 ký tự"
            placeholderTextColor={Colors.LightGray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Re-password */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Xác nhận mật khẩu</Text>
        <View style={[
          styles.inputRow,
          rePassword.length > 0 && { borderColor: rePassword === password ? '#10B981' : '#EF4444' },
        ]}>
          <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nhập lại mật khẩu"
            placeholderTextColor={Colors.LightGray}
            value={rePassword}
            onChangeText={setRePassword}
            secureTextEntry={!showRePass}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowRePass(p => !p)} style={styles.eyeBtn}>
            <Ionicons name={showRePass ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94A3B8" />
          </TouchableOpacity>
          {rePassword.length > 0 && (
            <Ionicons
              name={rePassword === password ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={rePassword === password ? '#10B981' : '#EF4444'}
            />
          )}
        </View>
      </View>

      {/* Agree */}
      <View style={styles.agreeRow}>
        <TouchableOpacity onPress={() => setAgree(p => !p)} style={styles.checkbox}>
          <Ionicons
            name={agree ? 'checkbox' : 'square-outline'}
            size={20}
            color={agree ? '#2563EB' : '#94A3B8'}
          />
        </TouchableOpacity>
        <Text style={styles.agreeText}>Tôi đồng ý với </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan')}>
          <Text style={styles.link}>Điều khoản</Text>
        </TouchableOpacity>
        <Text style={styles.agreeText}> và </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan')}>
          <Text style={styles.link}>Chính sách</Text>
        </TouchableOpacity>
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[styles.signUpButton, (loading || !agree) && { opacity: 0.65 }]}
        onPress={handleSignUp}
        disabled={loading || !agree}
        activeOpacity={0.85}
      >
        {loading
          ? <Text style={styles.signUpText}>Đang tạo tài khoản...</Text>
          : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" />
              <Text style={styles.signUpText}>Tiếp tục</Text>
            </View>
          )
        }
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>hoặc</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Login redirect */}
      <TouchableOpacity onPress={() => router.push('/auth/signIn')}>
        <Text style={styles.loginText}>
          Đã có tài khoản? <Text style={styles.link}>Đăng nhập</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Math.min(380, Platform.OS === 'web' ? 400 : 9999),
    alignSelf: 'center',
    marginTop: Platform.OS === 'web' ? 60 : 40,
    padding: 28,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: Colors.Border,
    borderRadius: 16,
    backgroundColor: Colors.White,
  },
  logoWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20, alignSelf: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.TextPrimary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.TextSecondary, textAlign: 'center', marginBottom: 24 },
  formGroup: { marginBottom: 14, alignSelf: 'stretch' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.TextPrimary, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.Border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  inputIcon: { marginRight: 6 },
  input: { flex: 1, fontSize: 14, color: Colors.TextPrimary },
  eyeBtn: { padding: 2, marginLeft: 4 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 20, alignSelf: 'stretch', gap: 2 },
  checkbox: { marginRight: 4 },
  agreeText: { fontSize: 12, color: Colors.TextSecondary },
  link: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  signUpButton: { alignSelf: 'stretch', padding: 14, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  signUpText: { color: Colors.White, fontWeight: '700', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, alignSelf: 'stretch' },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.Border },
  dividerText: { fontSize: 12, color: Colors.TextSecondary },
  loginText: { fontSize: 13, color: Colors.TextSecondary, textAlign: 'center' },
});