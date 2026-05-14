import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BgWatermark from './BgWatermark';

const isWeb = Platform.OS === 'web';

export default function TabScreenLayout({ children, style }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }, style]}>
            <BgWatermark />
            {children}
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
});