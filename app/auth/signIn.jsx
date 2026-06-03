import BgWatermark from "@/components/Main/BgWatermark";
import { getFirebaseErrorMessage } from "@/components/Main/getFirebaseErrorMessage";
import { showAlert } from "@/components/Main/showAlert";
import auth, { db } from "@/config/firebaseConfig";
import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword, signOut } from "@firebase/auth";
import bcrypt from 'bcryptjs';
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useContext, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function SignIn() {
  const [showIcon, setShowIcon] = useState(false);
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUserDetail } = useContext(UserDetailContext);

  const checkAndEnter = (userData) => {
    if (userData?.locked) {
      showAlert('Tài khoản bị khóa', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
      return false;
    }
    setUserDetail(userData);
    router.replace("../(tabs)/home");
    return true;
  };

  const signInByClick = async () => {
    const normalizedGmail = gmail.trim().toLowerCase(); // ← thêm dòng này
    console.log("Đang đăng nhập với:", gmail);
    try {
      const res = await signInWithEmailAndPassword(auth, normalizedGmail, password);
      console.log("Auth thành công:", res.user.uid);

      const result = await getDoc(doc(db, "users", normalizedGmail));
      console.log("Firestore exists:", result.exists());
      console.log("userData:", result.data());
      const userData = result.data();
      if (userData?.locked) {
        await signOut(auth);
      }
      checkAndEnter(userData);

    } catch (firebaseError) {
      // Fallback: kiểm tra tài khoản/mật khẩu trực tiếp từ Firestore
      try {
        const result = await getDoc(doc(db, "users", gmail));
        if (!result.exists()) throw firebaseError;
        const userData = result.data();
        if (!userData.passwordHash) throw firebaseError;
        const match = await bcrypt.compare(password, userData.passwordHash);
        if (!match) throw firebaseError;
        checkAndEnter(userData);
      } catch {
        showAlert(getFirebaseErrorMessage(firebaseError));
        console.log(firebaseError);
      }
    }
  };

  return (
    <View style={styles.container}>
      <BgWatermark />
      <Text style={styles.title}>Đăng nhập</Text>
      <Text style={styles.subtitle}>
        Vui lòng đăng nhập để truy cập tài khoản doanh nghiệp
      </Text>

      {/* Email */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Gmail / Tên đăng nhập</Text>
        <View style={styles.box}>
          <Ionicons
            name="person-outline"
            size={15}
            color={Colors.LightGray}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Nhập gmail hoặc tên đăng nhập"
            placeholderTextColor={Colors.LightGray}
            value={gmail}
            onChangeText={setGmail}
          />
        </View>
      </View>

      {/* Password */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Mật khẩu</Text>
        <View style={styles.box}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={Colors.LightGray}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Nhập mật khẩu"
            placeholderTextColor={Colors.LightGray}
            secureTextEntry={!showIcon}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowIcon(!showIcon)}>
            <Ionicons
              name={showIcon ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={Colors.LightGray}
              style={styles.eyeIcon}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={() => router.push("/auth/resetPassword")}
        >
          <Text style={styles.link}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.loginButton} onPress={signInByClick}>
        <Text style={styles.loginButtonText}>Đăng nhập</Text>
      </TouchableOpacity>

      {/* <Text style={styles.or}>─────── Tiếp tục với ───────</Text>
      <View style={styles.socialButtons}>
        <TouchableOpacity style={styles.social}><Text>Google</Text></TouchableOpacity>
        <TouchableOpacity style={styles.social}><Text>iOS</Text></TouchableOpacity>
      </View> */}

      <Text style={styles.signup}>
        Bạn chưa có tài khoản?{" "}
        <Text style={styles.link} onPress={() => router.push("/auth/signUp")}>
          Đăng ký ngay
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
  formGroup: { marginBottom: 15, alignSelf: "stretch" },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.TextPrimary,
    marginBottom: 6,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  inputIcon: { margin: 8 },
  eyeIcon: { marginRight: 8, marginVertical: 10 },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.TextPrimary,
  },
  forgotBtn: { alignSelf: "flex-end", marginTop: 6 },
  link: { fontSize: 12, color: Colors.Blue },
  loginButton: {
    width: "100%",
    padding: 14,
    backgroundColor: Colors.Primary,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  loginButtonText: { color: Colors.White, fontWeight: "700", fontSize: 15 },
  or: { marginVertical: 20, fontSize: 12, color: Colors.Gray },
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
  signup: { fontSize: 12, color: Colors.TextSecondary, padding: 25 },
});
