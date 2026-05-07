import { Image, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG_IMAGE = require('../../assets/images/logo-light.png');
const isWeb = Platform.OS === 'web';

export default function TabScreenLayout({ children, style }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }, style]}>
            <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />
            {children}
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: {
        position: 'absolute',
        width: '80%', height: '60%',
        top: '20%', left: '10%',
        opacity: 0.04,
        zIndex: 0,
    },
});