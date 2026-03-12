import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Colors from "../../constant/Colors";

export default function SignUp() {
  const [agree, setAgree] = useState(false)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [gmail, setGmail] = useState('')
  const [rePassword, setRePassword] = useState('')

  function checkPassword() {
    if (!agree || password == '' || rePassword == '' || username == '' || gmail == '')
      console.log("denied");
    else {
      if (password == rePassword) {
        console.log("accept");
        router.push('/auth/signIn');
      } else {
        console.log("reject");
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.subtitle}>
        Để gia nhập vào cộng đồng của chúng tôi
      </Text>

      <View style={styles.formGroup}>
        <Text>Tên đăng nhập</Text>
        <TextInput
          placeholder="Vui lòng nhập họ tên"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholderTextColor={Colors.LightGray}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Địa chỉ gmail</Text>
        <TextInput
          placeholder="name@company.com"
          style={styles.input}
          value={gmail}
          onChangeText={setGmail}
          placeholderTextColor={Colors.LightGray}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Mật khẩu</Text>
        <TextInput
          placeholder="Tạo mật khẩu"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={Colors.LightGray}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Xác nhận mật khẩu</Text>
        <TextInput
          placeholder="Xác nhận lại mật khẩu"
          secureTextEntry
          style={styles.input}
          value={rePassword}
          onChangeText={setRePassword}
          placeholderTextColor={Colors.LightGray}
        />
      </View>

      {/* CheckBox */}
      <View>
        <Text style={styles.agreememt} >
          <TouchableOpacity
            style={{ display: "inline", }}
            onPress={() => {
              setAgree(!agree)
            }}>
            <Ionicons name={agree === true ? "checkbox-outline" : "square-outline"} size={20} />
          </TouchableOpacity>

          {' '}Bạn đồng ý với{' '}
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan')

            }}>
            <Text style={styles.link}>
              Điều khoản
            </Text>
          </TouchableOpacity>
             {' '}và{' '} 
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan')
            }}>
            <Text style={styles.link}>
              Chính sách bảo mật
            </Text>
          </TouchableOpacity>
        </Text>
      </View>

      <TouchableOpacity
        style={styles.signUpButton}
        onPress={() => {
          
          checkPassword()
        }}>
        <Text style={{ color: "#fff" }}>Đăng ký</Text>
      </TouchableOpacity>

      <Text style={styles.or}>-------Hoặc tiếp tục đăng ký với-------</Text>
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
        Bạn đã có tài khoản?
        <TouchableOpacity onPress={() => {
          router.push('/auth/signIn')
        }}>
          <Text style={styles.link}> Đăng nhập</Text>
        </TouchableOpacity>
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
    borderColor: Colors.White,
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
  agreememt: {
    fontSize: 12,
    flexDirection: "row",
    alignItems:"center",
  },
});
