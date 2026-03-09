import { TouchableOpacity } from "react-native";

export default function SignUp() {
 return (
    <div style={styles.container}>
      <h2 style={styles.title}>Tạo tài khoản</h2>
      <p style={styles.subtitle}>Gia nhập vào cộng đồng của chúng tôi ngay hôm nay.</p>

      <div style={styles.formGroup}>
        <label>Tên đăng nhập</label>
        <input type="text" placeholder="Vui lòng nhập họ tên" style={styles.input} />
      </div>

      <div style={styles.formGroup}>
        <label>Địa chỉ gmail</label>
        <input type="email" placeholder="name@company.com" style={styles.input} />
      </div>

      <div style={styles.formGroup}>
        <label>Mật khẩu</label>
        <input type="password" placeholder="Tạo mật khẩu" style={styles.input} />
      </div>

      <div style={styles.formGroup}>
        <label>Xác nhận mật khẩu</label>
        <input type="password" placeholder="Xác nhận lại mật khẩu" style={styles.input} />
      </div>

      <div style={styles.checkbox}>
        <input type="checkbox" id="terms" />
        <label htmlFor="terms">
          Tôi đồng ý với <a href="https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan">Điều khoản</a> và <a href="https://swd.vn/pages/chinh-sach-bao-mat-thong-tin-ca-nhan">Chính sách bảo mật</a> của doanh nghiệp
        </label>
      </div>

      <button style={styles.signUpButton}>Đăng ký</button>

      <div style={styles.or}>Hoặc tiếp tục đăng ký với</div>
      <div style={styles.socialButtons}>
        <TouchableOpacity onPress={()=>{
          console.log("Sign In with Google");
          
        }} style={styles.social}>Google</TouchableOpacity>
        <button style={styles.social}>iOS</button>
      </div>

      <p style={styles.login}>
        Bạn đã có tài khoản? <a href="./signIn" style={styles.link}>Đăng nhập</a>
      </p>
    </div>
  );
}

const styles = {
  container: {
    width: "350px",
    margin: "50px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    textAlign: "center",
    fontFamily: "Arial, sans-serif"
  },
  title: {
    marginBottom: "10px"
  },
  subtitle: {
    fontSize: "14px",
    color: "#555",
    marginBottom: "20px"
  },
  formGroup: {
    marginBottom: "15px",
    textAlign: "left",
    paddingRight: "15px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "5px",
    borderRadius: "4px",
    border: "1px solid #ccc"
  },
  checkbox: {
    fontSize: "12px",
    textAlign: "left",
    marginBottom: "15px"
  },
  signUpButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "10px"
  },
  or: {
    margin: "20px 0",
    fontSize: "12px",
    color: "#888"
  },
  socialButtons: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px"
  },
  social: {
    flex: 1,
    margin: "0 5px",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer"
  },
  login: {
    fontSize: "12px",
    color: "#555"
  },
  link: {
    color: "#007bff",
    textDecoration: "none"
  }
};