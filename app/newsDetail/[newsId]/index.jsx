// app/newsDetail/[newsId]/index.jsx — Chi tiết tin tức (blog view)

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Image,
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';


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

// Renders an array of content blocks [{type:'text'|'image', value:string}]
function BlockContent({ blocks }) {
    const { isDesktop } = useLayout();
    return blocks.map((block, i) => {
        if (block.type === 'image' && block.value) {
            return (
                <View key={i} style={S.inlineImgWrap}>
                    <Image source={{ uri: block.value }} style={[S.inlineImage, { height: isDesktop ? 360 : 220 }]} resizeMode="contain" />
                </View>
            );
        }
        if (block.type === 'text' && block.value) {
            return <Text key={i} style={[S.contentBlock, { fontSize: isDesktop ? 16 : 14, lineHeight: isDesktop ? 28 : 24 }]}>{block.value}</Text>;
        }
        return null;
    });
}

export default function NewsDetailScreen() {
    const { newsId } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isDesktop } = useLayout();

    const [news, setNews] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
    const hasBlocks = news.blocks?.length > 0;

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            {/* Header */}
            <View style={S.header}>
                <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <Text style={S.headerTitle} numberOfLines={1}>{news.title}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[S.scroll, { padding: isDesktop ? 32 : 16 }, isDesktop && { maxWidth: 720, alignSelf: 'center', width: '100%' }]}
            >
                {/* Hero image */}
                {news.imageUrl ? (
                    <View style={[S.heroWrap, { height: isDesktop ? 380 : 220 }]}>
                        <Image source={{ uri: news.imageUrl }} style={S.heroImage} resizeMode="contain" />
                        <View style={S.heroOverlay} />
                    </View>
                ) : (
                    <View style={[S.heroPlaceholder, { height: isDesktop ? 200 : 140 }]}>
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
                <Text style={[S.title, { fontSize: isDesktop ? 28 : 22, lineHeight: isDesktop ? 38 : 30 }]}>{news.title}</Text>

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
                {hasBlocks ? (
                    <BlockContent blocks={news.blocks} />
                ) : (
                    <>
                        <Text style={[S.contentBlock, { fontSize: isDesktop ? 16 : 14, lineHeight: isDesktop ? 28 : 24 }]}>{news.content}</Text>
                        {(news.images || []).map((uri, i) => (
                            <View key={i} style={S.inlineImgWrap}>
                                <Image source={{ uri }} style={[S.inlineImage, { height: isDesktop ? 360 : 220 }]} resizeMode="contain" />
                            </View>
                        ))}
                    </>
                )}

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
    scroll: {},

    heroWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative', backgroundColor: '#0F172A' },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
    heroPlaceholder: {
        borderRadius: 16, marginBottom: 20,
        backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center',
    },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    catBadgeText: { fontSize: 11, fontStyle: 'normal', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    metaTime: { fontSize: 12, color: '#94A3B8' },

    title: { fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 16 },

    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    authorAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#1E3A8A', alignItems: 'center', justifyContent: 'center',
    },
    authorAvatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    authorName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    authorEmail: { fontSize: 11, color: '#94A3B8' },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },

    contentBlock: {
        color: '#374151',
        letterSpacing: 0.1,
        marginBottom: 16,
    },
    inlineImgWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, backgroundColor: '#F1F5F9' },
    inlineImage: {
        width: '100%',
    },
});