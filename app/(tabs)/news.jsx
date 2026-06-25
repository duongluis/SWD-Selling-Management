// app/(tabs)/news.jsx

import BgWatermark from '@/components/Main/BgWatermark';
import { createNotification } from '@/components/Utils/chatService';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
    addDoc, collection, deleteDoc, doc, getDocs,
    onSnapshot,
    orderBy,
    query, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Image, Modal, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, storage } from '../../config/firebaseConfig';

// ── IMPORT HỆ THỐNG STYLES TIỆN ÍCH MỚI ──
import { showAlert } from '@/components/Main/showAlert';
import { useCardStyles } from '@/components/Styles/cardStyles';
import { THEME } from '@/components/Styles/theme';

const isWeb = Platform.OS === 'web';
const MAX_IMAGE_BLOCKS = 5;

const TABS = ['Tất cả', 'Hệ thống', 'Sự kiện', 'Công nghệ'];
const CAT_COLORS = {
    'Hệ thống': { c: THEME.colors.danger, bg: THEME.colors.dangerLight },
    'Sự kiện': { c: THEME.colors.purple, bg: THEME.colors.purpleLight },
    'Công nghệ': { c: THEME.colors.warning, bg: THEME.colors.warningLight },
    'Thông báo': { c: THEME.colors.primary, bg: THEME.colors.primaryLight },
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

// ── Helper chọn ảnh trả về data URI (tránh CORS trên web) ──
async function pickImageAsDataUri(options = {}) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
        base64: true,
        ...options,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];

    if (isWeb && asset.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        return `data:${mime};base64,${asset.base64}`;
    }
    // Native: trả về file URI bình thường
    return asset.uri;
}

// ── Upload lên Firebase Storage ──
async function uploadToStorage(localUri, storagePath) {
    const ref = storageRef(storage, storagePath);
    let blob;

    if (localUri.startsWith('data:')) {
        // Web: convert data URI to blob directly, no fetch needed
        const byteString = atob(localUri.split(',')[1]);
        const mimeType = localUri.split(',')[0].split(':')[1].split(';')[0];
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([byteArray], { type: mimeType });
    } else {
        // Native: fetch works fine for file:// URIs
        const response = await fetch(localUri);
        blob = await response.blob();
    }

    await uploadBytes(ref, blob, { contentType: blob.type || 'image/jpeg' });
    return getDownloadURL(ref);
}
async function uploadBlocks(blocks, newsId) {
    return Promise.all(blocks.map(async (block, i) => {
        if (block.type !== 'image' || !block.value) return block;
        const uri = block.value;
        if (uri.startsWith('http')) return block; // đã upload rồi, giữ nguyên
        const url = await uploadToStorage(uri, `news/${newsId}/block_${i}.jpg`);
        return { ...block, value: url };
    }));
}

// ── Bộ soạn thảo khối nội dung (Block Editor) ──
function BlockEditor({ blocks, moveBlock, pickBlockImage, updateBlock, removeBlock, addTextBlock, addImageBlock, imgCount }) {
    return (
        <>
            {blocks.map((block, idx) => (
                <View key={idx} style={FM.blockWrap}>
                    <View style={FM.blockBar}>
                        <View style={[FM.blockBadge, block.type === 'image' && FM.blockBadgeImg]}>
                            <Ionicons name={block.type === 'image' ? 'image-outline' : 'document-text-outline'} size={13} color={block.type === 'image' ? THEME.colors.primary : THEME.colors.textSecondary} />
                            <Text style={FM.blockBadgeText}>{block.type === 'image' ? 'Ảnh' : 'Văn bản'}</Text>
                        </View>
                        <View style={FM.blockCtrl}>
                            <TouchableOpacity style={FM.blockCtrlBtn} onPress={() => moveBlock(idx, -1)}>
                                <Ionicons name="chevron-up" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                            <TouchableOpacity style={FM.blockCtrlBtn} onPress={() => moveBlock(idx, 1)}>
                                <Ionicons name="chevron-down" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                            <TouchableOpacity style={FM.blockCtrlBtn} onPress={() => removeBlock(idx)}>
                                <Ionicons name="trash-outline" size={14} color={THEME.colors.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {block.type === 'text' ? (
                        <TextInput
                            style={FM.blockTextInput}
                            value={block.value}
                            onChangeText={v => updateBlock(idx, v)}
                            placeholder="Nhập nội dung văn bản..."
                            placeholderTextColor="#CBD5E1"
                            multiline
                        />
                    ) : (
                        <TouchableOpacity style={FM.blockImgPicker} onPress={() => pickBlockImage(idx)}>
                            {block.value
                                ? <Image source={{ uri: block.value }} style={FM.blockImgPreview} resizeMode="cover" />
                                : <View style={FM.imageEmpty}>
                                    <Ionicons name="image-outline" size={28} color="#94A3B8" />
                                    <Text style={FM.imageEmptyText}>Nhấn để chọn ảnh</Text>
                                </View>}
                            {block.value && (
                                <View style={[FM.imageOverlay, { alignItems: 'flex-end', justifyContent: 'flex-start', padding: 8 }]}>
                                    <Ionicons name="create-outline" size={18} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            ))}
            <View style={FM.addBlockRow}>
                <TouchableOpacity style={FM.addBlockBtn} onPress={addTextBlock}>
                    <Ionicons name="add" size={15} color="#374151" />
                    <Text style={FM.addBlockBtnText}>Thêm văn bản</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[FM.addBlockBtn, FM.addBlockBtnImg]}
                    onPress={addImageBlock}
                    disabled={imgCount >= MAX_IMAGE_BLOCKS}>
                    <Ionicons name="image-outline" size={15} color={imgCount >= MAX_IMAGE_BLOCKS ? '#94A3B8' : THEME.colors.primary} />
                    <Text style={[FM.addBlockBtnText, { color: imgCount >= MAX_IMAGE_BLOCKS ? '#94A3B8' : THEME.colors.primary }]}>
                        Thêm ảnh {imgCount > 0 ? `(${imgCount}/${MAX_IMAGE_BLOCKS})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

// ── Bộ chọn ảnh bìa ──
function CoverImagePicker({ imageUri, onPick, onRemove, style }) {
    return (
        <TouchableOpacity style={[FM.imagePicker, style]} onPress={onPick}>
            {imageUri ? (
                <>
                    <Image source={{ uri: imageUri }} style={FM.imagePreview} resizeMode="cover" />
                    <View style={FM.imageOverlay}>
                        <Ionicons name="camera" size={20} color="#fff" />
                        <Text style={FM.imageOverlayText}>Thay ảnh</Text>
                    </View>
                    <TouchableOpacity style={FM.imageRemove} onPress={onRemove}>
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}>
                            <Ionicons name="close" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={FM.imageEmpty}>
                    <Ionicons name="camera-outline" size={28} color="#94A3B8" />
                    <Text style={FM.imageEmptyText}>Thêm ảnh bìa</Text>
                    <Text style={FM.imageEmptyHint}>Nhấn để chọn ảnh</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

// ── Modal biên tập tin tức (Form Biên tập) ──
function NewsFormModal({ visible, onClose, onSave, editItem }) {
    const { isDesktop } = useCardStyles();

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Hệ thống');
    const [notify, setNotify] = useState(false);
    const [saving, setSaving] = useState(false);
    const [imageUri, setImageUri] = useState(null);
    const [imageModified, setImageModified] = useState(false);
    const [blocks, setBlocks] = useState([{ type: 'text', value: '' }]);
    const [tags, setTags] = useState('');
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (editItem) {
            setTitle(editItem.title || '');
            setCategory(editItem.category || 'Hệ thống');
            setNotify(false);
            setImageUri(editItem.imageUrl || null);
            setImageModified(false);
            setTags((editItem.tags || []).join(', '));
            setHidden(editItem.hidden || false);
            if (editItem.blocks?.length) setBlocks(editItem.blocks);
            else setBlocks([{ type: 'text', value: editItem.content || '' }]);
        } else {
            setTitle(''); setCategory('Hệ thống'); setNotify(false);
            setImageUri(null); setImageModified(false);
            setTags(''); setHidden(false);
            setBlocks([{ type: 'text', value: '' }]);
        }
    }, [editItem, visible]);

    // ✅ Dùng pickImageAsDataUri thay vì compressForWeb + fetch
    const pickCoverImage = async () => {
        const uri = await pickImageAsDataUri();
        if (uri) { setImageUri(uri); setImageModified(true); }
    };

    const addTextBlock = () => setBlocks(b => [...b, { type: 'text', value: '' }]);

    const addImageBlock = async () => {
        if (blocks.filter(b => b.type === 'image').length >= MAX_IMAGE_BLOCKS) return;
        const uri = await pickImageAsDataUri();
        if (uri) setBlocks(b => [...b, { type: 'image', value: uri }]);
    };

    const pickBlockImage = async (idx) => {
        const uri = await pickImageAsDataUri();
        if (uri) setBlocks(b => b.map((bl, i) => i === idx ? { ...bl, value: uri } : bl));
    };

    const updateBlock = (idx, value) => setBlocks(b => b.map((bl, i) => i === idx ? { ...bl, value } : bl));
    const removeBlock = (idx) => setBlocks(b => b.filter((_, i) => i !== idx));
    const moveBlock = (idx, dir) => setBlocks(b => {
        const arr = [...b];
        const t = idx + dir;
        if (t < 0 || t >= arr.length) return arr;
        [arr[idx], arr[t]] = [arr[t], arr[idx]];
        return arr;
    });

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);
        const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
        try { await onSave({ title, blocks, category, notify, imageUri, imageModified, tags: parsedTags, hidden }); onClose(); }
        catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const imgCount = blocks.filter(b => b.type === 'image').length;

    // ── GIAO DIỆN WEB BIÊN TẬP (Desktop Web) ──
    if (isDesktop) {
        return (
            <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
                <View style={WB.root}>
                    <View style={WB.topBar}>
                        <TouchableOpacity style={WB.backBtn} onPress={onClose} disabled={saving}>
                            <Ionicons name="arrow-back" size={18} color={THEME.colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={WB.topTitle}>{editItem ? 'Sửa bài viết' : 'Thêm bài đăng trên blog'}</Text>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={WB.cancelBtn} onPress={onClose} disabled={saving}>
                            <Text style={WB.cancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={WB.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="checkmark" size={15} color="#fff" />}
                            <Text style={WB.saveBtnText}>{saving ? 'Đang lưu...' : editItem ? 'Lưu thay đổi' : 'Đăng bài'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={WB.body}>
                        <ScrollView style={WB.mainScroll} showsVerticalScrollIndicator={true} contentContainerStyle={WB.mainContent}>
                            <TextInput
                                style={WB.titleInput}
                                value={title} onChangeText={setTitle}
                                placeholder="Tiêu đề"
                                placeholderTextColor="#CBD5E1"
                            />
                            <Text style={WB.sectionLabel}>Nội dung</Text>
                            <BlockEditor
                                blocks={blocks}
                                moveBlock={moveBlock}
                                pickBlockImage={pickBlockImage}
                                updateBlock={updateBlock}
                                removeBlock={removeBlock}
                                addTextBlock={addTextBlock}
                                addImageBlock={addImageBlock}
                                imgCount={imgCount}
                            />
                        </ScrollView>

                        <ScrollView style={WB.sidebar} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 40 }}>
                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Hiển thị</Text>
                                {[{ val: false, label: 'Hiển thị' }, { val: true, label: 'Ẩn' }].map(opt => (
                                    <TouchableOpacity key={String(opt.val)} style={WB.radioRow} onPress={() => setHidden(opt.val)}>
                                        <View style={[WB.radioOuter, hidden === opt.val && WB.radioOuterOn]}>
                                            {hidden === opt.val && <View style={WB.radioInner} />}
                                        </View>
                                        <Text style={WB.radioLabel}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Hình đại diện</Text>
                                <CoverImagePicker imageUri={imageUri} onPick={pickCoverImage} onRemove={() => { setImageUri(null); setImageModified(true); }} style={{ height: 180 }} />
                            </View>

                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Danh mục Blog</Text>
                                <View style={WB.catChips}>
                                    {['Hệ thống', 'Sự kiện', 'Công nghệ', 'Thông báo'].map(c => (
                                        <TouchableOpacity key={c} style={[WB.catChip, category === c && WB.catChipOn]} onPress={() => setCategory(c)}>
                                            <Text style={[WB.catChipText, category === c && WB.catChipTextOn]}>{c}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Nhãn</Text>
                                <TextInput style={WB.tagsInput} value={tags} onChangeText={setTags} placeholder="nhãn1, nhãn2, nhãn3" placeholderTextColor="#CBD5E1" />
                                <Text style={WB.tagsHint}>Phân cách bằng dấu phẩy</Text>
                            </View>

                            <View style={WB.sideCard}>
                                <TouchableOpacity style={WB.notifyRow} onPress={() => setNotify(p => !p)}>
                                    <View style={[FM.toggle, notify && FM.toggleOn]}>
                                        <View style={[FM.toggleThumb, notify && FM.toggleThumbOn]} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={FM.notifyLabel}>🔔 Thông báo người dùng</Text>
                                        <Text style={FM.notifySub}>Gửi tới tất cả tài khoản đã xác minh</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View >
            </Modal >
        );
    }

    // ── GIAO DIỆN DI ĐỘNG ──
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={FM.overlay}>
                <View style={FM.modal}>
                    <View style={FM.header}>
                        <Text style={FM.headerTitle}>{editItem ? 'Sửa tin tức' : 'Thêm tin tức mới'}</Text>
                        <TouchableOpacity onPress={onClose} style={FM.closeBtn}>
                            <Ionicons name="close" size={18} color={THEME.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1 }}>
                        <View style={FM.body}>
                            <Text style={FM.label}>Tiêu đề *</Text>
                            <TextInput style={FM.input} value={title} onChangeText={setTitle} placeholder="Tiêu đề tin tức..." />

                            <Text style={FM.label}>Danh mục</Text>
                            <View style={FM.catRow}>
                                {['Hệ thống', 'Sự kiện', 'Công nghệ', 'Thông báo'].map(c => (
                                    <TouchableOpacity key={c} style={[FM.catBtn, category === c && FM.catBtnActive]} onPress={() => setCategory(c)}>
                                        <Text style={[FM.catBtnText, category === c && FM.catBtnTextActive]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={FM.label}>Ảnh bìa</Text>
                            <CoverImagePicker imageUri={imageUri} onPick={pickCoverImage} onRemove={() => { setImageUri(null); setImageModified(true); }} />

                            <Text style={[FM.label, { marginTop: 16 }]}>Nội dung bài viết</Text>
                            <BlockEditor
                                blocks={blocks}
                                moveBlock={moveBlock}
                                pickBlockImage={pickBlockImage}
                                updateBlock={updateBlock}
                                removeBlock={removeBlock}
                                addTextBlock={addTextBlock}
                                addImageBlock={addImageBlock}
                                imgCount={imgCount}
                            />

                            <TouchableOpacity style={FM.notifyRow} onPress={() => setNotify(p => !p)}>
                                <View style={[FM.toggle, notify && FM.toggleOn]}>
                                    <View style={[FM.toggleThumb, notify && FM.toggleThumbOn]} />
                                </View>
                                <View style={{ flex: 1 }}>
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
                            <Text style={FM.saveBtnText}>{saving ? 'Đang lưu...' : editItem ? 'Lưu thay đổi' : 'Đăng tin'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal >
    );
}

// ── Thành phần Thẻ hiển thị tin tức (NewsCard) ──
function NewsCard({ item, isAdmin, onEdit, onDelete, featured, onPress }) {
    const catCfg = CAT_COLORS[item.category] || { c: THEME.colors.primary, bg: THEME.colors.primaryLight };
    const previewText = item.blocks?.find(b => b.type === 'text')?.value || item.content || '';

    if (featured) return (
        <TouchableOpacity style={NC.featured} activeOpacity={0.9} onPress={onPress}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
            <View style={NC.featuredOverlay} />
            <View style={NC.featuredContent}>
                <View style={[NC.catBadge, { backgroundColor: catCfg.c }]}>
                    <Text style={NC.catBadgeText}>{item.category || 'Tin tức'}</Text>
                </View>
                <Text style={NC.featuredTitle}>{item.title}</Text>
                <Text style={NC.featuredSub} numberOfLines={2}>{previewText}</Text>
                <View style={NC.readBtn}>
                    <Text style={NC.readBtnText}>Đọc chi tiết →</Text>
                </View>
            </View>
            {isAdmin && (
                <View style={NC.adminBtns}>
                    <TouchableOpacity style={NC.aBtn} onPress={(e) => { e.stopPropagation(); onEdit(item); }}>
                        <Ionicons name="create-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[NC.aBtn, { backgroundColor: THEME.colors.danger }]} onPress={(e) => { e.stopPropagation(); onDelete(item); }}>
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <TouchableOpacity style={[NC.card, item.hidden && NC.cardHidden]} activeOpacity={0.85} onPress={onPress}>
            <View style={[NC.catDot, { backgroundColor: catCfg.c }]} />
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={NC.thumb} resizeMode="cover" />}
            <View style={NC.cardContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <View style={[NC.catChip, { backgroundColor: catCfg.bg }]}>
                        <Text style={[NC.catChipText, { color: catCfg.c }]}>{item.category || 'Tin tức'}</Text>
                    </View>
                    {item.hidden && isAdmin && (
                        <View style={NC.hiddenBadge}><Text style={NC.hiddenBadgeText}>Ẩn</Text></View>
                    )}
                </View>
                <Text style={NC.cardTime}>{timeAgo(item.createdAt)}</Text>
                <Text style={NC.cardTitle}>{item.title}</Text>
                <Text style={NC.cardBody} numberOfLines={2}>{previewText}</Text>
                <View style={NC.cardFooter}>
                    <View style={NC.detailBtn}>
                        <Text style={NC.detailBtnText}>Xem chi tiết</Text>
                        <Ionicons name="chevron-forward" size={13} color={THEME.colors.primary} />
                    </View>
                    {isAdmin && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity style={NC.editBtn} onPress={(e) => { e.stopPropagation(); onEdit(item); }}>
                                <Ionicons name="create-outline" size={13} color={THEME.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[NC.editBtn, { backgroundColor: THEME.colors.dangerLight, borderColor: THEME.colors.dangerBorder }]} onPress={(e) => { e.stopPropagation(); onDelete(item); }}>
                                <Ionicons name="trash-outline" size={13} color={THEME.colors.danger} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ── Component chính màn hình Tin tức ──
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

    const { styles: cardStyles, isDesktop } = useCardStyles();

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setNews(snap.docs.map(d => ({ ...d.data(), id: d.id })));
            setLoading(false);
        }, (error) => {
            console.error("Lỗi đồng bộ tin tức:", error);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const visible = admin ? news : news.filter(n => !n.hidden);
    const filtered = activeTab === 'Tất cả' ? visible : visible.filter(n => n.category === activeTab);
    const featured = filtered[0];
    const rest = filtered.slice(1);

    const handleSave = async ({ title, blocks, category, notify, imageUri, imageModified, tags = [], hidden = false }) => {
        if (editItem) {
            let imageUrl = editItem.imageUrl || null;
            if (imageModified) {
                imageUrl = imageUri
                    ? await uploadToStorage(imageUri, `news/${editItem.id}/cover.jpg`)
                    : null;
            }
            const uploadedBlocks = await uploadBlocks(blocks, editItem.id);
            await updateDoc(doc(db, 'news', editItem.id), {
                title, blocks: uploadedBlocks, category, imageUrl, tags, hidden,
                updatedAt: serverTimestamp(),
            });
        } else {
            const docRef = await addDoc(collection(db, 'news'), {
                title,
                blocks: [],
                category,
                imageUrl: null,
                tags,
                hidden,
                createdAt: serverTimestamp(),
                authorEmail: userDetail?.email,
                authorName: userDetail?.name,
            });

            try {
                const [imageUrl, uploadedBlocks] = await Promise.all([
                    imageUri
                        ? uploadToStorage(imageUri, `news/${docRef.id}/cover.jpg`)
                        : Promise.resolve(null),
                    uploadBlocks(blocks, docRef.id),
                ]);
                await updateDoc(docRef, { imageUrl, blocks: uploadedBlocks, tags, hidden });
            } catch (uploadError) {
                console.error('Upload lỗi, rollback document:', uploadError);
                await deleteDoc(docRef).catch(() => { });
                throw uploadError;
            }

            if (notify) {
                const firstText = blocks.find(b => b.type === 'text')?.value || '';
                const usersSnap = await getDocs(query(collection(db, 'users')));
                await Promise.allSettled(
                    usersSnap.docs
                        .filter(d => d.data().email !== userDetail?.email && d.data().verified)
                        .map(d => createNotification({
                            userEmail: d.data().email, type: 'news',
                            title: `📰 ${title}`,
                            body: firstText.slice(0, 80),
                            roomId: null, orderId: null,
                        }))
                );
            }
        }
        setEditItem(null);
    };

    const goToDetail = (item) => router.push({ pathname: '/newsDetail/[newsId]', params: { newsId: item.id } });

    const handleDelete = (item) => {
        showAlert('Xác nhận xóa', `Bạn có chắc muốn xóa "${item.title}"?`, async () => {
            try { await deleteDoc(doc(db, 'news', item.id)); }
            catch (e) { console.error(e); }
        });
    };

    return (
        <View style={[N.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
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
                    <ActivityIndicator size="large" color={THEME.colors.primary} />
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={N.scroll} >
                    {featured && (
                        <NewsCard item={featured} isAdmin={admin} featured
                            onPress={() => goToDetail(featured)}
                            onEdit={i => { setEditItem(i); setModalOpen(true); }}
                            onDelete={() => handleDelete(featured)}
                        />
                    )}
                    <View style={N.sectionHeader}>
                        <Text style={N.sectionTitle}>Cập nhật mới nhất</Text>
                    </View>
                    {rest.map(item => (
                        <NewsCard key={item.id} item={item} isAdmin={admin}
                            onPress={() => goToDetail(item)}
                            onEdit={i => { setEditItem(i); setModalOpen(true); }}
                            onDelete={() => handleDelete(item)}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                            <Ionicons name="newspaper-outline" size={40} color="#CBD5E1" />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>Chưa có tin tức</Text>
                        </View>
                    )}
                </ScrollView>
            )
            }

            <NewsFormModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} editItem={editItem} />
        </View >
    );
}

// ── Styles ──
const FM = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: '#fff', borderRadius: THEME.radius.lg, width: '100%', maxHeight: '92%', overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
    headerTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.textPrimary },
    closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    body: { padding: 20, gap: 4 },
    label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: THEME.colors.textPrimary },
    catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: THEME.colors.border },
    catBtnActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
    catBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    catBtnTextActive: { color: '#fff' },
    imagePicker: { height: 160, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: THEME.colors.border, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 4, position: 'relative' },
    imagePreview: { width: '100%', height: '100%' },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', gap: 4 },
    imageOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    imageRemove: { position: 'absolute', top: 8, right: 8 },
    imageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    imageEmptyText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    imageEmptyHint: { fontSize: 11, color: '#94A3B8' },
    blockWrap: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, marginBottom: 10, overflow: 'hidden' },
    blockBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
    blockBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: '#E2E8F0' },
    blockBadgeImg: { backgroundColor: '#DBEAFE' },
    blockBadgeText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
    blockCtrl: { flexDirection: 'row', gap: 2 },
    blockCtrlBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    blockTextInput: { minHeight: 80, margin: 10, padding: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: THEME.colors.border, fontSize: 14, color: THEME.colors.textPrimary, textAlignVertical: 'top' },
    blockImgPicker: { height: 140, margin: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: THEME.colors.border, borderStyle: 'dashed', overflow: 'hidden', position: 'relative' },
    blockImgPreview: { width: '100%', height: '100%' },
    addBlockRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
    addBlockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 9, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: THEME.colors.border },
    addBlockBtnImg: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    addBlockBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
    toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1', padding: 2 },
    toggleOn: { backgroundColor: THEME.colors.primary },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    toggleThumbOn: { transform: [{ translateX: 20 }] },
    notifyLabel: { fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
    notifySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: THEME.colors.border },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1E3A8A' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const WB = StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F1F5F9' },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
    backBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    topTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textPrimary },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: THEME.colors.border },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1E3A8A' },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    body: { flex: 1, flexDirection: 'row' },
    mainScroll: { flex: 1, backgroundColor: '#F1F5F9' },
    mainContent: { maxWidth: 780, alignSelf: 'center', width: '100%', padding: 32, paddingBottom: 60 },
    titleInput: { fontSize: 26, fontWeight: '700', color: THEME.colors.textPrimary, borderWidth: 0, borderBottomWidth: 2, borderBottomColor: THEME.colors.border, paddingVertical: 12, paddingHorizontal: 0, marginBottom: 28, backgroundColor: 'transparent', outlineStyle: 'none' },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
    sidebar: { width: 290, borderLeftWidth: 1, borderLeftColor: THEME.colors.border, backgroundColor: '#fff' },
    sideCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
    sideCardTitle: { fontSize: 13, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 12 },
    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
    radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
    radioOuterOn: { borderColor: THEME.colors.primary },
    radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: THEME.colors.primary },
    radioLabel: { fontSize: 13, color: '#374151' },
    catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    catChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: THEME.colors.border },
    catChipOn: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
    catChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    catChipTextOn: { color: '#fff' },
    tagsInput: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: THEME.colors.textPrimary, backgroundColor: '#F8FAFC' },
    tagsHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
    notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

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
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.border, overflow: 'hidden' },
    cardHidden: { opacity: 0.6 },
    hiddenBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: THEME.colors.dangerLight, borderWidth: 1, borderColor: THEME.colors.dangerBorder },
    hiddenBadgeText: { fontSize: 10, fontWeight: '700', color: THEME.colors.danger },
    catDot: { width: 4 },
    thumb: { width: 90, height: '100%' },
    cardContent: { flex: 1, padding: 14 },
    catChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginBottom: 6 },
    catChipText: { fontSize: 10, fontWeight: '700' },
    cardTime: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 6, lineHeight: 20 },
    cardBody: { fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 10 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailBtnText: { fontSize: 12, fontWeight: '600', color: THEME.colors.primary },
    editBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: THEME.colors.primaryLight, borderWidth: 1, borderColor: THEME.colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
});

const N = StyleSheet.create({
    root: { flex: 1, backgroundColor: THEME.colors.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, gap: 10 },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
    tabBtnActive: { backgroundColor: '#1E3A8A' },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    tabBtnTextActive: { color: '#fff' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexShrink: 0 },
    addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    scroll: { padding: THEME.spacing.lg },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.textPrimary },
});