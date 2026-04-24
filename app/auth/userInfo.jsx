import Colors from '@/constant/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform,
    ScrollView, StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import { db } from '../../config/firebaseConfig';
import { clearRegistrationPending } from '../_layout';

const isWeb = Platform.OS === 'web';

const ROLES = [
    { key: 'đại lý', label: 'Đại lý', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF', desc: 'Phân phối trực tiếp tới khách hàng cuối', advisor: false, extraFields: true },
    { key: 'Đối tác', label: 'Đối tác', icon: 'car-outline', color: '#7C3AED', bg: '#F5F3FF', desc: 'Bán hàng trong khu vực lớn', advisor: false },
    { key: 'cộng tác viên', label: 'Cộng tác viên', icon: 'people-outline', color: '#059669', bg: '#ECFDF5', desc: 'Giới thiệu và hỗ trợ bán hàng theo hoa hồng', advisor: false },
];

const ADVISOR_ROLES = {};
const COMMITTED_REVENUE_MIN = 100_000_000; // 100 triệu VNĐ
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706'];

export default function UserInfoView() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedAdvisor, setSelectedAdvisor] = useState(null);
    const [advisorList, setAdvisorList] = useState([]);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [showAdvisorDrop, setShowAdvisorDrop] = useState(false);
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ── Đại lý extra fields ───────────────────────────────────
    const [committedRevenue, setCommittedRevenue] = useState('');
    const [revenueError, setRevenueError] = useState('');
    const [revenueTouched, setRevenueTouched] = useState(false);
    const [showAreaPicker, setShowAreaPicker] = useState(false);
    const [regions, setRegions] = useState([]);   // [{id, name}]
    const [regionsLoading, setRegionsLoading] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(null); // {id, name}
    const [showRegionDrop, setShowRegionDrop] = useState(false);
    const [provinces, setProvinces] = useState([]);   // string[]
    const [provincesLoading, setProvincesLoading] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState('');
    const [showProvinceDrop, setShowProvinceDrop] = useState(false);
    const [provinceSearch, setProvinceSearch] = useState('');

    const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

    const handleSignOut = async () => {
        try {
            const authInstance = getAuth();
            const user = authInstance.currentUser;
            // ✅ Xóa cờ session trước
            clearRegistrationPending();
            // ✅ Navigate TRƯỚC khi delete/signOut để route guard không can thiệp
            router.replace('/auth/signIn');
            // ✅ Xóa tài khoản Firebase Auth (tài khoản chưa hoàn thành đăng ký)
            if (user) {
                await user.delete(); // xóa hẳn, không chỉ sign out
            }
        } catch (e) {
            console.error('Lỗi xóa tài khoản:', e);
        }
    };

    // ── Fetch regions from db/province ───────────────────────
    // Cấu trúc: province/{regionId} → { name: string, cities: string[] }
    const fetchRegions = async () => {
        if (regions.length > 0) return;
        setRegionsLoading(true);
        try {
            const snap = await getDocs(collection(db, 'province'));
            setRegions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setRegionsLoading(false); }
    };

    const handleSelectRegion = (region) => {
        setSelectedRegion(region);
        setSelectedProvince('');
        setShowRegionDrop(false);
        // cities là [{id, ten}] → lấy chỉ tên để hiển thị và lưu
        setProvinces((region.cities || []).map(c => c.ten));
    };

    const handleToggleArea = () => {
        const next = !showAreaPicker;
        setShowAreaPicker(next);
        if (next) fetchRegions();
        else { setSelectedRegion(null); setSelectedProvince(''); }
    };

    // ── Revenue input handler ─────────────────────────────────
    const handleRevenueChange = (text) => {
        const raw = text.replace(/\D/g, '');
        setCommittedRevenue(raw);
        setRevenueError(''); // xóa lỗi khi đang nhập
    };

    const handleRevenueBlur = () => {
        setRevenueTouched(true);
        const num = parseInt(committedRevenue) || 0;
        if (num > 0 && num < COMMITTED_REVENUE_MIN) {
            setRevenueError(`Tối thiểu ${fmt(COMMITTED_REVENUE_MIN)}`);
        } else {
            setRevenueError('');
        }
    };

    // ── Role select ───────────────────────────────────────────
    const handleSelectRole = async (roleKey) => {
        setSelectedRole(roleKey);
        setSelectedAdvisor(null);
        setAdvisorSearch('');
        setShowAdvisorDrop(false);
        // Reset đại lý extra fields
        setCommittedRevenue(''); setRevenueError('');
        setShowAreaPicker(false); setSelectedRegion(null); setSelectedProvince('');

        const roleCfg = ROLES.find(r => r.key === roleKey);
        if (!roleCfg?.advisor) { setAdvisorList([]); return; }
        const allowedRoles = ADVISOR_ROLES[roleKey] || [];
        if (!allowedRoles.length) return;
        setAdvisorLoading(true);
        try {
            const snaps = await Promise.all(allowedRoles.map(r =>
                getDocs(query(collection(db, 'users'), where('role', 'in', [r]), where('verified', '==', true)))
            ));
            const users = [];
            snaps.forEach(snap => snap.docs.forEach(d => {
                const u = d.data();
                if (u.email) users.push({ email: u.email, name: u.name || u.email, role: u.role || u.member });
            }));
            setAdvisorList(users);
        } catch (e) { console.error(e); }
        finally { setAdvisorLoading(false); }
    };

    const filteredAdvisors = advisorList.filter(u =>
        (u.name || '').toLowerCase().includes(advisorSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(advisorSearch.toLowerCase())
    );
    const filteredProvinces = provinces.filter(p =>
        p.toLowerCase().includes(provinceSearch.toLowerCase())
    );

    const needsAdvisor = ROLES.find(r => r.key === selectedRole)?.advisor === true;
    const isDaiLy = selectedRole === 'đại lý';

    // ── Submit ────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!form.name.trim()) { showAlert('Thông báo', 'Vui lòng nhập họ và tên'); return; }
        if (!form.phone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return; }
        if (!selectedRole) { showAlert('Thông báo', 'Vui lòng chọn vị trí'); return; }
        if (needsAdvisor && !selectedAdvisor) { showAlert('Thông báo', 'Vui lòng chọn đại lý / Đối tác quản lý'); return; }

        if (isDaiLy) {
            const rev = parseInt(committedRevenue) || 0;
            if (!rev) { showAlert('Thông báo', 'Vui lòng nhập doanh thu cam kết'); return; }
            if (rev < COMMITTED_REVENUE_MIN) { showAlert('Thông báo', `Doanh thu tối thiểu là ${fmt(COMMITTED_REVENUE_MIN)}`); return; }
        }

        setSubmitting(true);
        try {
            const auth = getAuth();
            const email = auth.currentUser?.email;
            if (!email) throw new Error('Không tìm thấy tài khoản. Vui lòng đăng ký lại.');

            const payload = {
                uid: auth.currentUser.uid,
                email,
                name: form.name.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                note: form.note.trim(),
                role: selectedRole,
                member: selectedRole,
                advisor: selectedAdvisor?.email || null,
                verified: false,
                createdAt: new Date().toISOString(),
            };

            if (isDaiLy) {
                payload.committedRevenue = parseInt(committedRevenue) || 0;
                if (showAreaPicker && selectedRegion) {
                    payload.region = selectedRegion.id;
                    payload.regionName = selectedRegion.name;
                    payload.province = selectedProvince || null;
                }
            }

            await setDoc(doc(db, 'users', email), payload);
            clearRegistrationPending(); // ← đăng ký hoàn tất, xóa cờ
            router.replace('/auth/pendingVerification');
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSubmitting(false); }
    };

    // ── Role Card ─────────────────────────────────────────────
    const RoleCard = ({ role }) => {
        const active = selectedRole === role.key;
        return (
            <TouchableOpacity
                style={[styles.roleCard, active && { borderColor: role.color, backgroundColor: role.bg }]}
                onPress={() => handleSelectRole(role.key)} activeOpacity={0.7}
            >
                <View style={[styles.roleIcon, { backgroundColor: active ? role.color + '22' : '#F1F5F9' }]}>
                    <Ionicons name={role.icon} size={22} color={active ? role.color : '#94A3B8'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, active && { color: role.color }]}>{role.label}</Text>
                    <Text style={styles.roleDesc}>{role.desc}</Text>
                </View>
                <View style={[styles.roleCheck, active && { backgroundColor: role.color, borderColor: role.color }]}>
                    {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    // ── Đại lý Extra Fields ───────────────────────────────────
    // ── Đại lý extra fields — JSX variable, KHÔNG phải inner component
    // (inner component bị re-create mỗi render → TextInput mất focus)
    const rev = parseInt(committedRevenue) || 0;

    const dailyFieldsJSX = (ws) => !isDaiLy ? null : (
        <View style={ws ? W.extraSection : styles.extraSection}>
            <View style={ws ? W.extraHeader : styles.extraHeader}>
                <Ionicons name="trending-up-outline" size={15} color="#2563EB" />
                <Text style={ws ? W.extraTitle : styles.extraTitle}>Thông tin đại lý</Text>
            </View>

            {/* Doanh thu cam kết */}
            <View style={ws ? W.inputGroup : styles.inputGroup}>
                <Text style={ws ? W.label : styles.label}>
                    Doanh thu cam kết (năm) <Text style={ws ? W.required : styles.required}>*</Text>
                </Text>
                <Text style={ws ? W.labelSub : styles.labelSub}>Tối thiểu {fmt(COMMITTED_REVENUE_MIN)}</Text>
                <View style={[ws ? W.inputBox : styles.inputBox, revenueError && { borderColor: '#EF4444' }]}>
                    <Ionicons name="cash-outline" size={15} color={revenueError ? '#EF4444' : '#94A3B8'} />
                    <TextInput
                        style={ws ? W.input : styles.input}
                        placeholder="Nhập số tiền (VNĐ)..."
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={committedRevenue ? parseInt(committedRevenue).toLocaleString('vi-VN') : ''}
                        onChangeText={handleRevenueChange}
                        onBlur={handleRevenueBlur}
                    />
                    {revenueTouched && rev > 0 && (
                        <Text style={{ fontSize: 11, color: rev >= COMMITTED_REVENUE_MIN ? '#059669' : '#EF4444', fontWeight: '600' }}>
                            {fmt(rev)}
                        </Text>
                    )}
                </View>
                {revenueError ? <Text style={ws ? W.errorText : styles.errorText}>{revenueError}</Text> : null}
            </View>

            {/* Khu vực — optional, toggle */}
            <View style={ws ? W.areaToggleRow : styles.areaToggleRow}>
                <View style={{ flex: 1 }}>
                    <Text style={ws ? W.areaToggleLabel : styles.areaToggleLabel}>Chọn khu vực phụ trách</Text>
                    <Text style={ws ? W.areaToggleSub : styles.areaToggleSub}>Tuỳ chọn</Text>
                </View>
                <TouchableOpacity
                    style={[ws ? W.toggleSwitch : styles.toggleSwitch, showAreaPicker && (ws ? W.toggleOn : styles.toggleOn)]}
                    onPress={handleToggleArea} activeOpacity={0.8}
                >
                    <View style={[ws ? W.toggleThumb : styles.toggleThumb, showAreaPicker && (ws ? W.toggleThumbOn : styles.toggleThumbOn)]} />
                </TouchableOpacity>
            </View>

            {showAreaPicker && (
                <View style={ws ? W.areaFields : styles.areaFields}>
                    {/* Region picker */}
                    <View style={ws ? W.inputGroup : styles.inputGroup}>
                        <Text style={ws ? W.label : styles.label}>Vùng / Miền</Text>
                        <TouchableOpacity
                            style={[ws ? W.inputBox : styles.inputBox, showRegionDrop && { borderColor: '#2563EB' }]}
                            onPress={() => setShowRegionDrop(p => !p)} activeOpacity={0.8}
                        >
                            <Ionicons name="map-outline" size={15} color="#94A3B8" />
                            <Text style={selectedRegion ? [ws ? W.input : styles.input] : [ws ? W.inputPlaceholder : styles.inputPlaceholder]}>
                                {selectedRegion?.name || 'Chọn vùng / miền...'}
                            </Text>
                            <Ionicons name={showRegionDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                        </TouchableOpacity>
                        {showRegionDrop && (
                            <View style={styles.dropdownBox}>
                                {regionsLoading
                                    ? <Text style={styles.dropdownEmpty}>Đang tải...</Text>
                                    : regions.length === 0
                                        ? <Text style={styles.dropdownEmpty}>Chưa có dữ liệu vùng miền</Text>
                                        : regions.map(r => (
                                            <TouchableOpacity key={r.id}
                                                style={[styles.dropdownItem, selectedRegion?.id === r.id && styles.dropdownItemActive]}
                                                onPress={() => handleSelectRegion(r)} activeOpacity={0.7}
                                            >
                                                <Ionicons name="location-outline" size={13} color={selectedRegion?.id === r.id ? '#2563EB' : '#94A3B8'} />
                                                <Text style={[styles.dropdownItemText, selectedRegion?.id === r.id && { color: '#2563EB', fontWeight: '700' }]}>{r.name}</Text>
                                                {selectedRegion?.id === r.id && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                            </TouchableOpacity>
                                        ))
                                }
                            </View>
                        )}
                    </View>

                    {/* Province picker */}
                    {selectedRegion && (
                        <View style={ws ? W.inputGroup : styles.inputGroup}>
                            <Text style={ws ? W.label : styles.label}>Tỉnh / Thành phố</Text>
                            <TouchableOpacity
                                style={[ws ? W.inputBox : styles.inputBox, showProvinceDrop && { borderColor: '#2563EB' }]}
                                onPress={() => setShowProvinceDrop(p => !p)} activeOpacity={0.8}
                            >
                                <Ionicons name="business-outline" size={15} color="#94A3B8" />
                                <Text style={selectedProvince ? [ws ? W.input : styles.input] : [ws ? W.inputPlaceholder : styles.inputPlaceholder]}>
                                    {selectedProvince || 'Chọn tỉnh / thành phố...'}
                                </Text>
                                <Ionicons name={showProvinceDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                            </TouchableOpacity>
                            {showProvinceDrop && (
                                <View style={styles.dropdownBox}>
                                    <View style={styles.dropdownSearch}>
                                        <Ionicons name="search-outline" size={13} color="#94A3B8" />
                                        <TextInput style={styles.dropdownSearchInput} placeholder="Tìm tỉnh thành..." placeholderTextColor="#94A3B8" value={provinceSearch} onChangeText={setProvinceSearch} />
                                    </View>
                                    <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                                        {filteredProvinces.length === 0
                                            ? <Text style={styles.dropdownEmpty}>{provinceSearch ? 'Không tìm thấy' : 'Chưa có dữ liệu'}</Text>
                                            : filteredProvinces.map(p => (
                                                <TouchableOpacity key={p}
                                                    style={[styles.dropdownItem, selectedProvince === p && styles.dropdownItemActive]}
                                                    onPress={() => { setSelectedProvince(p); setShowProvinceDrop(false); setProvinceSearch(''); }} activeOpacity={0.7}
                                                >
                                                    <Ionicons name="location-outline" size={13} color={selectedProvince === p ? '#2563EB' : '#94A3B8'} />
                                                    <Text style={[styles.dropdownItemText, selectedProvince === p && { color: '#2563EB', fontWeight: '700' }]}>{p}</Text>
                                                    {selectedProvince === p && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                                </TouchableOpacity>
                                            ))
                                        }
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );

    // ── Advisor Picker ────────────────────────────────────────
    const AdvisorPicker = () => {
        if (!needsAdvisor) return null;
        const roleCfg = ROLES.find(r => r.key === selectedRole);
        return (
            <View style={styles.advisorSection}>
                <View style={styles.advisorHeader}>
                    <Ionicons name="person-circle-outline" size={16} color={roleCfg?.color || '#2563EB'} />
                    <Text style={[styles.advisorHeaderText, { color: roleCfg?.color || '#2563EB' }]}>
                        Chọn đại lý / Đối tác quản lý <Text style={{ color: '#EF4444' }}>*</Text>
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.advisorTrigger, showAdvisorDrop && { borderColor: roleCfg?.color }]}
                    onPress={() => setShowAdvisorDrop(p => !p)} activeOpacity={0.8}
                >
                    {selectedAdvisor ? (
                        <View style={styles.advisorSelected}>
                            <View style={[styles.advisorAvatar, { backgroundColor: roleCfg?.color || '#2563EB' }]}>
                                <Text style={styles.advisorAvatarText}>{getInitials(selectedAdvisor.name)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.advisorSelectedName}>{selectedAdvisor.name}</Text>
                                <Text style={styles.advisorSelectedEmail}>{selectedAdvisor.email}</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setSelectedAdvisor(null); setShowAdvisorDrop(false); }}>
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <Ionicons name="search-outline" size={15} color="#94A3B8" />
                            <Text style={styles.advisorPlaceholder}>Tìm và chọn người quản lý...</Text>
                            <Ionicons name={showAdvisorDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                        </>
                    )}
                </TouchableOpacity>
                {showAdvisorDrop && (
                    <View style={styles.advisorDropdown}>
                        <View style={styles.advisorSearchBox}>
                            <Ionicons name="search-outline" size={14} color="#94A3B8" />
                            <TextInput style={styles.advisorSearchInput} placeholder="Tìm tên hoặc email..." placeholderTextColor="#94A3B8" value={advisorSearch} onChangeText={setAdvisorSearch} autoFocus />
                        </View>
                        {advisorLoading ? (
                            <View style={styles.advisorLoading}><ActivityIndicator size="small" color="#2563EB" /><Text style={styles.advisorLoadingText}>Đang tải...</Text></View>
                        ) : filteredAdvisors.length === 0 ? (
                            <Text style={styles.advisorEmpty}>{advisorSearch ? 'Không tìm thấy' : 'Chưa có đại lý / Đối tác nào'}</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                                {filteredAdvisors.map((u, i) => (
                                    <TouchableOpacity key={u.email}
                                        style={[styles.advisorItem, selectedAdvisor?.email === u.email && styles.advisorItemActive]}
                                        onPress={() => { setSelectedAdvisor(u); setShowAdvisorDrop(false); setAdvisorSearch(''); }} activeOpacity={0.7}
                                    >
                                        <View style={[styles.advisorAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                                            <Text style={styles.advisorAvatarText}>{getInitials(u.name)}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.advisorItemName}>{u.name}</Text>
                                            <Text style={styles.advisorItemEmail}>{u.email}</Text>
                                        </View>
                                        <View style={styles.advisorRoleBadge}><Text style={styles.advisorRoleBadgeText}>{u.role}</Text></View>
                                        {selectedAdvisor?.email === u.email && <Ionicons name="checkmark-circle" size={16} color="#2563EB" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // ─────────────────────────────────────────────────────────
    // WEB
    // ─────────────────────────────────────────────────────────
    if (isWeb) return (
        <View style={W.root}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>
                <View style={W.header}>
                    <View style={W.logoWrap}><Ionicons name="person-add" size={28} color="#2563EB" /></View>
                    <Text style={W.title}>Hoàn thiện hồ sơ</Text>
                    <Text style={W.sub}>Điền đầy đủ thông tin để admin xét duyệt tài khoản của bạn</Text>
                    <TouchableOpacity onPress={handleSignOut} style={W.signOutBtn} activeOpacity={0.8}>
                        <Ionicons name="log-out-outline" size={15} color="#EF4444" />
                        <Text style={W.signOutText}>Đăng xuất</Text>
                    </TouchableOpacity>
                </View>

                <View style={W.grid}>
                    {/* LEFT */}
                    <View style={W.col}>
                        <View style={W.card}>
                            <View style={W.cardHeader}>
                                <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
                                <Text style={W.cardTitle}>Thông tin cá nhân</Text>
                            </View>
                            <View style={W.row2}>
                                <View style={[W.inputGroup, { flex: 1 }]}>
                                    <Text style={W.label}>Họ và tên <Text style={W.required}>*</Text></Text>
                                    <View style={W.inputBox}><Ionicons name="person-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={form.name} onChangeText={v => set('name', v)} /></View>
                                </View>
                                <View style={[W.inputGroup, { flex: 1 }]}>
                                    <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                                    <View style={W.inputBox}><Ionicons name="call-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="0901 234 567" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={form.phone} onChangeText={v => set('phone', v)} /></View>
                                </View>
                            </View>
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Địa chỉ</Text>
                                <View style={W.inputBox}><Ionicons name="location-outline" size={15} color="#94A3B8" /><TextInput style={W.input} placeholder="Số nhà, đường, quận/huyện..." placeholderTextColor="#94A3B8" value={form.address} onChangeText={v => set('address', v)} /></View>
                            </View>
                            <View style={W.inputGroup}>
                                <Text style={W.label}>Ghi chú (tuỳ chọn)</Text>
                                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}><TextInput style={[W.input, { textAlignVertical: 'top' }]} placeholder="Thông tin thêm..." placeholderTextColor="#94A3B8" multiline value={form.note} onChangeText={v => set('note', v)} /></View>
                            </View>
                        </View>
                    </View>

                    {/* RIGHT */}
                    <View style={W.colRight}>
                        <View style={W.card}>
                            <View style={W.cardHeader}>
                                <Ionicons name="briefcase-outline" size={16} color="#2563EB" />
                                <Text style={W.cardTitle}>Chọn vị trí <Text style={W.required}>*</Text></Text>
                            </View>
                            {ROLES.map(role => <RoleCard key={role.key} role={role} />)}
                            <AdvisorPicker />
                        </View>

                        {/* ✅ Đại lý extra fields */}
                        {dailyFieldsJSX(true)}

                        <View style={W.infoBanner}>
                            <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
                            <Text style={W.infoBannerText}>Thông tin sẽ được gửi đến admin xét duyệt. Bạn có thể sử dụng app sau khi được xác thực.</Text>
                        </View>
                        <TouchableOpacity style={[W.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                            <Ionicons name={submitting ? 'hourglass-outline' : 'send-outline'} size={16} color="#fff" />
                            <Text style={W.submitBtnText}>{submitting ? 'Đang lưu...' : 'Hoàn tất đăng ký'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    // ─────────────────────────────────────────────────────────
    // MOBILE
    // ─────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <View style={styles.header}>
                <View style={styles.headerIcon}><Ionicons name="person-add" size={22} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Hoàn thiện hồ sơ</Text>
                    <Text style={styles.headerSub}>Bước 2/3 — Thông tin cá nhân</Text>
                </View>
                <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.8}>
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                    <Text style={styles.signOutText}>Đăng xuất</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}><Ionicons name="person-circle-outline" size={18} color="#2563EB" /><Text style={styles.sectionTitle}>Thông tin cá nhân</Text></View>
                        {[
                            { label: 'Họ và tên', field: 'name', placeholder: 'Nguyễn Văn A', required: true },
                            { label: 'Số điện thoại', field: 'phone', placeholder: '0901 234 567', required: true, keyboard: 'phone-pad' },
                            { label: 'Địa chỉ', field: 'address', placeholder: 'Số nhà, đường...' },
                        ].map(f => (
                            <View style={styles.inputGroup} key={f.field}>
                                <Text style={styles.label}>{f.label}{f.required && <Text style={styles.required}> *</Text>}</Text>
                                <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor="#94A3B8" keyboardType={f.keyboard || 'default'} value={form[f.field]} onChangeText={v => set(f.field, v)} />
                            </View>
                        ))}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Ghi chú</Text>
                            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Thông tin thêm..." placeholderTextColor="#94A3B8" multiline value={form.note} onChangeText={v => set('note', v)} />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}><Ionicons name="briefcase-outline" size={18} color="#2563EB" /><Text style={styles.sectionTitle}>Chọn vị trí <Text style={{ color: '#EF4444' }}>*</Text></Text></View>
                        {ROLES.map(role => <RoleCard key={role.key} role={role} />)}
                        <AdvisorPicker />
                    </View>

                    {/* ✅ Đại lý extra fields */}
                    {isDaiLy && (
                        <View style={styles.section}>
                            {dailyFieldsJSX(false)}
                        </View>
                    )}

                    <View style={styles.infoBanner}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" />
                        <Text style={styles.infoBannerText}>Tài khoản sẽ chờ admin xét duyệt trước khi sử dụng đầy đủ tính năng.</Text>
                    </View>
                    <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                        <Ionicons name={submitting ? 'hourglass-outline' : 'send-outline'} size={18} color="#fff" />
                        <Text style={styles.submitBtnText}>{submitting ? 'Đang lưu...' : 'Hoàn tất đăng ký'}</Text>
                    </TouchableOpacity>
                    <View style={{ height: insets.bottom + 32 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

// ── Shared role + dropdown styles ────────────────────────────
const sharedRole = {
    roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 10, backgroundColor: '#FFFFFF' },
    roleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    roleLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    roleDesc: { fontSize: 11, color: '#94A3B8' },
    roleCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    advisorTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    advisorTagText: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
    advisorSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
    advisorHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    advisorHeaderText: { fontSize: 13, fontWeight: '700' },
    advisorTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E2E8F0' },
    advisorSelected: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    advisorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    advisorAvatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    advisorSelectedName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    advisorSelectedEmail: { fontSize: 11, color: '#64748B' },
    advisorPlaceholder: { flex: 1, fontSize: 13, color: '#94A3B8' },
    advisorDropdown: { backgroundColor: '#FFFFFF', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    advisorSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    advisorSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    advisorLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, justifyContent: 'center' },
    advisorLoadingText: { fontSize: 13, color: '#94A3B8' },
    advisorEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    advisorItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    advisorItemActive: { backgroundColor: '#EFF6FF' },
    advisorItemName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    advisorItemEmail: { fontSize: 11, color: '#64748B', marginTop: 1 },
    advisorRoleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    advisorRoleBadgeText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
    // Dropdown shared
    dropdownBox: { backgroundColor: '#FFFFFF', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dropdownSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    dropdownItemActive: { backgroundColor: '#EFF6FF' },
    dropdownItemText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
    dropdownEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    // Extra fields
    extraSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14, marginTop: 4 },
    extraHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
    extraTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    areaToggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    areaToggleLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
    areaToggleSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    areaFields: { gap: 4, paddingTop: 4 },
    toggleSwitch: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2, justifyContent: 'center' },
    toggleOn: { backgroundColor: '#2563EB' },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
    toggleThumbOn: { alignSelf: 'flex-end' },
    errorText: { fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: '500' },
    labelSub: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
};

const W = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 32, paddingTop: 36, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: 24 },
    logoWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
    title: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5, marginBottom: 8 },
    sub: { fontSize: 15, color: '#64748B', textAlign: 'center', maxWidth: 480, lineHeight: 22 },
    grid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
    col: { flex: 3 },
    colRight: { flex: 2, gap: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    row2: { flexDirection: 'row', gap: 12 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, letterSpacing: 0.3 },
    required: { color: '#EF4444' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#BFDBFE' },
    infoBannerText: { flex: 1, fontSize: 13, color: '#2563EB', lineHeight: 18 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, marginTop: 4, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginTop: 12 },
    signOutText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
    ...sharedRole,
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.Background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    inputGroup: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    required: { color: '#EF4444' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    inputPlaceholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
    infoBannerText: { flex: 1, fontSize: 12, color: '#2563EB', lineHeight: 17 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, marginBottom: 12, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEF2F2' },
    signOutText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
    ...sharedRole,
});