import { getFirebaseErrorMessage } from "@/components/Main/getFirebaseErrorMessage";
import Colors from "@/constant/Colors";
import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "@firebase/auth";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import auth, { db } from "../../config/firebaseConfig";

export default function SignUp() {
  const [agree, setAgree] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gmail, setGmail] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [member] = useState("nhan vien");
  const router = useRouter();

  const CreateAccount = async () => {
    if (!CheckPassword()) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin người dùng");
      return;
    }
    try {
      const resp = await createUserWithEmailAndPassword(auth, gmail, password);
      await SaveUser(resp.user);
      router.push("/auth/signIn");
    } catch (e) {
      Alert.alert(getFirebaseErrorMessage(e));
      console.log(e);
    }
  };

  const SaveUser = async (user) => {
    const data = {
      uid: user.uid,
      name: username,
      email: gmail,
      point: 0,
      member,
      customer: [],
    };
    await setDoc(doc(db, "users", gmail), data);
  };

  const CheckPassword = () => {
    if (!agree || !password || !rePassword || !username || !gmail) return false;
    return password === rePassword;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.subtitle}>
        Để gia nhập vào cộng đồng của chúng tôi
      </Text>

      {[
        {
          label: "Tên đăng nhập",
          placeholder: "Vui lòng nhập họ tên",
          value: username,
          set: setUsername,
          keyboard: "default",
        },
        {
          label: "Địa chỉ gmail",
          placeholder: "name@company.com",
          value: gmail,
          set: setGmail,
          keyboard: "email-address",
        },
        {
          label: "Mật khẩu",
          placeholder: "Tạo mật khẩu",
          value: password,
          set: setPassword,
          secure: true,
        },
        {
          label: "Xác nhận mật khẩu",
          placeholder: "Xác nhận lại mật khẩu",
          value: rePassword,
          set: setRePassword,
          secure: true,
        },
      ].map((f) => (
        <View style={styles.formGroup} key={f.label}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            placeholder={f.placeholder}
            style={styles.input}
            value={f.value}
            onChangeText={f.set}
            placeholderTextColor={Colors.LightGray}
            keyboardType={f.keyboard || "default"}
            secureTextEntry={!!f.secure}
            autoCapitalize="none"
          />
        </View>
      ))}

      {/* Checkbox */}
      <View style={styles.agreeRow}>
        <TouchableOpacity onPress={() => setAgree(!agree)}>
          <Ionicons
            name={agree ? "checkbox-outline" : "square-outline"}
            size={20}
            color={Colors.Primary}
          />
        </TouchableOpacity>
        <Text style={styles.agreeText}> Bạn đồng ý với </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan",
            )
          }
        >
          <Text style={styles.link}>Điều khoản</Text>
        </TouchableOpacity>
        <Text style={styles.agreeText}> và </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan",
            )
          }
        >
          <Text style={styles.link}>Chính sách</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signUpButton} onPress={CreateAccount}>
        <Text style={styles.signUpText}>Đăng ký</Text>
      </TouchableOpacity>

      <Text style={styles.or}>─── Hoặc tiếp tục đăng ký với ───</Text>
      <View style={styles.socialButtons}>
        <TouchableOpacity style={styles.social}>
          <Text>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.social}>
          <Text>iOS</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.loginText}>
        Bạn đã có tài khoản?{" "}
        <Text style={styles.link} onPress={() => router.push("/auth/signIn")}>
          Đăng nhập
        </Text>
      </Text>
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
    alignItems: "center",
    backgroundColor: Colors.White,
  },
  title: {
    marginBottom: 10,
    fontSize: 22,
    fontWeight: "800",
    color: Colors.TextPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.TextSecondary,
    marginBottom: 20,
    textAlign: "center",
  },
  formGroup: { marginBottom: 14, alignSelf: "stretch" },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.TextPrimary,
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: 12,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.Border,
    fontSize: 14,
    color: Colors.TextPrimary,
  },
  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
    alignSelf: "stretch",
  },
  agreeText: { fontSize: 12, color: Colors.TextSecondary },
  link: { fontSize: 12, color: Colors.Blue },
  signUpButton: {
    width: "100%",
    padding: 14,
    backgroundColor: Colors.Primary,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  signUpText: { color: Colors.White, fontWeight: "700", fontSize: 15 },
  or: { marginVertical: 16, fontSize: 12, color: Colors.Gray },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    width: "100%",
  },
  social: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: 8,
    alignItems: "center",
  },
  loginText: { fontSize: 12, color: Colors.TextSecondary },
});
