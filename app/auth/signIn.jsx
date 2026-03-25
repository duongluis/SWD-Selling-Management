import auth, { db } from "@/config/firebaseConfig";
import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "@firebase/auth";
import { router } from 'expo-router';
import { doc, getDoc } from "firebase/firestore";
import { useContext, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignIn() {

  const [showIcon, setShowIcon] = useState(false)
  const [gmail, setGmail] = useState("")
  const [password, setPassword] = useState("");
  const { userDetail, setUserDetail } = useContext(UserDetailContext)


  const signInByClick = async () => {

    try {
      const res = await signInWithEmailAndPassword(auth, gmail, password)

      if (res.user) {
        console.log("Đăng nhập thành công")
        console.log("res", res)


        const result = await getDoc(doc(db, "users", "nhan vien"))
        setUserDetail(result.data())

        router.replace('../(tabs)/home')

      }
      else {
        console.log("Loi dang nhap")
      }
    }
    catch (e) {
      Alert.alert(e.message)
      console.log(e)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>
      <Text style={styles.subtitle}>
        Vui lòng đăng nhập để truy cập tài khoản doanh nghiệp
      </Text>

      <View style={styles.formGroup}>
        <Text>Gmail / Tên đăng nhập</Text>
        <View style={[styles.box, { flexDirection: "row" }]}>
          <View>
            <Ionicons name="person-outline" size={15} color={Colors.LightGray} style={{ margin: 10 }} />
          </View>
          <TextInput
            style={styles.input}
            placeholder=" Nhập gmail hoặc tên đăng nhập"
            placeholderTextColor={Colors.LightGray}
            value={gmail}
            onChangeText={(value) => setGmail(value)}
          />

        </View>
      </View>

      <View style={styles.formGroup}>
        <Text>Mật khẩu</Text>
        <View style={[styles.box,]}>

          <Ionicons name="lock-closed-outline" size={20} color={Colors.LightGray} style={{ margin: 10 }} />

          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            placeholder="Nhập mật khẩu"
            secureTextEntry={!showIcon}
            placeholderTextColor={Colors.LightGray}
          />
          <TouchableOpacity onPress={() => setShowIcon(!showIcon)}>

            <Ionicons name={showIcon ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.LightGray} style={{ margin: 10 }} />

          </TouchableOpacity>

        </View>
        <TouchableOpacity
          style={{
            padding: 5,
            // marginStart: 200,
            alignSelf: 'flex-end',
            // borderColor: Colors.Black,
            // borderWidth: 1,
            display: "inline",
            // alignItems:"center"
          }}
          onPress={() => {
            router.push('/auth/resetPassword')
          }}>
          <Text style={[
            styles.link,
            //  { textAlign: "right",display:"inline" }

          ]}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => {
          signInByClick()
        }}>
        <Text style={{ color: '#fff', alignContent: "center" }}>Đăng nhập</Text>
      </TouchableOpacity>

      <Text style={styles.or}>---------------Tiếp tục với---------------</Text>
      <View style={styles.socialButtons}>
        <TouchableOpacity style={styles.social}>
          <Text>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.social}>
          <Text>iOS</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.signup}>
        Bạn chưa có tài khoản?{' '}
        <TouchableOpacity onPress={() => {
          router.push('/auth/signUp')
        }}>
          <Text style={styles.link}>Đăng ký ngay</Text>
        </TouchableOpacity>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 350,
    marginTop: 50,
    alignSelf: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  title: {
    marginBottom: 10,
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 15,
    alignSelf: 'stretch',
  },
  box: {
    width: '100%',
    padding: 5,
    marginTop: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    flexDirection: "row",
  },
  input: {
    width: '80%',
    // borderRadius: 4,
    // borderWidth: 1,
    // borderColor: '#ccc',
  },
  link: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 5,
  },
  loginButton: {
    width: '100%',
    margin: 10,
    padding: 10,
    paddingEnd: 10,
    paddingBottom: 10,
    backgroundColor: '#007bff',
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  or: {
    marginVertical: 20,
    fontSize: 12,
    color: '#888',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
  },
  social: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
  },
  signup: {
    fontSize: 12,
    color: '#555',
  },
});
