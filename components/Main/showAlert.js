import { Alert, Platform } from 'react-native';

export const showAlert = (title, message, onConfirm, onCancel) => {
    if (Platform.OS === 'web') {
        // Web: dùng confirm() của browser
        const confirmed = window.confirm(
            message ? `${title}\n\n${message}` : title
        );
        if (confirmed) onConfirm?.();
        else onCancel?.();
    } else {
        // Mobile: dùng Alert bình thường
        Alert.alert(title, message, [
            { text: 'Huỷ', style: 'cancel', onPress: onCancel },
            { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
        ]);
    }
};