import React from 'react';

export default function SignIn() {
  return (
      <div style={styles.container}>
      <h2 style={styles.title}>Đăng nhập</h2>
      <p style={styles.subtitle}>
        Vui lòng đăng nhập để truy cập tài khoản doanh nghiệp
      </p>

      <div style={styles.formGroup}>
        <label>Gmail / Tên đăng nhập</label>
        <input type="text" placeholder="Nhập gmail hoặc tên đăng nhập" style={styles.input} />
      </div>

      <div style={styles.formGroup}>
        <label>Mật khẩu</label>
        
        <input type="password" placeholder="Nhập mật khẩu" style={styles.input} />
        <a href="./resetPassword" style={styles.link}>Quên mật khẩu?</a>
      </div>

      <button style={styles.loginButton}>Đăng nhập</button>

      <div style={styles.or}>Tiếp tục với</div>
      <div style={styles.socialButtons}>
        <button style={styles.social}>Google</button>
        <button style={styles.social}>iOS</button>
      </div>

      <p style={styles.signup}>
        Bạn chưa có tài khoản? <a href="./signUp" style={styles.link}>Đăng ký ngay</a>
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
    textAlign: "left"
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "5px",
    borderRadius: "4px",
    border: "1px solid #ccc"
  },
  link: {
    fontSize: "12px",
    color: "#007bff",
    textDecoration: "none"
  },
  loginButton: {
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
  signup: {
    fontSize: "12px",
    color: "#555"
  }
};