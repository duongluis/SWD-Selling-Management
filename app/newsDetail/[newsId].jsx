// app/newsDetail/[newsId].jsx — Chi tiết tin tức (blog view)

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Image, Platform,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

const CAT_COLORS = {
    'Hệ thống': { c: '#EF4444', bg: '#FEF2F2' },
    'Sự kiện': { c: '#8B5CF6', bg: '#F5F3FF' },
    'Công nghệ': { c: '#D97706', bg: '#FFFBEB' },
    'Thông báo': { c: '#2563EB', bg: '#EFF6FF' },
};

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NewsDetailScreen() {
    const { newsId, newsData } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [news, setNews] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Thử parse từ param trước (tránh gọi Firestore khi không cần)
        if (newsData) {
            try {
                setNews(JSON.parse(decodeURIComponent(newsData)));
                setLoading(false);
                return;
            } catch (_) { }
        }
        if (!newsId) { setLoading(false); return; }
        getDoc(doc(db, 'news', newsId))
            .then(s => s.exists() ? setNews({ ...s.data(), id: s.id }) : null)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [newsId]);

    if (loading) return (
        <View style={[S.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color="#2563EB" />
        </View>
    );

    if (!news) return (
        <View style={[S.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
            <Ionicons name="newspaper-outline" size={48} color="#CBD5E1" />
            <Text style={{ fontSize: 16, color: '#94A3B8' }}>Không tìm thấy tin tức</Text>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtnSmall}>
                <Text style={{ color: '#2563EB', fontWeight: '600' }}>Quay lại</Text>
            </TouchableOpacity>
        </View>
    );

    const catCfg = CAT_COLORS[news.category] || { c: '#2563EB', bg: '#EFF6FF' };

    return (
        <View style={[S.root, { paddingTop: isWeb ? 0 : insets.top }]}>
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <Text style={S.headerTitle} numberOfLines={1}>{news.title}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[S.scroll, isWeb && { maxWidth: 720, alignSelf: 'center', width: '100%' }]}
            >
                {/* Hero image */}
                {news.imageUrl ? (
                    <View style={S.heroWrap}>
                        <Image source={{ uri: news.imageUrl }} style={S.heroImage} resizeMode="cover" />
                        <View style={S.heroOverlay} />
                    </View>
                ) : (
                    <View style={S.heroPlaceholder}>
                        <Ionicons name="newspaper-outline" size={48} color="rgba(255,255,255,0.4)" />
                    </View>
                )}

                {/* Meta */}
                <View style={S.metaRow}>
                    <View style={[S.catBadge, { backgroundColor: catCfg.bg }]}>
                        <Text style={[S.catBadgeText, { color: catCfg.c }]}>{news.category || 'Tin tức'}</Text>
                    </View>
                    <Text style={S.metaTime}>{formatDate(news.createdAt)}</Text>
                </View>

                {/* Title */}
                <Text style={S.title}>{news.title}</Text>

                {/* Author */}
                {news.authorName && (
                    <View style={S.authorRow}>
                        <View style={S.authorAvatar}>
                            <Text style={S.authorAvatarText}>
                                {(news.authorName || '?').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View>
                            <Text style={S.authorName}>{news.authorName}</Text>
                            {news.authorEmail && <Text style={S.authorEmail}>{news.authorEmail}</Text>}
                        </View>
                    </View>
                )}

                <View style={S.divider} />

                {/* Content */}
                <Text style={S.content}>{news.content}</Text>

                {/* Images thêm trong bài (nếu có nhiều ảnh) */}
                {(news.images || []).map((uri, i) => (
                    <Image key={i} source={{ uri }} style={S.inlineImage} resizeMode="cover" />
                ))}

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 13,
        backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9',
        alignItems: 'center', justifyContent: 'center',
    },
    backBtnSmall: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
    scroll: { padding: isWeb ? 32 : 16 },

    heroWrap: { borderRadius: 16, overflow: 'hidden', height: isWeb ? 380 : 220, marginBottom: 20, position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
    heroPlaceholder: {
        height: isWeb ? 200 : 140, borderRadius: 16, marginBottom: 20,
        backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center',
    },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    catBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    metaTime: { fontSize: 12, color: '#94A3B8' },

    title: { fontSize: isWeb ? 28 : 22, fontWeight: '800', color: '#0F172A', lineHeight: isWeb ? 38 : 30, letterSpacing: -0.5, marginBottom: 16 },

    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    authorAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#1E3A8A', alignItems: 'center', justifyContent: 'center',
    },
    authorAvatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    authorName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    authorEmail: { fontSize: 11, color: '#94A3B8' },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },

    content: {
        fontSize: isWeb ? 16 : 14, color: '#374151',
        lineHeight: isWeb ? 28 : 24, letterSpacing: 0.1,
    },
    inlineImage: {
        width: '100%', height: isWeb ? 360 : 220,
        borderRadius: 12, marginTop: 20,
    },
});
