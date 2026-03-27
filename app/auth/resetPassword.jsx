import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "@firebase/auth";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import auth from "../../config/firebaseConfig";
import Colors from "../../constant/Colors";

export default function ResetPassword() {

  const [gmail, setGmail] = useState("")
  const sendResetLink = async () => {
    sendPasswordResetEmail(auth, gmail)
    .then( ()=>{
      Alert.alert("Vui lòng kiểm tra gmail để lấy mã. ")
  })
    .catch((e) => {
      console.log(e)
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          router.back();
        }}>
          <Ionicons name="chevron-back-circle-outline" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.icon}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.Blue} />
      </View>

      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Nhập địa chỉ email để chúng tôi gửi cho bạn thư xác nhận đặt lại mật khẩu
      </Text>

      <View style={styles.formGroup}>
        <Text>Email Address</Text>
        <TextInput
          placeholder="name@company.com"
          style={styles.input}
          keyboardType="email-address"
          value={gmail}
          onChangeText={(value) => setGmail(value)}
        />
      </View>

      <TouchableOpacity style={styles.resetButton}>
        <Text style={{ color: "#fff" }}>Send Reset Link</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => {
        router.push('/auth/signIn')
      }}>
        <Text style={styles.link}>Back to Login</Text>
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
    borderColor: "#ddd",
    borderRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  backButton: {
    padding: 5,
  },
  icon: {
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 15,
  },
  input: {
    width: "100%",
    padding: 10,
    marginTop: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  resetButton: {
    width: "100%",
    padding: 10,
    backgroundColor: "#007bff",
    borderRadius: 4,
    alignItems: "center",
    marginTop: 10,
  },
  link: {
    marginTop: 20,
    fontSize: 12,
    color: "#007bff",
    textAlign: "center",
  },
});
