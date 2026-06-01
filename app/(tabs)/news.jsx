// app/(tabs)/news.jsx — Tin tức (admin CRUD + notification)

import BgWatermark from '@/components/Main/BgWatermark';
import { createNotification } from '@/components/Utils/chatService';
import { getRole } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
    addDoc, collection, deleteDoc, doc, getDocs, orderBy,
    query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Image,
    Modal,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, storage } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();
const MAX_IMAGE_BLOCKS = 5;

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

// ── Upload ───────────────────────────────────────────────────
// Web: compress blob/file URI → data: URI (stored directly in Firestore)
// Returns data: URI. If already a data: URI, passes through unchanged.
async function compressForWeb(uri) {
    if (uri.startsWith('data:')) return uri; // already compressed, reuse
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        const objUrl = URL.createObjectURL(blob);
        img.onload = () => {
            const MAX_W = 720;
            const r = Math.min(1, MAX_W / (img.width || 1));
            const w = Math.round(img.width * r);
            const h = Math.round(img.height * r);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.62));
        };
        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Không xử lý được ảnh')); };
        img.src = objUrl;
    });
}

// Native: upload to Firebase Storage → return download URL
async function uploadToStorage(localUri, storagePath) {
    const ext = localUri.match(/\.(\w{2,5})(?:[?#]|$)/)?.[1]?.toLowerCase() || 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const ref = storageRef(storage, storagePath);
    const response = await fetch(localUri);
    const blob = await response.blob();
    await uploadBytes(ref, blob, { contentType: mime });
    return getDownloadURL(ref);
}

// uploadBlocks: on web blocks are already data: URIs (pre-compressed on pick);
// on native, local file URIs get uploaded to Firebase Storage.
async function uploadBlocks(blocks, newsId) {
    return Promise.all(blocks.map(async (block, i) => {
        if (block.type !== 'image' || !block.value) return block;
        const uri = block.value;
        // data: and http: are already final — keep as-is
        if (uri.startsWith('data:') || uri.startsWith('http')) return block;
        // native local URI → Firebase Storage
        const url = await uploadToStorage(uri, `news/${newsId}/block_${i}.jpg`);
        return { ...block, value: url };
    }));
}

// ── Block Editor (top-level to prevent re-mount on parent re-render) ─────────
function BlockEditor({ blocks, moveBlock, pickBlockImage, updateBlock, removeBlock, addTextBlock, addImageBlock, imgCount }) {
    return (
        <>
            {blocks.map((block, idx) => (
                <View key={idx} style={FM.blockWrap}>
                    <View style={FM.blockBar}>
                        <View style={[FM.blockBadge, block.type === 'image' && FM.blockBadgeImg]}>
                            <Ionicons name={block.type === 'image' ? 'image-outline' : 'document-text-outline'} size={13} color={block.type === 'image' ? '#2563EB' : '#64748B'} />
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
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
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
                    <Ionicons name="image-outline" size={15} color={imgCount >= MAX_IMAGE_BLOCKS ? '#94A3B8' : '#2563EB'} />
                    <Text style={[FM.addBlockBtnText, { color: imgCount >= MAX_IMAGE_BLOCKS ? '#94A3B8' : '#2563EB' }]}>
                        Thêm ảnh {imgCount > 0 ? `(${imgCount}/${MAX_IMAGE_BLOCKS})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

// ── Cover Image Picker (top-level for same reason) ────────────
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

// ── News Form Modal ───────────────────────────────────────────
function NewsFormModal({ visible, onClose, onSave, editItem }) {
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
            if (editItem.blocks?.length) {
                setBlocks(editItem.blocks);
            } else {
                setBlocks([{ type: 'text', value: editItem.content || '' }]);
            }
        } else {
            setTitle(''); setCategory('Hệ thống'); setNotify(false);
            setImageUri(null); setImageModified(false);
            setTags(''); setHidden(false);
            setBlocks([{ type: 'text', value: '' }]);
        }
    }, [editItem, visible]);

    // pickImage: compress immediately on web so blob: URI doesn't expire before save
    const pickCoverImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,           // no pre-compress; we handle it
            allowsEditing: false, // no forced crop — display handles aspect ratio
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const uri = result.assets[0].uri;
            const final = isDesktop ? await compressForWeb(uri) : uri;
            setImageUri(final);
            setImageModified(true);
        }
    };

    const addTextBlock = () => setBlocks(b => [...b, { type: 'text', value: '' }]);

    const addImageBlock = async () => {
        if (blocks.filter(b => b.type === 'image').length >= MAX_IMAGE_BLOCKS) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], quality: 1, allowsEditing: false,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const uri = result.assets[0].uri;
            const final = isDesktop ? await compressForWeb(uri) : uri;
            setBlocks(b => [...b, { type: 'image', value: final }]);
        }
    };

    const pickBlockImage = async (idx) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], quality: 1, allowsEditing: false,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const uri = result.assets[0].uri;
            const final = isDesktop ? await compressForWeb(uri) : uri;
            setBlocks(b => b.map((bl, i) => i === idx ? { ...bl, value: final } : bl));
        }
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

    // ════════════════════════════════════════════════════════════
    // WEB: full-page 2-column layout
    // ════════════════════════════════════════════════════════════
    if (isDesktop) {
        return (
            <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
                <View style={WB.root}>
                    {/* Top bar */}
                    <View style={WB.topBar}>
                        <TouchableOpacity style={WB.backBtn} onPress={onClose} disabled={saving}>
                            <Ionicons name="arrow-back" size={18} color="#0F172A" />
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

                    {/* Body: 2-column */}
                    <View style={WB.body}>

                        {/* LEFT: main content */}
                        <ScrollView style={WB.mainScroll} showsVerticalScrollIndicator={false}
                            contentContainerStyle={WB.mainContent}>
                            {/* Title */}
                            <TextInput
                                style={WB.titleInput}
                                value={title} onChangeText={setTitle}
                                placeholder="Tiêu đề"
                                placeholderTextColor="#CBD5E1"
                            />

                            {/* Block content */}
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

                        {/* RIGHT: sidebar */}
                        <ScrollView style={WB.sidebar} showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* Visibility */}
                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Hiển thị</Text>
                                {[{ val: false, label: 'Hiển thị' }, { val: true, label: 'Ẩn' }].map(opt => (
                                    <TouchableOpacity key={String(opt.val)} style={WB.radioRow}
                                        onPress={() => setHidden(opt.val)}>
                                        <View style={[WB.radioOuter, hidden === opt.val && WB.radioOuterOn]}>
                                            {hidden === opt.val && <View style={WB.radioInner} />}
                                        </View>
                                        <Text style={WB.radioLabel}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Featured image */}
                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Hình đại diện</Text>
                                <CoverImagePicker
                                    imageUri={imageUri}
                                    onPick={pickCoverImage}
                                    onRemove={() => { setImageUri(null); setImageModified(true); }}
                                    style={{ height: 180 }}
                                />
                            </View>

                            {/* Category */}
                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Danh mục Blog</Text>
                                <View style={WB.catChips}>
                                    {['Hệ thống', 'Sự kiện', 'Công nghệ', 'Thông báo'].map(c => (
                                        <TouchableOpacity key={c}
                                            style={[WB.catChip, category === c && WB.catChipOn]}
                                            onPress={() => setCategory(c)}>
                                            <Text style={[WB.catChipText, category === c && WB.catChipTextOn]}>{c}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Tags */}
                            <View style={WB.sideCard}>
                                <Text style={WB.sideCardTitle}>Nhãn</Text>
                                <TextInput
                                    style={WB.tagsInput}
                                    value={tags} onChangeText={setTags}
                                    placeholder="nhãn1, nhãn2, nhãn3"
                                    placeholderTextColor="#CBD5E1"
                                />
                                <Text style={WB.tagsHint}>Phân cách bằng dấu phẩy</Text>
                            </View>

                            {/* Notify */}
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
                </View>
            </Modal>
        );
    }

    // ════════════════════════════════════════════════════════════
    // MOBILE: slide-up modal (unchanged)
    // ════════════════════════════════════════════════════════════
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

                            <Text style={FM.label}>Ảnh bìa</Text>
                            <CoverImagePicker
                                imageUri={imageUri}
                                onPick={pickCoverImage}
                                onRemove={() => { setImageUri(null); setImageModified(true); }}
                            />

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
        </Modal>
    );
}

const FM = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: '#fff', borderRadius: 16, width: isDesktop ? 580 : '100%', maxHeight: '92%', overflow: 'hidden' },
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
    // Cover image
    imagePicker: { height: 160, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden', marginBottom: 4, position: 'relative' },
    imagePreview: { width: '100%', height: '100%' },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', gap: 4 },
    imageOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    imageRemove: { position: 'absolute', top: 8, right: 8 },
    imageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    imageEmptyText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    imageEmptyHint: { fontSize: 11, color: '#94A3B8' },
    // Block editor
    blockWrap: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, overflow: 'hidden' },
    blockBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    blockBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: '#E2E8F0' },
    blockBadgeImg: { backgroundColor: '#DBEAFE' },
    blockBadgeText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
    blockCtrl: { flexDirection: 'row', gap: 2 },
    blockCtrlBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    blockTextInput: { minHeight: 80, margin: 10, padding: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14, color: '#0F172A', textAlignVertical: 'top' },
    blockImgPicker: { height: 140, margin: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden', position: 'relative' },
    blockImgPreview: { width: '100%', height: '100%' },
    // Add block buttons
    addBlockRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
    addBlockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 9, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    addBlockBtnImg: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    addBlockBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    // Notify
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

// ── Web 2-column layout styles ────────────────────────────────
const WB = StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F1F5F9' },
    // Top bar
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    topTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1E3A8A' },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // Body
    body: { flex: 1, flexDirection: 'row' },
    // Main (left)
    mainScroll: { flex: 1, backgroundColor: '#F1F5F9' },
    mainContent: { maxWidth: 780, alignSelf: 'center', width: '100%', padding: 32, paddingBottom: 60 },
    titleInput: { fontSize: 26, fontWeight: '700', color: '#0F172A', borderWidth: 0, borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 0, marginBottom: 28, backgroundColor: 'transparent', outlineStyle: 'none' },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
    // Sidebar (right)
    sidebar: { width: 290, borderLeftWidth: 1, borderLeftColor: '#E2E8F0', backgroundColor: '#fff' },
    sideCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    sideCardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
    // Visibility radio
    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
    radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
    radioOuterOn: { borderColor: '#2563EB' },
    radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563EB' },
    radioLabel: { fontSize: 13, color: '#374151' },
    // Category chips
    catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    catChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    catChipOn: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
    catChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    catChipTextOn: { color: '#fff' },
    // Tags
    tagsInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC' },
    tagsHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
    // Notify row in sidebar
    notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

// ── News Card ─────────────────────────────────────────────────
function NewsCard({ item, isAdmin, onEdit, onDelete, featured, onPress }) {
    const catCfg = CAT_COLORS[item.category] || { c: '#2563EB', bg: '#EFF6FF' };

    // Preview text: first text block or legacy content
    const previewText = item.blocks?.find(b => b.type === 'text')?.value || item.content || '';

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
                <Text style={NC.featuredSub} numberOfLines={2}>{previewText}</Text>
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
        <TouchableOpacity style={[NC.card, item.hidden && NC.cardHidden]} activeOpacity={0.85} onPress={onPress}>
            <View style={[NC.catDot, { backgroundColor: catCfg.c }]} />
            {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={NC.thumb} resizeMode="cover" />
            )}
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
    cardHidden: { opacity: 0.6 },
    hiddenBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
    hiddenBadgeText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
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

    useEffect(() => {
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

    // Non-admin users don't see hidden articles
    const visible = admin ? news : news.filter(n => !n.hidden);
    const filtered = activeTab === 'Tất cả' ? visible : visible.filter(n => n.category === activeTab);
    const featured = filtered[0];
    const rest = filtered.slice(1);

    // Resolve cover image URL:
    // - web: imageUri is already a data: URI (compressed on pick) → save directly
    // - native: imageUri is a local file URI → upload to Firebase Storage
    const resolveCoverUrl = async (imageUri, newsId) => {
        if (!imageUri) return null;
        if (imageUri.startsWith('data:') || imageUri.startsWith('http')) return imageUri;
        return uploadToStorage(imageUri, `news/${newsId}/cover.jpg`);
    };

    const handleSave = async ({ title, blocks, category, notify, imageUri, imageModified, tags = [], hidden = false }) => {
        if (editItem) {
            let imageUrl = editItem.imageUrl || null;
            if (imageModified) imageUrl = await resolveCoverUrl(imageUri, editItem.id);
            const uploadedBlocks = await uploadBlocks(blocks, editItem.id);
            await updateDoc(doc(db, 'news', editItem.id), {
                title, blocks: uploadedBlocks, category, imageUrl, tags, hidden,
                updatedAt: serverTimestamp(),
            });
        } else {
            const docRef = await addDoc(collection(db, 'news'), {
                title, blocks: [], category, imageUrl: null,
                createdAt: serverTimestamp(),
                authorEmail: userDetail?.email, authorName: userDetail?.name,
            });
            const imageUrl = await resolveCoverUrl(imageUri, docRef.id);
            const uploadedBlocks = await uploadBlocks(blocks, docRef.id);
            await updateDoc(docRef, { imageUrl, blocks: uploadedBlocks, tags, hidden });
            if (notify) {
                const firstText = blocks.find(b => b.type === 'text')?.value || '';
                const usersSnap = await getDocs(query(collection(db, 'users')));
                await Promise.all(usersSnap.docs
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

    const goToDetail = (item) =>
        router.push({ pathname: '/newsDetail/[newsId]', params: { newsId: item.id } });

    const handleDelete = async (item) => {
        await deleteDoc(doc(db, 'news', item.id));

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
    scroll: { padding: isDesktop ? 32 : 16 },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    sectionSub: { fontSize: 13, color: '#64748B', marginTop: 3 },
});
