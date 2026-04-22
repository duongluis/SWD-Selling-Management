import { Alert, Platform } from "react-native";

export const showInfo = (title, message) => {
    if (Platform.OS === 'web') {
        window.alert(message ? `${title}\n\n${message}` : title);
    } else {
        Alert.alert(title, message);
    }
};