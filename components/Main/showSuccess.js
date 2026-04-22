import { Alert, Platform } from 'react-native';

export const showSuccess = (title, message, onConfirm) => {
    if (Platform.OS === 'web') {
        // Web: dùng confirm() của browser
        const confirmed = window.confirm(
            message ? `${title}\n\n${message}` : title
        );
        if (confirmed) onConfirm?.();
    } else {
        // Mobile: dùng Alert bình thường
        Alert.alert(title, message, [
            { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
        ]);
    }
};