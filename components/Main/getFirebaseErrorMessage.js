export const getFirebaseErrorMessage = (e) => {
  switch (e.code) {


    case 'auth/invalid-email':
      return 'Email không hợp lệ';
    case 'auth/user-not-found':
      return 'Tài khoản không tồn tại';
    case 'auth/wrong-password':
      return 'Mật khẩu không đúng';
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu không đúng';
    case 'auth/email-already-in-use':
      return 'Email này đã được sử dụng';
    case 'auth/weak-password':
      return 'Mật khẩu phải có ít nhất 6 ký tự';
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử, vui lòng thử lại sau';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng, vui lòng kiểm tra lại';
    case 'auth/user-disabled':
      return 'Tài khoản đã bị vô hiệu hóa';
    case 'auth/requires-recent-login':
      return 'Vui lòng đăng nhập lại để tiếp tục';
    case 'auth/already-initialized':
      return 'Ứng dụng đã được khởi tạo';

    // Firestore errors
    case 'permission-denied':
      return 'Bạn không có quyền thực hiện thao tác này';
    case 'not-found':
      return 'Không tìm thấy dữ liệu';
    case 'already-exists':
      return 'Dữ liệu đã tồn tại';
    case 'unavailable':
      return 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại';
    case 'deadline-exceeded':
      return 'Kết nối quá thời gian, vui lòng thử lại';

    default:
      return 'Đã có lỗi xảy ra, vui lòng thử lại';
  }
};