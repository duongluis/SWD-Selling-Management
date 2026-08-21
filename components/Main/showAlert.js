import { Alert, Platform } from 'react-native';

/**
 * Hộp thoại dùng chung, tự chọn dạng theo tham số:
 *
 *   showAlert('Lỗi', 'Không lưu được')            → THÔNG BÁO, 1 nút OK
 *   showAlert('Xoá đơn', 'Chắc chưa?', onConfirm) → XÁC NHẬN, 2 nút Huỷ/Xác nhận
 *
 * Trước đây mọi trường hợp đều là window.confirm()/Alert 2 nút, nên các thông báo
 * thường ("Thông báo", "Lỗi"...) cũng hiện thêm nút Huỷ vô nghĩa.
 */
export const showAlert = (title, message, onConfirm, onCancel) => {
    const isConfirm = typeof onConfirm === 'function';

    if (Platform.OS === 'web') {
        const body = message ? `${title}\n\n${message}` : title;
        if (!isConfirm) {
            window.alert(body);
            onCancel?.();   // giữ đồng nhất với nhánh mobile: gọi sau khi đóng
            return;
        }
        if (window.confirm(body)) onConfirm();
        else onCancel?.();
        return;
    }

    if (!isConfirm) {
        Alert.alert(title, message, [{ text: 'OK', style: 'default', onPress: onCancel }]);
        return;
    }

    Alert.alert(title, message, [
        { text: 'Huỷ', style: 'cancel', onPress: onCancel },
        { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
    ]);
};
