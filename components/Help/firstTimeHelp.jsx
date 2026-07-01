// components/Help/FirstTimeHelpTooltip.jsx

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FirstTimeHelpTooltip({ visible, onDismiss }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-8)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
                Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
            ]).start();

            // Tự đóng sau 8 giây
            timerRef.current = setTimeout(onDismiss, 8000);
        } else {
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
            translateY.setValue(-8);
        }

        return () => clearTimeout(timerRef.current);
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View style={[S.wrap, { opacity, transform: [{ translateY }] }]}>
            {/* Arrow pointing up-right (toward the help button) */}
            <View style={S.arrow} />

            <View style={S.inner}>
                <View style={S.row}>
                    <View style={S.iconWrap}>
                        <Ionicons name="bulb" size={14} color="#93C5FD" />
                    </View>
                    <Text style={S.title}>Hướng dẫn sử dụng</Text>
                </View>
                <Text style={S.body}>
                    Nhấn nút này bất kỳ lúc nào để xem hướng dẫn cho màn hình đang mở.
                </Text>
                <TouchableOpacity style={S.btn} onPress={onDismiss} activeOpacity={0.8}>
                    <Text style={S.btnText}>Đã hiểu</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const S = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 44,   // ngay dưới topbar (điều chỉnh nếu cần)
        right: 10,
        zIndex: 200,
        width: 220,
    },
    arrow: {
        width: 12, height: 12,
        backgroundColor: '#1E293B',
        transform: [{ rotate: '45deg' }],
        alignSelf: 'flex-end',
        marginRight: 14,
        marginBottom: -6,
        borderRadius: 2,
        zIndex: 1,
    },
    inner: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 12,
        zIndex: 2,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 8 },
            web: { boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
        }),
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
    iconWrap: {
        width: 26, height: 26, borderRadius: 7,
        backgroundColor: 'rgba(59,130,246,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { color: '#fff', fontSize: 13, fontWeight: '600' },
    body: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
    btn: {
        backgroundColor: '#3B82F6',
        borderRadius: 7,
        paddingVertical: 6,
        alignItems: 'center',
    },
    btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});