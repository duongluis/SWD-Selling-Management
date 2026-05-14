// app/news/index.jsx — Tin tức (admin CRUD + notification)

import BgWatermark from '@/components/Main/BgWatermark';
import { createNotification } from '@/components/Utils/chatService';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import {
    addDoc, collection, deleteDoc, doc, getDocs, orderBy,
    query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Image,
    Modal, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, storage } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';

const TABS = ['Tất cả', 'Hệ thống', 'Sự kiện', 'Công nghệ'];
const CAT_COLORS = {
    'Hệ thống': { c: '#EF4444', bg: '#FEF2F2' },
    'Sự kiện': { c: '#8B5CF6', bg: '#F5F3FF' },
    'Công nghệ': { c: '#D97706', bg: '#FFFBEB' },
    'Thông báo': { c: '#2563EB', bg: '#EFF6FF' },
};

function timeAgo(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    return `${Math.floor(h / 24)} ngày trước`;
}

// ── Upload ảnh ───────────────────────────────────────────────
// Web: Firebase Storage yêu cầu cấu hình CORS server-side (gsutil/Firebase CLI).
// Workaround: đọc blob → base64 data URL → lưu thẳng vào Firestore imageUrl.
// Native: upload bình thường lên Firebase Storage.
async function uploadImage(localUri, newsId) {
    if (Platform.OS === 'web') {
        const response = await fetch(localUri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result); // "data:image/jpeg;base64,..."
            reader.onerror = () => reject(new Error('Không đọc được ảnh'));
            reader.readAsDataURL(blob);
        });
    }
    // Native: Firebase Storage
    const ext = localUri.match(/\.(\w{2,5})(?:[?#]|$)/)?.[1]?.toLowerCase() || 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const ref = storageRef(storage, `news/${newsId}/cover.${ext}`);
    const response = await fetch(localUri);
    const blob = await response.blob();
    await uploadBytes(ref, blob, { contentType: mime });
    return getDownloadURL(ref);
}

// ── News Form Modal ───────────────────────────────────────────
function NewsFormModal({ visible, onClose, onSave, editItem }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('Hệ thống');
    const [notify, setNotify] = useState(false);
    const [saving, setSaving] = useState(false);
    const [imageUri, setImageUri] = useState(null); // local URI hoặc existing URL

    useEffect(() => {
        if (editItem) {
            setTitle(editItem.title || ''); setContent(editItem.content || '');
            setCategory(editItem.category || 'Hệ thống'); setNotify(false);
            setImageUri(editItem.imageUrl || null);
        } else {
            setTitle(''); setContent(''); setCategory('Hệ thống'); setNotify(false);
            setImageUri(null);
        }
    }, [editItem, visible]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: isWeb ? 0.5 : 0.8, // web: giảm quality để base64 nhỏ hơn (~50-150KB)
            allowsEditing: true,
            aspect: [16, 9],
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try { await onSave({ title, content, category, notify, imageUri }); onClose(); }
        catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={FM.overlay}>
                <View style={FM.modal}>
                    <View style={FM.header}>
                        <Text style={FM.headerTitle}>{editItem ? 'Sửa tin tức' : 'Thêm tin tức mới'}</Text>
                        <TouchableOpacity onPress={onClose} style={FM.closeBtn}>
                            <Ionicons name="close" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                        <View style={FM.body}>
                            <Text style={FM.label}>Tiêu đề *</Text>
                            <TextInput style={FM.input} value={title} onChangeText={setTitle} placeholder="Tiêu đề tin tức..." />
                            <Text style={FM.label}>Danh mục</Text>
                            <View style={FM.catRow}>
                                {['Hệ thống', 'Sự kiện', 'Công nghệ', 'Thông báo'].map(c => (
                                    <TouchableOpacity key={c}
                                        style={[FM.catBtn, category === c && FM.catBtnActive]}
                                        onPress={() => setCategory(c)}>
                                        <Text style={[FM.catBtnText, category === c && FM.catBtnTextActive]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {/* Ảnh bìa */}
                            <Text style={FM.label}>Ảnh bìa</Text>
                            <TouchableOpacity style={FM.imagePicker} onPress={pickImage}>
                                {imageUri ? (
                                    <>
                                        <Image source={{ uri: imageUri }} style={FM.imagePreview} resizeMode="cover" />
                                        <View style={FM.imageOverlay}>
                                            <Ionicons name="camera-outline" size={20} color="#fff" />
                                            <Text style={FM.imageOverlayText}>Đổi ảnh</Text>
                                        </View>
                                        <TouchableOpacity style={FM.imageRemove} onPress={() => setImageUri(null)}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <View style={FM.imageEmpty}>
                                        <Ionicons name="image-outline" size={28} color="#94A3B8" />
                                        <Text style={FM.imageEmptyText}>Chọn ảnh bìa</Text>
                                        <Text style={FM.imageEmptyHint}>Tỉ lệ 16:9 khuyến nghị</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <Text style={FM.label}>Nội dung</Text>
                            <TextInput style={[FM.input, { minHeight: 120, textAlignVertical: 'top', paddingTop: 10 }]}
                                value={content} onChangeText={setContent} placeholder="Nội dung tin tức..."
                                multiline numberOfLines={6} />
                            {/* Notify toggle */}
                            <TouchableOpacity style={FM.notifyRow} onPress={() => setNotify(p => !p)}>
                                <View style={[FM.toggle, notify && FM.toggleOn]}>
                                    <View style={[FM.toggleThumb, notify && FM.toggleThumbOn]} />
                                </View>
                                <View>
                                    <Text style={FM.notifyLabel}>🔔 Thông báo đến người dùng</Text>
                                    <Text style={FM.notifySub}>Gửi thông báo tới tất cả tài khoản đã xác minh</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                    <View style={FM.footer}>
                        <TouchableOpacity style={FM.cancelBtn} onPress={onClose}>
                            <Text style={FM.cancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={FM.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                            <Text style={FM.saveBtnText}>{editItem ? 'Lưu thay đổi' : 'Đăng tin'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const FM = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: '#fff', borderRadius: 16, width: isWeb ? 560 : '100%', maxHeight: '90%', overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    body: { padding: 20, gap: 4 },
    label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    catBtnActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
    catBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    catBtnTextActive: { color: '#fff' },
    imagePicker: { height: 160, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden', marginBottom: 4, position: 'relative' },
    imagePreview: { width: '100%', height: '100%' },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', gap: 4 },
    imageOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    imageRemove: { position: 'absolute', top: 8, right: 8 },
    imageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    imageEmptyText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    imageEmptyHint: { fontSize: 11, color: '#94A3B8' },
    notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
    toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1', padding: 2 },
    toggleOn: { backgroundColor: '#2563EB' },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    toggleThumbOn: { transform: [{ translateX: 20 }] },
    notifyLabel: { fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
    notifySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1E3A8A' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ── News Card ─────────────────────────────────────────────────
function NewsCard({ item, isAdmin, onEdit, onDelete, featured, onPress }) {
    const catCfg = CAT_COLORS[item.category] || { c: '#2563EB', bg: '#EFF6FF' };
    if (featured) return (
        <TouchableOpacity style={NC.featured} activeOpacity={0.9} onPress={onPress}>
            {item.imageUrl
                ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                : null}
            <View style={NC.featuredOverlay} />
            <View style={NC.featuredContent}>
                <View style={[NC.catBadge, { backgroundColor: catCfg.c }]}>
                    <Text style={NC.catBadgeText}>{item.category || 'Tin tức'}</Text>
                </View>
                <Text style={NC.featuredTitle}>{item.title}</Text>
                <Text style={NC.featuredSub} numberOfLines={2}>{item.content}</Text>
                <View style={NC.readBtn}>
                    <Text style={NC.readBtnText}>Đọc chi tiết →</Text>
                </View>
            </View>
            {isAdmin && (
                <View style={NC.adminBtns}>
                    <TouchableOpacity style={NC.aBtn} onPress={() => onEdit(item)}>
                        <Ionicons name="create-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[NC.aBtn, { backgroundColor: '#EF4444' }]} onPress={() => onDelete(item)}>
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <TouchableOpacity style={NC.card} activeOpacity={0.85} onPress={onPress}>
            <View style={[NC.catDot, { backgroundColor: catCfg.c }]} />
            {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={NC.thumb} resizeMode="cover" />
            )}
            <View style={NC.cardContent}>
                <View style={[NC.catChip, { backgroundColor: catCfg.bg }]}>
                    <Text style={[NC.catChipText, { color: catCfg.c }]}>{item.category || 'Tin tức'}</Text>
                </View>
                <Text style={NC.cardTime}>{timeAgo(item.createdAt)}</Text>
                <Text style={NC.cardTitle}>{item.title}</Text>
                <Text style={NC.cardBody} numberOfLines={2}>{item.content}</Text>
                <View style={NC.cardFooter}>
                    <View style={NC.detailBtn}>
                        <Text style={NC.detailBtnText}>Xem chi tiết</Text>
                        <Ionicons name="chevron-forward" size={13} color="#2563EB" />
                    </View>
                    {isAdmin && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity style={NC.editBtn} onPress={() => onEdit(item)}>
                                <Ionicons name="create-outline" size={13} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[NC.editBtn, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]} onPress={() => onDelete(item)}>
                                <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const NC = StyleSheet.create({
    featured: { height: 240, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: '#1E3A5F', justifyContent: 'flex-end' },
    featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
    featuredContent: { padding: 20 },
    catBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginBottom: 10 },
    catBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    featuredTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
    featuredSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19, marginBottom: 14 },
    readBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
    readBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    adminBtns: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 },
    aBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
    catDot: { width: 4 },
    thumb: { width: 90, height: '100%' },
    cardContent: { flex: 1, padding: 14 },
    catChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginBottom: 6 },
    catChipText: { fontSize: 10, fontWeight: '700' },
    cardTime: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6, lineHeight: 20 },
    cardBody: { fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 10 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    editBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
});

// ── Main ──────────────────────────────────────────────────────
export default function NewsScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const role = getRole(userDetail);
    const admin = role === 'admin';

    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Tất cả');
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);

    const fetchNews = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc')));
            setNews(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchNews(); }, []);

    const filtered = activeTab === 'Tất cả' ? news : news.filter(n => n.category === activeTab);
    const featured = filtered[0];
    const rest = filtered.slice(1);

    const handleSave = async ({ title, content, category, notify, imageUri }) => {
        if (editItem) {
            let imageUrl = editItem.imageUrl || null;
            // Nếu người dùng đổi ảnh mới: blob:/file: URI (native) hoặc blob: (web)
            // Bỏ qua nếu đang giữ nguyên ảnh cũ (http: hoặc data: từ lần upload trước)
            const isNewImage = imageUri && !imageUri.startsWith('http') && !imageUri.startsWith('data:');
            if (isNewImage) {
                imageUrl = await uploadImage(imageUri, editItem.id);
            } else if (!imageUri) {
                imageUrl = null;
            }
            await updateDoc(doc(db, 'news', editItem.id), { title, content, category, imageUrl, updatedAt: serverTimestamp() });
        } else {
            const docRef = await addDoc(collection(db, 'news'), {
                title, content, category, imageUrl: null,
                createdAt: serverTimestamp(),
                authorEmail: userDetail?.email,
                authorName: userDetail?.name,
            });
            // Upload ảnh sau khi có docId
            if (imageUri) {
                const imageUrl = await uploadImage(imageUri, docRef.id);
                await updateDoc(docRef, { imageUrl });
            }
            if (notify) {
                const usersSnap = await getDocs(query(collection(db, 'users')));
                await Promise.all(usersSnap.docs
                    .filter(d => d.data().email !== userDetail?.email && d.data().verified)
                    .map(d => createNotification({ userEmail: d.data().email, type: 'news', title: `📰 ${title}`, body: content?.slice(0, 80) || '', roomId: null, orderId: null }))
                );
            }
        }
        setEditItem(null);
        fetchNews();
    };

    const goToDetail = (item) =>
        router.push({ pathname: '/newsDetail/[newsId]', params: { newsId: item.id, newsData: encodeURIComponent(JSON.stringify(item)) } });

    const handleDelete = async (item) => {
        await deleteDoc(doc(db, 'news', item.id));
        fetchNews();
    };

    return (
        <View style={[N.root, { paddingTop: isWeb ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Top tabs */}
            <View style={N.topBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t} style={[N.tabBtn, activeTab === t && N.tabBtnActive]} onPress={() => setActiveTab(t)}>
                            <Text style={[N.tabBtnText, activeTab === t && N.tabBtnTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                {admin && (
                    <TouchableOpacity style={N.addBtn} onPress={() => { setEditItem(null); setModalOpen(true); }}>
                        <Ionicons name="add" size={16} color="#fff" />
                        <Text style={N.addBtnText}>Thêm tin</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={N.scroll}>
                    {featured && (
                        <NewsCard item={featured} isAdmin={admin} featured
                            onPress={() => goToDetail(featured)}
                            onEdit={i => { setEditItem(i); setModalOpen(true); }}
                            onDelete={handleDelete}
                        />
                    )}
                    <View style={N.sectionHeader}>
                        <Text style={N.sectionTitle}>Cập nhật mới nhất</Text>
                        <Text style={N.sectionSub}>Theo dõi các hoạt động và thông tin quan trọng</Text>
                    </View>
                    {rest.map(item => (
                        <NewsCard key={item.id} item={item} isAdmin={admin}
                            onPress={() => goToDetail(item)}
                            onEdit={i => { setEditItem(i); setModalOpen(true); }}
                            onDelete={handleDelete}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                            <Ionicons name="newspaper-outline" size={40} color="#CBD5E1" />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>Chưa có tin tức</Text>
                            {admin && <Text style={{ fontSize: 13, color: '#94A3B8' }}>Bấm "+ Thêm tin" để đăng tin đầu tiên</Text>}
                        </View>
                    )}
                    <View style={{ height: 80 }} />
                </ScrollView>
            )}

            <NewsFormModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} editItem={editItem} />
        </View>
    );
}

const N = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10 },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
    tabBtnActive: { backgroundColor: '#1E3A8A' },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    tabBtnTextActive: { color: '#fff' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexShrink: 0 },
    addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    scroll: { padding: isWeb ? 32 : 16 },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    sectionSub: { fontSize: 13, color: '#64748B', marginTop: 3 },
});