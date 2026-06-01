import { Ionicons } from '@expo/vector-icons';
import {
    KeyboardAvoidingView, Modal, Platform, Pressable,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();

export default function DetailPanel({
    visible,
    onClose,
    title,
    subtitle,
    // Header right slot (badges, buttons...)
    headerRight,
    // Footer (action buttons)
    footer,
    children,
    // Web: width của panel bên phải
    panelWidth = 420,
}) {
    const insets = useSafeAreaInsets();

    if (!visible) return null;

    // Web: panel cố định bên phải
    if (isDesktop) return (
        <>
            {/* Backdrop */}
            <Pressable style={W.backdrop} onPress={onClose} />
            <View style={[W.panel, { width: panelWidth }]}>
                <Header title={title} subtitle={subtitle} right={headerRight} onClose={onClose} />
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
                    {children}
                </ScrollView>
                {footer && <View style={W.footer}>{footer}</View>}
            </View>
        </>
    );

    // Mobile: Modal full screen
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[M.root, { paddingTop: insets.top }]}>
                <Header title={title} subtitle={subtitle} right={headerRight} onClose={onClose} />
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
                        {children}
                    </ScrollView>
                    {footer && (
                        <View style={[M.footer, { paddingBottom: insets.bottom + 12 }]}>
                            {footer}
                        </View>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

function Header({ title, subtitle, right, onClose }) {
    return (
        <View style={H.wrap}>
            <TouchableOpacity style={H.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
                {title && <Text style={H.title} numberOfLines={1}>{title}</Text>}
                {subtitle && <Text style={H.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>
            {right && <View style={H.right}>{right}</View>}
        </View>
    );
}

const H = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
    closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
    right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

const W = StyleSheet.create({
    backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 10 },
    panel: { position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 11, borderLeftWidth: 1, borderLeftColor: '#E2E8F0', flexDirection: 'column' },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFFFFF', gap: 8 },
});

const M = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
});