import BgWatermark from "@/components/Main/BgWatermark";
import Colors from "@/constant/Colors";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "@firebase/auth";
import { router } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import auth from "../../config/firebaseConfig";
import { showAlert } from "@/components/Main/showAlert";
import { showSuccess } from "@/components/Main/showSuccess";

export default function ResetPassword() {
  const [gmail, setGmail] = useState("");

  const sendResetLink = async () => {
    if (!gmail.trim()) {
      showAlert('Thông báo', 'Vui lòng nhập địa chỉ email');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, gmail.trim().toLowerCase());
      showSuccess(
        'Đã gửi',
        'Vui lòng kiểm tra hộp thư email để lấy link đặt lại mật khẩu.',
        () => router.replace('/auth/signIn')
      );
    } catch (e) {
      console.log(e);
      const msg =
        e.code === 'auth/user-not-found' ? 'Email chưa được đăng ký' :
          e.code === 'auth/invalid-email' ? 'Email không hợp lệ' :
            e.message;
      showAlert('Lỗi', msg);
    }
  };

  return (
    <View style={styles.container}>
      <BgWatermark />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons
          name="chevron-back-circle-outline"
          size={28}
          color={Colors.TextPrimary}
        />
      </TouchableOpacity>

      <View style={styles.icon}>
        <Ionicons name="lock-closed-outline" size={44} color={Colors.Blue} />
      </View>

      <Text style={styles.title}>Quên mật khẩu</Text>
      <Text style={styles.subtitle}>
        Nhập địa chỉ email để chúng tôi gửi link đặt lại mật khẩu
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Địa chỉ Email</Text>
        <TextInput
          placeholder="name@company.com"
          placeholderTextColor={Colors.LightGray}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          value={gmail}
          onChangeText={setGmail}
        />
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={sendResetLink}>
        <Text style={styles.resetButtonText}>Gửi email khôi phục</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/auth/signIn")}>
        <Text style={styles.link}>Quay lại đăng nhập</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 350,
    marginTop: 50,
    alignSelf: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: 12,
    backgroundColor: Colors.White,
  },
  backButton: { marginBottom: 10 },
  icon: { alignItems: "center", marginBottom: 16 },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: Colors.TextPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.TextSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  formGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.TextPrimary,
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.Border,
    fontSize: 14,
    color: Colors.TextPrimary,
  },
  resetButton: {
    width: "100%",
    padding: 14,
    backgroundColor: Colors.Primary,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  resetButtonText: { color: Colors.White, fontWeight: "700", fontSize: 15 },
  link: { textAlign: "center", fontSize: 13, color: Colors.Blue, marginTop: 8 },
});
