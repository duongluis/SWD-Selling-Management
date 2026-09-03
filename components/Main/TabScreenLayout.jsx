// Lưu ý: 'react-native' KHÔNG export React — import nó ở đây chỉ ra undefined.
// File này dùng JSX transform tự động nên không cần React trong scope.
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BgWatermark from './BgWatermark';

const DESKTOP_BREAKPOINT = 768;

// ── Hook trung tâm — dùng ở mọi nơi ─────────────────────────
export function useLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
    const isMobile = !isDesktop; // native hoặc web nhỏ
    return { isDesktop, isMobile, width };
}

export default function TabScreenLayout({ children, style }) {
    const { isDesktop } = useLayout();
    const insets = useSafeAreaInsets();
    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }, style]}>
            <BgWatermark />
            {children}
        </View>
    );
}


const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
});