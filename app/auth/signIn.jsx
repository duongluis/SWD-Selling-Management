import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignIn() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>
      <Text style={styles.subtitle}>
        Vui lòng đăng nhập để truy cập tài khoản doanh nghiệp
      </Text>

      <View style={styles.formGroup}>
        <Text>Gmail / Tên đăng nhập</Text>
        <TextInput
          placeholder="Nhập gmail hoặc tên đăng nhập"
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text>Mật khẩu</Text>
        <TextInput
          placeholder="Nhập mật khẩu"
          secureTextEntry
          style={styles.input}
        />
        <TouchableOpacity>
          <Text style={styles.link}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.loginButton}>
        <Text style={{ color: '#fff' }}>Đăng nhập</Text>
      </TouchableOpacity>

      <Text style={styles.or}>Tiếp tục với</Text>
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
        <Text style={styles.link}>Đăng ký ngay</Text>
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
  input: {
    width: '100%',
    padding: 10,
    marginTop: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  link: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 5,
  },
  loginButton: {
    width: '100%',
    padding: 10,
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
