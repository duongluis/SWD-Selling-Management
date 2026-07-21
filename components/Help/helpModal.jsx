// components/Help/HelpModal.jsx

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useLayout } from '../Main/TabScreenLayout';
import { HELP_GUIDE } from './helpGuide';

// Kích thước tối thiểu trên desktop — to hơn nếu màn hình còn chỗ, nhưng không nhỏ hơn mức này
const MIN_MODAL_SIZE = 900;
const MAX_MODAL_WIDTH = 1300;
const MAX_MODAL_HEIGHT = 1000;



// ── Dot indicator ────────────────────────────────────────────
function StepDots({ total, current }) {
    return (
        <View style={D.wrap}>
            {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[D.dot, i === current && D.dotActive]} />
            ))}
        </View>
    );
}

const D = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: {
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: '#CBD5E1',
    },
    dotActive: {
        width: 18, borderRadius: 4,
        backgroundColor: '#2C5282',
    },
});

// ── Tip row ──────────────────────────────────────────────────
function TipRow({ text }) {
    return (
        <View style={T.row}>
            <Ionicons name="information-circle-outline" size={14} color="#3B82F6" style={{ marginTop: 1 }} />
            <Text style={T.text}>{text}</Text>
        </View>
    );
}

const T = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 5 },
    text: { color: '#64748B', fontSize: 12.5, lineHeight: 18, flex: 1 },
});

// ── Main component ───────────────────────────────────────────
export default function HelpModal({ visible, screenKey, onClose }) {
    const [step, setStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const stepFade = useRef(new Animated.Value(1)).current;

    const { isDesktop } = useLayout();
    const { width: winW, height: winH } = useWindowDimensions();
    // Reset step về 0 mỗi khi đổi màn hoặc mở lại modal
    useEffect(() => {
        setStep(0);
    }, [screenKey]);

    useEffect(() => {
        if (visible) {
            setStep(0);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
        }
    }, [visible]);

    // Guard PHẢI đặt sau tất cả hooks
    // Trên mobile không hiển thị Help Modal — hướng dẫn chỉ dành cho desktop
    if (!isDesktop) return null;
    const guide = HELP_GUIDE[screenKey];
    if (!guide) return null;

    const steps = guide.steps;
    // Clamp step phòng trường hợp step cũ vượt quá số steps của màn mới
    const safeStep = Math.min(step, steps.length - 1);
    const current = steps[safeStep];
    const isLast = safeStep === steps.length - 1;

    // Tối thiểu 900x900, to hơn nếu màn hình còn chỗ (trừ hao lề để không sát viền)
    const modalWidth = Math.max(MIN_MODAL_SIZE, Math.min(winW - 80, MAX_MODAL_WIDTH));
    const modalHeight = Math.max(MIN_MODAL_SIZE, Math.min(winH - 80, MAX_MODAL_HEIGHT));
    // Ảnh minh hoạ chiếm phần lớn modal — scale theo modalHeight thay vì cố định 210px cũ
    const imgHeight = Math.round(modalHeight * 0.55);

    const animateStep = (nextStep) => {
        Animated.timing(stepFade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
            setStep(nextStep);
            Animated.timing(stepFade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
        });
    };

    const handleNext = () => {
        if (!isLast) animateStep(safeStep + 1);
        else onClose();
    };

    const handlePrev = () => {
        if (safeStep > 0) animateStep(safeStep - 1);
    };

    // ── Render ─────────────────────────────────────────────────
    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* Overlay */}
            <Animated.View style={[S.overlay, { opacity: fadeAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                {/* Card */}
                <Animated.View
                    style={[
                        S.card,
                        { width: modalWidth, height: modalHeight },
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* ── Header ── */}
                    <View style={S.header}>
                        <View style={S.headerLeft}>
                            <View style={S.headerIcon}>
                                <Ionicons name="help-circle" size={18} color="#fff" />
                            </View>
                            <View>
                                <Text style={S.headerTitle}>Hướng dẫn sử dụng</Text>
                                <Text style={S.headerSub}>{guide.screenLabel}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={S.closeBtn} onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                    </View>

                    {/* ── Step tabs ── */}
                    {steps.length > 1 && (
                        <View style={S.tabRow}>
                            {steps.map((s, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[S.tab, i === safeStep && S.tabActive]}
                                    onPress={() => animateStep(i)}
                                >
                                    <Text style={[S.tabText, i === safeStep && S.tabTextActive]} numberOfLines={1}>
                                        {s.title}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── Content ── */}
                    <ScrollView
                        style={S.body}
                        contentContainerStyle={S.bodyContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <Animated.View style={{ opacity: stepFade }}>
                            {/* Image */}
                            <View style={[S.imgWrap, { height: imgHeight }]}>
                                {current.image ? (
                                    <Image
                                        source={current.image}
                                        style={S.img}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    // Placeholder khi chưa có ảnh
                                    <View style={S.imgPlaceholder}>
                                        <Ionicons name="image-outline" size={36} color="#93C5FD" />
                                        <Text style={S.imgPlaceholderText}>
                                            {current.title}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Step title (hiện trên mobile khi không có tabs) */}
                            {steps.length === 1 && (
                                <Text style={S.stepTitle}>{current.title}</Text>
                            )}

                            {/* Description */}
                            <Text style={S.desc}>{current.description}</Text>

                            {/* Tips */}
                            {current.tips?.length > 0 && (
                                <View style={S.tipsWrap}>
                                    <Text style={S.tipsLabel}>Gợi ý</Text>
                                    {current.tips.map((tip, i) => (
                                        <TipRow key={i} text={tip} />
                                    ))}
                                </View>
                            )}
                        </Animated.View>
                    </ScrollView>

                    {/* ── Footer ── */}
                    <View style={S.footer}>
                        <StepDots total={steps.length} current={safeStep} />

                        <View style={S.footerRight}>
                            <TouchableOpacity style={S.skipBtn} onPress={onClose}>
                                <Text style={S.skipText}>Đóng</Text>
                            </TouchableOpacity>

                            {safeStep > 0 && (
                                <TouchableOpacity style={S.prevBtn} onPress={handlePrev}>
                                    <Ionicons name="chevron-back" size={14} color="#475569" />
                                    <Text style={S.prevText}>Trước</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[S.nextBtn, isLast && S.nextBtnDone]}
                                onPress={handleNext}
                            >
                                <Text style={S.nextText}>
                                    {isLast ? 'Hoàn tất' : 'Tiếp theo'}
                                </Text>
                                {!isLast && (
                                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                                )}
                                {isLast && (
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// ── Styles ───────────────────────────────────────────────────
// Modal này chỉ còn render trên desktop (xem guard !isDesktop ở trên) nên overlay/card
// luôn dùng bố cục desktop (căn giữa); width/height thực tế được set inline theo
// modalWidth/modalHeight (tính từ kích thước cửa sổ, tối thiểu 900x900).
const S = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
    },

    // Header
    header: {
        backgroundColor: '#2C5282',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
    closeBtn: {
        width: 28, height: 28, borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Tabs
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
    },
    tab: {
        flex: 1, paddingVertical: 9, paddingHorizontal: 4,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: '#2C5282' },
    tabText: { fontSize: 11.5, color: '#94A3B8', fontWeight: '500' },
    tabTextActive: { color: '#2C5282', fontWeight: '700' },

    // Body
    body: { flex: 1 },
    bodyContent: { padding: 16, paddingBottom: 8 },

    // Image
    imgWrap: {
        width: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 14,
        backgroundColor: '#000',
    },
    img: { width: '100%', height: '100%' },
    imgPlaceholder: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    imgPlaceholderText: {
        color: '#93C5FD', fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: 16,
    },

    // Content
    stepTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
    desc: { fontSize: 13.5, color: '#475569', lineHeight: 20 },
    tipsWrap: {
        marginTop: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 0.5,
        borderColor: '#BFDBFE',
    },
    tipsLabel: { fontSize: 11, fontWeight: '700', color: '#2563EB', marginBottom: 4, letterSpacing: 0.4 },

    // Footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderTopWidth: 0.5,
        borderTopColor: '#E2E8F0',
        backgroundColor: '#fff',
    },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    skipBtn: { paddingHorizontal: 8, paddingVertical: 5 },
    skipText: { fontSize: 12, color: '#94A3B8' },
    prevBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        borderWidth: 0.5, borderColor: '#CBD5E1',
        borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6,
    },
    prevText: { fontSize: 12, color: '#475569', fontWeight: '500' },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#2C5282',
        borderRadius: 7, paddingHorizontal: 14, paddingVertical: 7,
    },
    nextBtnDone: { backgroundColor: '#059669' },
    nextText: { fontSize: 12, color: '#fff', fontWeight: '600' },
});