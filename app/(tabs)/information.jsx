import BgWatermark from '@/components/Main/BgWatermark';
import { showAlert } from '@/components/Main/showAlert';
import { showSuccess } from '@/components/Main/showSuccess';
import { useLayout } from '@/components/Main/TabScreenLayout';
import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Dimensions, FlatList, Modal,
    Platform,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { db } from '../../config/firebaseConfig';

// ── Role helpers ─────────────────────────────────────────────
const getRole = (u) => {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

const PRICE_LABELS = {
    price: { label: 'Giá niêm yết', color: '#64748B', bg: '#F1F5F9' },
    price_a: { label: 'Giá đại lý', color: '#2563EB', bg: '#EFF6FF' },
    price_p: { label: 'Giá đối tác', color: '#7C3AED', bg: '#F5F3FF' },
    price_c: { label: 'Giá CTV', color: '#059669', bg: '#ECFDF5' },
};

const getPriceFields = (role, hasAdvisor = false) => {
    if (hasAdvisor) return ['price'];
    return ({
        admin: ['price', 'price_a', 'price_p', 'price_c'],
        daily: ['price_a', 'price'],
        phantan: ['price_p', 'price'],
        ctv: ['price_c', 'price'],
    }[role] || ['price']);
};

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const parseMoney = (s) => parseInt(String(s).replace(/\D/g, '')) || 0;

const CATEGORY_COLORS = [
    { color: '#EC4899', bg: '#FDF2F8', icon: 'chatbubbles-outline' },
    { color: '#8B5CF6', bg: '#F5F3FF', icon: 'build-outline' },
    { color: '#F59E0B', bg: '#FFFBEB', icon: 'construct-outline' },
    { color: '#3B82F6', bg: '#EFF6FF', icon: 'water-outline' },
    { color: '#10B981', bg: '#ECFDF5', icon: 'car-outline' },
    { color: '#EF4444', bg: '#FEF2F2', icon: 'flash-outline' },
];
const getCategoryStyle = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

const COLOR_OPTIONS = [
    '#EC4899', '#F59E0B', '#8B5CF6', '#3B82F6',
    '#10B981', '#EF4444', '#64748B', '#0EA5E9',
];

// ── Input Row helper ─────────────────────────────────────────
function FormRow({ label, required, children }) {
    return (
        <View style={F.row}>
            <Text style={F.label}>
                {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
            </Text>
            {children}
        </View>
    );
}

// ── Shared Modal Wrapper ──────────────────────────────────────
function ModalWrapper({ visible, onClose, isDesktop, maxWidth = 680, children }) {
    if (isDesktop) {
        if (!visible) return null;
        return (
            <View style={F.webOverlay}>
                <View style={[F.webModal, { maxWidth }]}>{children}</View>
            </View>
        );
    }
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            {children}
        </Modal>
    );
}

// ── Create/Edit Product Modal ─────────────────────────────────
const PRODUCT_EMPTY = {
    name: '', capacity: '', technology: '', made_in: 'Việt Nam',
    price: '', price_a: '', price_p: '', price_c: '',
    water_source: '', water_certificate: '',
    electric_requirement: '220 Vac / 50-60Hz',
    using_electric_capacity: '', electric_capacity: '',
    sorting_tech: '', pipe_material: '', pipe_original: '',
    pipe_diameter: '', drain_pipe_diameter: '', drain_water: '',
    dimension: '', color: '', weight: '', life_style: '',
    guarantee: '', recommend_location: '',
};

function ProductModal({ visible, onClose, onSaved, existingCount, editData = null }) {
    const { isDesktop } = useLayout();
    const isEdit = !!editData;
    const [form, setForm] = useState(PRODUCT_EMPTY);
    const [saving, setSaving] = useState(false);

    // Load data khi edit
    useEffect(() => {
        if (editData) {
            setForm({
                ...PRODUCT_EMPTY,
                ...editData,
                price: editData.price ? String(editData.price) : '',
                price_a: editData.price_a ? String(editData.price_a) : '',
                price_p: editData.price_p ? String(editData.price_p) : '',
                price_c: editData.price_c ? String(editData.price_c) : '',
            });
        } else {
            setForm(PRODUCT_EMPTY);
        }
    }, [editData, visible]);

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const handleSave = async () => {
        if (!form.name.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên sản phẩm'); return; }
        if (!form.price) { showAlert('Thông báo', 'Vui lòng nhập giá niêm yết'); return; }
        setSaving(true);
        try {
            const payload = {
                id: isEdit ? editData.id : existingCount + 1,
                name: form.name.trim(),
                capacity: form.capacity.trim(),
                technology: form.technology.trim(),
                made_in: form.made_in.trim(),
                price: parseMoney(form.price),
                price_a: parseMoney(form.price_a),
                price_p: parseMoney(form.price_p),
                price_c: parseMoney(form.price_c),
                water_source: form.water_source.trim(),
                water_certificate: form.water_certificate.trim(),
                electric_requirement: form.electric_requirement.trim(),
                using_electric_capacity: form.using_electric_capacity.trim(),
                electric_capacity: form.electric_capacity.trim(),
                sorting_tech: form.sorting_tech.trim(),
                pipe_material: form.pipe_material.trim(),
                pipe_original: form.pipe_original.trim(),
                pipe_diameter: form.pipe_diameter.trim(),
                drain_pipe_diameter: form.drain_pipe_diameter.trim(),
                drain_water: form.drain_water.trim(),
                dimension: form.dimension.trim(),
                color: form.color.trim(),
                weight: form.weight.trim(),
                life_style: form.life_style.trim(),
                guarantee: form.guarantee.trim(),
                recommend_location: form.recommend_location.trim(),
            };
            // Xóa field rỗng
            Object.keys(payload).forEach(k => {
                if (payload[k] === '' || payload[k] === 0) delete payload[k];
            });
            payload.id = isEdit ? editData.id : existingCount + 1;

            const docName = isEdit ? (editData.docId || editData.name) : form.name.trim();
            await setDoc(doc(db, 'productPrice', docName), payload, { merge: true });

            showSuccess(
                isEdit ? 'Đã cập nhật sản phẩm!' : 'Đã tạo sản phẩm!',
                `${form.name.trim()}`,
                () => { }
            );
            onSaved({ ...payload, docId: docName });
            onClose();
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSaving(false); }
    };

    const InputBox = ({ fkey, placeholder, keyboardType = 'default', multiline = false }) => (
        <View style={[F.input, multiline && { minHeight: 72, alignItems: 'flex-start' }]}>
            <TextInput
                style={[F.inputText, multiline && { textAlignVertical: 'top' }]}
                placeholder={placeholder || ''}
                placeholderTextColor="#94A3B8"
                value={String(form[fkey] || '')}
                onChangeText={v => set(fkey, v)}
                keyboardType={keyboardType}
                multiline={multiline}
            />
        </View>
    );

    const MoneyInput = ({ fkey, label, color }) => (
        <View style={[F.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <View style={[F.moneyDot, { backgroundColor: color }]} />
            <TextInput
                style={[F.inputText, { flex: 1 }]}
                placeholder={label}
                placeholderTextColor="#94A3B8"
                value={form[fkey] ? String(form[fkey]) : ''}
                onChangeText={v => set(fkey, v.replace(/\D/g, ''))}
                keyboardType="numeric"
            />
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>đ</Text>
        </View>
    );

    const content = (
        <View style={F.modalInner}>
            <View style={F.modalHeader}>
                <View style={F.modalHeaderIcon}>
                    <Ionicons name="cube-outline" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={F.modalTitle}>{isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</Text>
                    <Text style={F.modalSub}>{isEdit ? `ID: #${editData?.id}` : `ID tự động: #${existingCount + 1}`}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={F.closeBtn}>
                    <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={F.scrollBody}>
                <Text style={F.section}>Thông tin cơ bản</Text>
                <FormRow label="Tên sản phẩm" required><InputBox fkey="name" placeholder="VD: Máy F3000A" /></FormRow>
                <FormRow label="Công suất lọc"><InputBox fkey="capacity" placeholder="VD: 3000 lít/giờ" /></FormRow>
                <FormRow label="Công nghệ"><InputBox fkey="technology" placeholder="VD: Golden Panthera" /></FormRow>
                <FormRow label="Xuất xứ"><InputBox fkey="made_in" placeholder="VD: Việt Nam" /></FormRow>
                <FormRow label="Nguồn nước xử lý"><InputBox fkey="water_source" placeholder="VD: Nước từ thủy cục" multiline /></FormRow>
                <FormRow label="Tiêu chuẩn nước"><InputBox fkey="water_certificate" placeholder="VD: QCVN 01/2018/BYT" multiline /></FormRow>

                <Text style={F.section}>Bảng giá</Text>
                <FormRow label="Giá niêm yết" required><MoneyInput fkey="price" label="Giá niêm yết" color="#64748B" /></FormRow>
                <FormRow label="Giá đại lý"><MoneyInput fkey="price_a" label="Giá đại lý" color="#2563EB" /></FormRow>
                <FormRow label="Giá đối tác"><MoneyInput fkey="price_p" label="Giá đối tác" color="#7C3AED" /></FormRow>
                <FormRow label="Giá CTV"><MoneyInput fkey="price_c" label="Giá CTV" color="#059669" /></FormRow>

                <Text style={F.section}>Thông số kỹ thuật</Text>
                <FormRow label="Điện áp"><InputBox fkey="electric_requirement" placeholder="220 Vac / 50-60Hz" /></FormRow>
                <FormRow label="Công suất lọc"><InputBox fkey="using_electric_capacity" placeholder="VD: 1,2 W" /></FormRow>
                <FormRow label="Công suất nghỉ"><InputBox fkey="electric_capacity" placeholder="VD: 0 W" /></FormRow>
                <FormRow label="Công nghệ màng"><InputBox fkey="sorting_tech" placeholder="VD: Ultra Filtration" /></FormRow>
                <FormRow label="Vật liệu màng"><InputBox fkey="pipe_material" placeholder="VD: PVC" /></FormRow>
                <FormRow label="Xuất xứ màng"><InputBox fkey="pipe_original" placeholder="VD: Trung Quốc" /></FormRow>
                <FormRow label="Đường kính ống v/r"><InputBox fkey="pipe_diameter" placeholder="VD: ¾ inch" /></FormRow>
                <FormRow label="Đường kính ống thải"><InputBox fkey="drain_pipe_diameter" placeholder="VD: 10 mm" /></FormRow>
                <FormRow label="Lượng nước thải"><InputBox fkey="drain_water" placeholder="VD: 0,2%" /></FormRow>

                <Text style={F.section}>Thông tin vật lý</Text>
                <FormRow label="Kích thước"><InputBox fkey="dimension" placeholder="VD: 45 x 30 x 14 (cm)" /></FormRow>
                <FormRow label="Màu sắc"><InputBox fkey="color" placeholder="VD: Ghi xám" /></FormRow>
                <FormRow label="Trọng lượng"><InputBox fkey="weight" placeholder="VD: 14 Kg" /></FormRow>
                <FormRow label="Tuổi thọ"><InputBox fkey="life_style" placeholder="VD: > 3 năm" /></FormRow>
                <FormRow label="Bảo hành"><InputBox fkey="guarantee" placeholder="VD: 12 tháng linh kiện" multiline /></FormRow>
                <FormRow label="Vị trí lắp đặt"><InputBox fkey="recommend_location" placeholder="VD: Trong nhà, dưới mái che" multiline /></FormRow>
                <View style={{ height: 16 }} />
            </ScrollView>

            <View style={F.modalFooter}>
                <TouchableOpacity style={F.cancelBtn} onPress={onClose}>
                    <Text style={F.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[F.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Ionicons name={saving ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
                    <Text style={F.saveBtnText}>{saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu sản phẩm'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ModalWrapper visible={visible} onClose={onClose} isDesktop={isDesktop} maxWidth={680}>
            {content}
        </ModalWrapper>
    );
}

// ── Create/Edit Service Modal ─────────────────────────────────
function ServiceModal({ visible, onClose, onSaved, existingCount, editData = null }) {
    const { isDesktop } = useLayout();
    const isEdit = !!editData;
    const [name, setName] = useState('');
    // const [price, setPrice] = useState('');
    const [color, setColor] = useState(COLOR_OPTIONS[0]);
    const [hasMachine, setHasMachine] = useState(false);
    const [canAddInOrder, setCanAddInOrder] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editData) {
            setName(editData.name || '');
            // setPrice(editData.price ? String(editData.price) : '');
            setColor(editData.color || COLOR_OPTIONS[0]);
            setHasMachine(editData.hasMachine || false);
            setCanAddInOrder(editData.canAddInOrder !== false);
        } else {
            setName('');
            // setPrice('');
            setColor(COLOR_OPTIONS[0]);
            setHasMachine(false); setCanAddInOrder(true);
        }
    }, [editData, visible]);

    const resetForm = () => {
        setName('');
        // setPrice('');
        setColor(COLOR_OPTIONS[0]);
        setHasMachine(false); setCanAddInOrder(true);
    };

    const handleClose = () => { resetForm(); onClose(); };

    const handleSave = async () => {
        if (!name.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên dịch vụ'); return; }
        // if (!price) { showAlert('Thông báo', 'Vui lòng nhập giá dịch vụ'); return; }
        setSaving(true);
        try {
            const payload = {
                id: isEdit ? editData.id : existingCount + 1,
                name: name.trim(),
                // price: parseMoney(price),    
                color,
                hasMachine,
                canAddInOrder,
            };
            const docName = isEdit ? (editData.docId || editData.name) : name.trim();
            await setDoc(doc(db, 'servicePrice', docName), payload, { merge: true });

            showSuccess(
                isEdit ? 'Đã cập nhật dịch vụ!' : 'Đã tạo dịch vụ!',
                `${name.trim()}`,
                () => { }
            );
            onSaved({ ...payload, docId: docName });
            handleClose();
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSaving(false); }
    };

    const content = (
        <View style={F.modalInner}>
            <View style={F.modalHeader}>
                <View style={[F.modalHeaderIcon, { backgroundColor: color + '22' }]}>
                    <Ionicons name="construct-outline" size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={F.modalTitle}>{isEdit ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}</Text>
                    <Text style={F.modalSub}>{isEdit ? `ID: #${editData?.id}` : `ID tự động: #${existingCount + 1}`}</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={F.closeBtn}>
                    <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={F.scrollBody}>
                <Text style={F.section}>Thông tin dịch vụ</Text>

                <FormRow label="Mã dịch vụ">
                    <View style={[F.input, { backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                        <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '600', flex: 1 }}>
                            #{isEdit ? editData?.id : existingCount + 1}
                        </Text>
                        <Ionicons name="lock-closed-outline" size={13} color="#CBD5E1" />
                    </View>
                </FormRow>

                <FormRow label="Tên dịch vụ" required>
                    <View style={F.input}>
                        <TextInput
                            style={F.inputText}
                            placeholder="VD: Bảo dưỡng định kỳ"
                            placeholderTextColor="#94A3B8"
                            value={name}
                            onChangeText={setName}
                            editable={!isEdit} // không cho đổi tên khi edit (là doc ID)
                        />
                    </View>
                    {isEdit && <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Tên dịch vụ không thể thay đổi sau khi tạo</Text>}
                </FormRow>

                {/* <FormRow label="Giá dịch vụ" required>
                    <View style={[F.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        <View style={[F.moneyDot, { backgroundColor: color }]} />
                        <TextInput
                            style={[F.inputText, { flex: 1 }]}
                            placeholder="Nhập số tiền..."
                            placeholderTextColor="#94A3B8"
                            value={price}
                            onChangeText={v => setPrice(v.replace(/\D/g, ''))}
                            keyboardType="numeric"
                        />
                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>đ</Text>
                    </View>
                </FormRow> */}

                <FormRow label="Màu hiển thị">
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {COLOR_OPTIONS.map(c => (
                            <TouchableOpacity
                                key={c}
                                onPress={() => setColor(c)}
                                activeOpacity={0.8}
                                style={{
                                    width: 32, height: 32, borderRadius: 16,
                                    backgroundColor: c, alignItems: 'center', justifyContent: 'center',
                                    borderWidth: color === c ? 2.5 : 0, borderColor: '#0F172A',
                                    shadowColor: c, shadowOpacity: color === c ? 0.5 : 0,
                                    shadowRadius: 6, elevation: color === c ? 4 : 0,
                                }}
                            >
                                {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </FormRow>

                <FormRow label="Yêu cầu máy">
                    <TouchableOpacity
                        onPress={() => setHasMachine(v => !v)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            backgroundColor: hasMachine ? color + '18' : '#F1F5F9',
                            paddingHorizontal: 12, paddingVertical: 10,
                            borderRadius: 8, borderWidth: 1,
                            borderColor: hasMachine ? color : '#E2E8F0',
                        }}
                    >
                        <Ionicons name={hasMachine ? 'checkbox' : 'square-outline'} size={18} color={hasMachine ? color : '#CBD5E1'} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: hasMachine ? color : '#94A3B8' }}>
                            {hasMachine ? 'Có — cần có máy' : 'Không cần máy'}
                        </Text>
                    </TouchableOpacity>
                </FormRow>

                <FormRow label="Thêm vào đơn hàng">
                    <TouchableOpacity
                        onPress={() => setCanAddInOrder(v => !v)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            backgroundColor: canAddInOrder ? color + '18' : '#F1F5F9',
                            paddingHorizontal: 12, paddingVertical: 10,
                            borderRadius: 8, borderWidth: 1,
                            borderColor: canAddInOrder ? color : '#E2E8F0',
                        }}
                    >
                        <Ionicons name={canAddInOrder ? 'checkbox' : 'square-outline'} size={18} color={canAddInOrder ? color : '#CBD5E1'} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: canAddInOrder ? color : '#94A3B8' }}>
                            {canAddInOrder ? 'Có — hiển thị trong đơn hàng' : 'Không hiển thị trong đơn hàng'}
                        </Text>
                    </TouchableOpacity>
                </FormRow>

                {name && (
                    // || price) && (

                    <View style={F.previewBox}>
                        <Text style={F.previewLabel}>Xem trước</Text>
                        <View style={[F.previewCard, { borderTopWidth: 3, borderTopColor: color }]}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="construct-outline" size={20} color={color} />
                            </View>
                            <View style={{ flex: 1, gap: 3 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{name || 'Tên dịch vụ...'}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {/* <Text style={{ fontSize: 13, color, fontWeight: '700' }}>{price ? fmt(parseMoney(price)) : 'Chưa có giá'}</Text> */}
                                    {hasMachine && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: color + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                            <Ionicons name="settings-outline" size={10} color={color} />
                                            <Text style={{ fontSize: 10, fontWeight: '700', color }}>Cần máy</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                )}
                <View style={{ height: 16 }} />
            </ScrollView>

            <View style={F.modalFooter}>
                <TouchableOpacity style={F.cancelBtn} onPress={handleClose}>
                    <Text style={F.cancelBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[F.saveBtn, { backgroundColor: color }, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Ionicons name={saving ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
                    <Text style={F.saveBtnText}>{saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu dịch vụ'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ModalWrapper visible={visible} onClose={handleClose} isDesktop={isDesktop} maxWidth={480}>
            {content}
        </ModalWrapper>
    );
}

// ── Form Styles ───────────────────────────────────────────────
const F = StyleSheet.create({
    webOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9999, alignItems: 'center', justifyContent: 'center' },
    webModal: { backgroundColor: '#fff', borderRadius: 20, width: '90%', maxHeight: '90%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 40 },
    modalInner: { flex: 1, backgroundColor: '#fff' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    scrollBody: { padding: 20 },
    section: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
    row: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 5 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    inputText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
    moneyDot: { width: 8, height: 8, borderRadius: 4 },
    modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: '#2563EB' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    previewBox: { marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    previewLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
    previewCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

// ── Product Detail Panel ──────────────────────────────────────
function ProductDetail({ product, priceFields, isAdmin, onClose, onEdit, onDelete }) {
    const specs = [
        { label: 'Nguồn nước xử lý', value: product.water_source },
        { label: 'Tiêu chuẩn nước', value: product.water_certificate },
        { label: 'Xuất xứ', value: product.made_in },
        { label: 'Công suất lọc', value: product.capacity },
        { label: 'Công nghệ', value: product.technology },
        { label: 'Hệ thống điều khiển', value: product.control_system },
        { label: 'Hệ thống giám sát', value: product.monitoring_system },
        { label: 'Điện áp', value: product.electric_requirement },
        { label: 'Công suất (lọc)', value: product.using_electric_capacity },
        { label: 'Công suất (nghỉ)', value: product.electric_capacity },
        { label: 'Công nghệ màng', value: product.sorting_tech },
        { label: 'Vật liệu màng', value: product.pipe_material },
        { label: 'Xuất xứ màng', value: product.pipe_original },
        { label: 'Đường kính ống v/r', value: product.pipe_diameter },
        { label: 'Đường kính ống thải', value: product.drain_pipe_diameter },
        { label: 'Lượng nước thải', value: product.drain_water },
        { label: 'Kích thước', value: product.dimension },
        { label: 'Màu sắc', value: product.color },
        { label: 'Trọng lượng', value: product.weight },
        { label: 'Tuổi thọ', value: product.life_style },
        { label: 'Bảo hành', value: product.guarantee },
        { label: 'Vị trí lắp đặt', value: product.recommend_location },
    ].filter(s => s.value);

    const features = [
        { key: 'has_music', label: 'Tích hợp M.U.S.I.C' },
        { key: 'has_filter_regen', label: 'Tái sinh màng lọc C.I.P' },
        { key: 'auto_detect', label: 'Tự động phát hiện & sửa lỗi' },
        { key: 'auto_trigger', label: 'Hoạt động theo kích bản' },
        { key: 'has_bypass', label: 'Tự động Bypass' },
        { key: 'realtime_monitoring', label: 'Giám sát chất lượng nước TG thực' },
        { key: 'smarthome_connect', label: 'Kết nối SmartHome / HMS' },
    ].filter(f => product[f.key]);

    return (
        <ScrollView style={D.root} contentContainerStyle={D.content} showsVerticalScrollIndicator={false}>
            <View style={D.header}>
                <TouchableOpacity onPress={onClose} style={D.backBtn}>
                    <Ionicons name="arrow-back" size={18} color="#64748B" />
                    <Text style={D.backText}>Quay lại</Text>
                </TouchableOpacity>

                {/* Nút sửa / xóa chỉ admin */}
                {isAdmin && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={D.editBtn} onPress={onEdit}>
                            <Ionicons name="create-outline" size={15} color="#2563EB" />
                            <Text style={D.editBtnText}>Chỉnh sửa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={D.deleteBtn} onPress={onDelete}>
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            <Text style={D.deleteBtnText}>Xóa</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={D.titleRow}>
                <View style={D.productIcon}><Ionicons name="water-outline" size={28} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={D.productName}>{product.name}</Text>
                    <Text style={D.productSub}>ID: {product.id} · {product.capacity}</Text>
                </View>
            </View>

            <View style={D.card}>
                <View style={D.cardHeader}><Ionicons name="pricetag-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Bảng giá</Text></View>
                <View style={D.priceGrid}>
                    {priceFields.map(field => {
                        const cfg = PRICE_LABELS[field];
                        return (
                            <View key={field} style={[D.priceCard, { backgroundColor: cfg.bg }]}>
                                <Text style={[D.priceLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                <Text style={[D.priceValue, { color: cfg.color }]}>{fmt(product[field])}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {specs.length > 0 && (
                <View style={D.card}>
                    <View style={D.cardHeader}><Ionicons name="list-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Thông số kỹ thuật</Text></View>
                    {specs.map((s, i) => (
                        <View key={i} style={[D.specRow, i % 2 === 0 && D.specRowAlt]}>
                            <Text style={D.specLabel}>{s.label}</Text>
                            <Text style={D.specValue}>{s.value}</Text>
                        </View>
                    ))}
                </View>
            )}

            {features.length > 0 && (
                <View style={D.card}>
                    <View style={D.cardHeader}><Ionicons name="star-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Tính năng đặc biệt</Text></View>
                    <View style={D.featureGrid}>
                        {features.map(f => (
                            <View key={f.key} style={D.featureItem}>
                                <View style={D.featureCheck}><Ionicons name="checkmark" size={12} color="#059669" /></View>
                                <Text style={D.featureText}>{f.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            <View style={{ height: 32 }} />
        </ScrollView>
    );
}

// ── Product List ──────────────────────────────────────────────
function ProductList({ products, priceFields, onSelect }) {
    const { isDesktop } = useLayout();
    return (
        <FlatList
            data={products}
            keyExtractor={item => String(item.id)}
            numColumns={isDesktop ? 3 : 1}
            key={isDesktop ? 'grid' : 'list'}
            columnWrapperStyle={isDesktop ? { gap: 14 } : undefined}
            contentContainerStyle={[{ paddingBottom: isDesktop ? 32 : 100 }, isDesktop && { gap: 14 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
                <TouchableOpacity style={[L.card, isDesktop && { flex: 1 }]} activeOpacity={0.7} onPress={() => onSelect(item)}>
                    <View style={L.cardTop}>
                        <View style={L.productIcon}><Ionicons name="water-outline" size={20} color="#2563EB" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={L.productName}>{item.name}</Text>
                            <Text style={L.productCapacity}>{item.capacity}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                    </View>
                    {item.technology && (
                        <View style={L.techBadge}><Text style={L.techBadgeText}>{item.technology}</Text></View>
                    )}
                    <View style={L.priceRow}>
                        {priceFields.slice(0, 2).map(field => {
                            const cfg = PRICE_LABELS[field];
                            return (
                                <View key={field} style={[L.pricePill, { backgroundColor: cfg.bg }]}>
                                    <Text style={[L.pricePillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                    <Text style={[L.pricePillValue, { color: cfg.color }]}>{fmt(item[field])}</Text>
                                </View>
                            );
                        })}
                    </View>
                    {priceFields.length > 2 && (
                        <View style={[L.priceRow, { marginTop: 6 }]}>
                            {priceFields.slice(2).map(field => {
                                const cfg = PRICE_LABELS[field];
                                return (
                                    <View key={field} style={[L.pricePill, { backgroundColor: cfg.bg }]}>
                                        <Text style={[L.pricePillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                        <Text style={[L.pricePillValue, { color: cfg.color }]}>{fmt(item[field])}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={L.empty}>
                    <Ionicons name="cube-outline" size={40} color="#CBD5E1" />
                    <Text style={L.emptyText}>Chưa có sản phẩm</Text>
                </View>
            }
        />
    );
}

// ── Service Category Grid ─────────────────────────────────────
function ServiceCategoryGrid({ services, isAdmin, onEdit, onDelete }) {
    const { isDesktop } = useLayout();
    if (services.length === 0) return (
        <View style={L.empty}>
            <Ionicons name="construct-outline" size={40} color="#CBD5E1" />
            <Text style={L.emptyText}>Chưa có dịch vụ nào</Text>
        </View>
    );

    return (
        <FlatList
            data={services}
            keyExtractor={item => String(item.id || item.docId)}
            numColumns={isDesktop ? 3 : 2}
            key={isDesktop ? 'svc-grid-web' : 'svc-grid-mobile'}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ paddingBottom: isDesktop ? 32 : 100, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
                const style = getCategoryStyle(index);
                return (
                    <View style={[SC.card, { flex: 1, borderTopColor: item.color }]}>
                        <View style={[SC.iconWrap, { backgroundColor: item.color + "22" }]}>
                            <Ionicons name={style.icon} size={28} color={item.color} />
                        </View>
                        <Text style={SC.categoryName}>{item.name}</Text>
                        {/* <View style={[SC.priceBadge, { backgroundColor: item.color + "22" }]}>
                            <Text style={[SC.priceLabel, { color: item.color }]}>Giá dịch vụ</Text>
                            <Text style={[SC.priceValue, { color: item.color }]}>{fmt(item.price)}</Text>
                        </View> */}

                        {/* Nút sửa / xóa chỉ admin */}
                        {isAdmin && (
                            <View style={SC.actionRow}>
                                <TouchableOpacity
                                    style={SC.editBtn}
                                    onPress={() => onEdit(item)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="create-outline" size={13} color="#2563EB" />
                                    <Text style={SC.editBtnText}>Sửa</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={SC.deleteBtn}
                                    onPress={() => onDelete(item)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                    <Text style={SC.deleteBtnText}>Xóa</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            }}
        />
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function InformationScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const isAdmin = role === 'admin';
    const hasAdvisor = userDetail?.advisor != null;
    const priceFields = getPriceFields(role, hasAdvisor);

    const [activeTab, setActiveTab] = useState('products');
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingServices, setLoadingServices] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Modal state
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // null = create, object = edit

    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'productPrice'), (snap) => {
            const list = snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => (a.id || 0) - (b.id || 0));
            setProducts(list);
            setLoadingProducts(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'servicePrice'), (snap) => {
            const list = snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                .sort((a, b) => (a.id || 0) - (b.id || 0));
            setServices(list);
            setLoadingServices(false);
        });
        return () => unsub();
    }, []);

    // ── Product handlers ──────────────────────────────────────
    const handleOpenCreateProduct = () => { setEditingProduct(null); setShowProductModal(true); };
    const handleOpenEditProduct = (p) => { setEditingProduct(p); setShowProductModal(true); };
    const handleProductSaved = (p) => {
        // onSnapshot tự update, chỉ cần sync selectedProduct nếu đang xem
        if (selectedProduct?.docId === p.docId) setSelectedProduct(p);
    };

    const handleDeleteProduct = (product) => {
        showAlert(
            'Xóa sản phẩm',
            `Bạn có chắc muốn xóa "${product.name}"? Hành động này không thể hoàn tác.`,
            async () => {
                try {
                    await deleteDoc(doc(db, 'productPrice', product.docId || product.name));
                    showSuccess('Đã xóa sản phẩm!', product.name, () => { });
                    setSelectedProduct(null);
                } catch (e) { showAlert('Lỗi', e.message); }
            }
        );
    };

    // ── Service handlers ──────────────────────────────────────
    const handleOpenCreateService = () => { setEditingService(null); setShowServiceModal(true); };
    const handleOpenEditService = (s) => { setEditingService(s); setShowServiceModal(true); };
    const handleServiceSaved = () => { }; // onSnapshot tự update

    const handleDeleteService = (service) => {
        showAlert(
            'Xóa dịch vụ',
            `Bạn có chắc muốn xóa dịch vụ "${service.name}"? Hành động này không thể hoàn tác.`,
            async () => {
                try {
                    await deleteDoc(doc(db, 'servicePrice', service.docId || service.name));
                    showSuccess('Đã xóa dịch vụ!', service.name, () => { });
                } catch (e) { showAlert('Lỗi', e.message); }
            }
        );
    };

    const handleTabChange = (key) => { setActiveTab(key); setSelectedProduct(null); };

    return (
        <View style={S.root}>
            <BgWatermark />

            {/* Product Modal (create + edit) */}
            <ProductModal
                visible={showProductModal}
                onClose={() => setShowProductModal(false)}
                onSaved={handleProductSaved}
                existingCount={products.length}
                editData={editingProduct}
            />

            {/* Service Modal (create + edit) */}
            <ServiceModal
                visible={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                onSaved={handleServiceSaved}
                existingCount={services.length}
                editData={editingService}
            />

            <View style={S.container}>
                {/* Header */}
                <View style={S.header}>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={S.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.TextPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={S.headerTitle}>Thông tin</Text>
                        <View style={S.roleBadge}>
                            <Text style={S.roleBadgeText}>
                                {{ admin: '👑 Quản trị viên', daily: '🏪 Đại lý', phantan: '🚚 Đối tác', ctv: '🤝 Cộng tác viên' }[role] || ''}
                            </Text>
                        </View>
                    </View>

                    {isAdmin && activeTab === 'products' && !selectedProduct && (
                        <TouchableOpacity style={S.createBtn} onPress={handleOpenCreateProduct}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={S.createBtnText}>Thêm sản phẩm</Text>
                        </TouchableOpacity>
                    )}
                    {isAdmin && activeTab === 'services' && (
                        <TouchableOpacity style={[S.createBtn, { backgroundColor: '#059669' }]} onPress={handleOpenCreateService}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={S.createBtnText}>Thêm dịch vụ</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View style={S.tabBar}>
                    {[
                        { key: 'products', label: 'Sản phẩm', icon: 'cube-outline', count: products.length },
                        { key: 'services', label: 'Dịch vụ', icon: 'construct-outline', count: services.length },
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[S.tab, activeTab === tab.key && S.tabActive]}
                            onPress={() => handleTabChange(tab.key)}
                        >
                            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#2563EB' : '#94A3B8'} />
                            <Text style={[S.tabText, activeTab === tab.key && S.tabTextActive]}>{tab.label}</Text>
                            {tab.count > 0 && (
                                <View style={S.tabBadge}>
                                    <Text style={S.tabBadgeText}>{tab.count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                <View style={S.content}>
                    {activeTab === 'products' && (
                        selectedProduct ? (
                            <ProductDetail
                                product={selectedProduct}
                                priceFields={priceFields}
                                isAdmin={isAdmin}
                                onClose={() => setSelectedProduct(null)}
                                onEdit={() => handleOpenEditProduct(selectedProduct)}
                                onDelete={() => handleDeleteProduct(selectedProduct)}
                            />
                        ) : (
                            <View style={S.listContainer}>
                                {loadingProducts ? (
                                    <View style={S.loadingWrap}>
                                        <ActivityIndicator size="large" color="#2563EB" />
                                        <Text style={S.loadingText}>Đang tải sản phẩm...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={S.listHeader}>
                                            <Text style={S.listCount}>{products.length} sản phẩm</Text>
                                        </View>
                                        <ProductList products={products} priceFields={priceFields} onSelect={setSelectedProduct} />
                                    </>
                                )}
                            </View>
                        )
                    )}

                    {activeTab === 'services' && (
                        <View style={S.listContainer}>
                            {loadingServices ? (
                                <View style={S.loadingWrap}>
                                    <ActivityIndicator size="large" color="#2563EB" />
                                    <Text style={S.loadingText}>Đang tải dịch vụ...</Text>
                                </View>
                            ) : (
                                <>
                                    <View style={S.listHeader}>
                                        <Text style={S.listCount}>{services.length} danh mục dịch vụ</Text>
                                    </View>
                                    <ServiceCategoryGrid
                                        services={services}
                                        isAdmin={isAdmin}
                                        onEdit={handleOpenEditService}
                                        onDelete={handleDeleteService}
                                    />
                                </>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: IS_WEB ? 0 : 44 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: IS_WEB ? 32 : 16, paddingVertical: IS_WEB ? 20 : 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
    headerTitle: { fontSize: IS_WEB ? 22 : 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    roleBadge: { marginTop: 2 },
    roleBadgeText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: IS_WEB ? 14 : 10, paddingVertical: 8, borderRadius: 10 },
    createBtnText: { fontSize: IS_WEB ? 13 : 12, fontWeight: '700', color: '#fff' },
    tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: IS_WEB ? 32 : 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 4 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#2563EB' },
    tabText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
    tabTextActive: { color: '#2563EB', fontWeight: '700' },
    tabBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
    content: { flex: 1 },
    listContainer: { flex: 1, paddingHorizontal: IS_WEB ? 32 : 16, paddingTop: 16 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    listCount: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
    loadingText: { fontSize: 14, color: '#94A3B8' },
});

const L = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    productIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    productCapacity: { fontSize: 12, color: '#64748B' },
    techBadge: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 10 },
    techBadgeText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    priceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    pricePill: { flex: 1, minWidth: 120, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
    pricePillLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
    pricePillValue: { fontSize: 13, fontWeight: '800' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 14, color: '#94A3B8' },
});

const SC = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderTopWidth: 3, alignItems: 'center', gap: 10 },
    iconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    categoryName: { fontSize: 14, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
    // priceBadge: { width: '100%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    // priceLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
    // priceValue: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
    actionRow: { flexDirection: 'row', gap: 8, width: '100%' },
    editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    editBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
    deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
});

const D = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { paddingHorizontal: IS_WEB ? 32 : 16, paddingTop: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: IS_WEB ? 32 : 16, paddingTop: 16, paddingBottom: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    backText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
    editBtnText: { fontSize: 13, color: '#2563EB', fontWeight: '700' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' },
    deleteBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '700' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: IS_WEB ? 32 : 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 16 },
    productIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    productSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: IS_WEB ? 20 : 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14, marginHorizontal: IS_WEB ? 32 : 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    priceCard: { flex: 1, minWidth: IS_WEB ? 160 : 140, padding: 14, borderRadius: 10 },
    priceLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    priceValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    specRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
    specRowAlt: { backgroundColor: '#F8FAFC', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 4 },
    specLabel: { width: IS_WEB ? 200 : 140, fontSize: 12, color: '#64748B', fontWeight: '500' },
    specValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '600' },
    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    featureCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
    featureText: { fontSize: 12, color: '#059669', fontWeight: '600' },
});