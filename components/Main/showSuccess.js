import { Alert, Platform } from 'react-native';

/**
 * Hộp thoại BÁO THÀNH CÔNG — luôn 1 nút.
 *
 * Việc đã hoàn tất trước khi hộp thoại hiện ra, nên không có gì để huỷ.
 * Trước đây web dùng window.confirm() (2 nút OK/Huỷ): bấm Huỷ thì onConfirm
 * không chạy, đơn đã tạo xong nhưng màn hình vẫn đứng nguyên tại form.
 *
 * onConfirm luôn được gọi sau khi người dùng đóng hộp thoại.
 */
export const showSuccess = (title, message, onConfirm) => {
    if (Platform.OS === 'web') {
        window.alert(message ? `${title}\n\n${message}` : title);
        onConfirm?.();
        return;
    }

    // cancelable: false để trên Android chạm ra ngoài không đóng được mà bỏ qua
    // onPress — cũng sẽ kẹt lại màn cũ y như lỗi trên web.
    Alert.alert(
        title,
        message,
        [{ text: 'OK', style: 'default', onPress: onConfirm }],
        { cancelable: false, onDismiss: onConfirm }
    );
};
