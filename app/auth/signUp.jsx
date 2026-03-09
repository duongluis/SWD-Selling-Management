import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function SignUp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.subtitle}>
        Gia nhập vào cộng đồng của chúng tôi ngay hôm nay.
      </Text>

      <View style={styles.formGroup}>
        <Text>Tên đăng nhập</Text>
        <TextInput
          placeholder="Vui lòng nhập họ tên"
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Địa chỉ gmail</Text>
        <TextInput
          placeholder="name@company.com"
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Mật khẩu</Text>
        <TextInput
          placeholder="Tạo mật khẩu"
          secureTextEntry
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Xác nhận mật khẩu</Text>
        <TextInput
          placeholder="Xác nhận lại mật khẩu"
          secureTextEntry
          style={styles.input}
        />
      </View>

      <View style={styles.checkbox}>
        <TouchableOpacity>
          <Text style={styles.link}>
            Tôi đồng ý với Điều khoản và Chính sách bảo mật
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signUpButton}>
        <Text style={{ color: "#fff" }}>Đăng ký</Text>
      </TouchableOpacity>

      <Text style={styles.or}>Hoặc tiếp tục đăng ký với</Text>
      <View style={styles.socialButtons}>
        <TouchableOpacity
          onPress={() => {
            console.log("Sign In with Google");
          }}
          style={styles.social}
        >
          <Text>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.social}>
          <Text>iOS</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.login}>
        Bạn đã có tài khoản? <Text style={styles.link}>Đăng nhập</Text>
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
    borderColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
  },
  title: {
    marginBottom: 10,
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 20,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 15,
    alignSelf: "stretch",
  },
  input: {
    width: "100%",
    padding: 10,
    marginTop: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  checkbox: {
    marginBottom: 15,
    alignSelf: "flex-start",
  },
  signUpButton: {
    width: "100%",
    padding: 10,
    backgroundColor: "#007bff",
    borderRadius: 4,
    alignItems: "center",
    marginTop: 10,
  },
  or: {
    marginVertical: 20,
    fontSize: 12,
    color: "#888",
  },
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
    borderColor: "#ccc",
    borderRadius: 4,
    alignItems: "center",
  },
  login: {
    fontSize: 12,
    color: "#555",
  },
  link: {
    color: "#007bff",
    fontSize: 12,
  },
});
