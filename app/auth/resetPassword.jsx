import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constant/Colors";

export default function resetPassword() {
return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton}>
            <Ionicons  name="chevron-back-circle-outline" size={24}/>
        </button>
      </div>

      <div style={styles.icon}>
        <Ionicons name="lock-closed-outline" size={24} color={Colors.Blue}/>
      </div>

      <h2 style={styles.title}>Reset Password</h2>
      <p style={styles.subtitle}>
        Enter your email address and we will send you a link to reset your password.
      </p>

      <div style={styles.formGroup}>
        <label>Email Address</label>
        <input type="email" placeholder="name@company.com" style={styles.input} />
      </div>

      <button style={styles.resetButton}>Send Reset Link</button>

      <a href="./signIn" style={styles.link}>Back to Login</a>
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
    fontFamily: "Arial, sans-serif"
  },
  header: {
    display: "flex",
    justifyContent: "flex-start", // đẩy nút về sát trái
    marginBottom: "10px"
  },
  backButton: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer"
  },
  icon: {
    fontSize: "40px",
    textAlign: "center",
    marginBottom: "15px"
  },
  title: {
    textAlign: "center",
    marginBottom: "10px"
  },
  subtitle: {
    fontSize: "14px",
    color: "#555",
    textAlign: "center",
    marginBottom: "20px"
  },
  formGroup: {
    marginBottom: "15px"
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "5px",
    borderRadius: "4px",
    border: "1px solid #ccc"
  },
  resetButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "10px"
  },
  link: {
    display: "block",
    marginTop: "20px",
    fontSize: "12px",
    color: "#007bff",
    textDecoration: "none",
    textAlign: "center"
  }
};