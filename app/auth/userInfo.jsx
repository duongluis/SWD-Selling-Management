import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
    KeyboardAvoidingView, Modal, Platform, Pressable,
    ScrollView, StatusBar, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import BANKS from '../../config/banks.json';
import { db } from '../../config/firebaseConfig';
import { clearRegistrationPending } from '../_layout';

const isWeb = Platform.OS === 'web';

const COMMITTED_REVENUE_MIN = 100_000_000;
const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const ROLES = [
    { key: 'daily', label: 'Đại lý / NPP', icon: 'storefront-outline', color: '#2563EB', bg: '#EFF6FF', desc: 'Phân phối trực tiếp, cam kết doanh thu' },
    { key: 'partner', label: 'Đối tác', icon: 'briefcase-outline', color: '#7C3AED', bg: '#F5F3FF', desc: 'Hợp tác kinh doanh theo hoa hồng' },
    { key: 'ctv', label: 'Cộng tác viên', icon: 'people-outline', color: '#059669', bg: '#ECFDF5', desc: 'Giới thiệu và hỗ trợ bán hàng' },
];
const BIZ_MODELS = [
    { key: 'company', label: 'Công ty / Hộ kinh doanh', icon: 'business-outline', color: '#0F172A', bg: '#F1F5F9', desc: 'Có đăng ký kinh doanh' },
    { key: 'individual', label: 'Cá nhân', icon: 'person-outline', color: '#0F172A', bg: '#F1F5F9', desc: 'Cá nhân không có đăng ký' },
];
const DISTRIBUTION_TYPES = [
    { key: 'exclusive', label: 'Độc quyền', icon: 'lock-closed-outline', color: '#DC2626', bg: '#FEF2F2' },
    { key: 'nonexclusive', label: 'Không độc quyền', icon: 'lock-open-outline', color: '#059669', bg: '#ECFDF5' },
];

const validateCCCD = (v) => /^(\d{9}|\d{12})$/.test(v.trim());

const toDateStr = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};
const toDisplayStr = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

function DateField({ value, onChange }) {
    const [show, setShow] = useState(false);
    const [sel, setSel] = useState(new Date());
    if (isWeb) return (
        <View style={F.inputBox}>
            <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
            <input type="date" value={value || ''} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F172A', backgroundColor: 'transparent', cursor: 'pointer' }}
                onChange={e => { if (!e.target.value) return; onChange(e.target.value); const [y, m, d] = e.target.value.split('-').map(Number); setSel(new Date(y, m - 1, d, 12)); }} />
        </View>
    );
    const DateTimePicker = require('@react-native-community/datetimepicker').default;
    return (
        <>
            <TouchableOpacity style={F.inputBox} onPress={() => setShow(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
                <Text style={{ flex: 1, fontSize: 14, color: value ? '#0F172A' : '#94A3B8' }}>{value ? toDisplayStr(value) : 'Chọn ngày sinh...'}</Text>
            </TouchableOpacity>
            {show && Platform.OS === 'ios' && (
                <Modal transparent animationType="slide">
                    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShow(false)} />
                    <View style={{ backgroundColor: '#fff', padding: 16 }}>
                        <DateTimePicker value={sel} mode="date" display="spinner"
                            onChange={(_, date) => { if (date) { setSel(date); onChange(toDateStr(date)); } }} />
                        <Pressable onPress={() => setShow(false)} style={{ alignItems: 'center', padding: 12 }}>
                            <Text style={{ color: '#2563EB', fontWeight: '600' }}>Xong</Text>
                        </Pressable>
                    </View>
                </Modal>
            )}
            {show && Platform.OS === 'android' && (
                <DateTimePicker value={sel} mode="date" display="default"
                    onChange={(_, date) => { setShow(false); if (date) { setSel(date); onChange(toDateStr(date)); } }} />
            )}
        </>
    );
}

function StepBar({ current, total, labels }) {
    return (
        <View style={S.stepBarWrap}>
            <View style={S.stepBar}>
                {Array.from({ length: total }).map((_, i) => (
                    <View key={i} style={S.stepSegWrap}>
                        <View style={[S.stepDot,
                        i < current && { backgroundColor: '#2563EB' },
                        i === current && { backgroundColor: '#2563EB', width: 24, height: 24, borderRadius: 12 },
                        i > current && { backgroundColor: '#E2E8F0' },
                        ]}>
                            {i < current && <Ionicons name="checkmark" size={10} color="#fff" />}
                            {i === current && <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{i + 1}</Text>}
                        </View>
                        {i < total - 1 && <View style={[S.stepLine, i < current && { backgroundColor: '#2563EB' }]} />}
                    </View>
                ))}
            </View>
            {labels && current < labels.length && <Text style={S.stepLabel}>{labels[current]}</Text>}
        </View>
    );
}

export default function UserInfoView() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(0);
    const [role, setRole] = useState('');
    const [bizModel, setBizModel] = useState('');
    const [phone, setPhone] = useState('');
    const [emailContact, setEmailContact] = useState('');
    const [address, setAddress] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [taxCode, setTaxCode] = useState('');
    const [bizAddress, setBizAddress] = useState('');
    const [fullName, setFullName] = useState('');
    const [cccd, setCccd] = useState('');
    const [cccdError, setCccdError] = useState('');
    const [dob, setDob] = useState('');
    const [committedRevenue, setCommittedRevenue] = useState('');
    const [revenueError, setRevenueError] = useState('');
    const [revenueTouched, setRevenueTouched] = useState(false);
    const [distributionType, setDistributionType] = useState('');
    const [showAreaPicker, setShowAreaPicker] = useState(false);
    const [regions, setRegions] = useState([]);
    const [regLoading, setRegLoading] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedProvince, setSelectedProvince] = useState('');
    const [showRegionDrop, setShowRegionDrop] = useState(false);
    const [showProvinceDrop, setShowProvinceDrop] = useState(false);
    const [provinceSearch, setProvinceSearch] = useState('');
    const [provinces, setProvinces] = useState([]);
    const [selectedBank, setSelectedBank] = useState(null);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDrop, setShowBankDrop] = useState(false);
    const [accountNo, setAccountNo] = useState('');
    const [accountNoErr, setAccountNoErr] = useState('');
    const [accountName, setAccountName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isDaiLy = role === 'daily';
    const needsBank = role === 'partner' || role === 'ctv';
    const rev = parseInt(committedRevenue) || 0;

    const STEP_LABELS = isDaiLy
        ? ['Vai trò', 'Mô hình', 'Thông tin chung', 'Thông tin KD', 'Cam kết']
        : needsBank
            ? ['Vai trò', 'Mô hình', 'Thông tin chung', 'Thông tin KD', 'Ngân hàng']
            : ['Vai trò', 'Mô hình', 'Thông tin chung', 'Thông tin KD'];
    const TOTAL_STEPS = STEP_LABELS.length;

    const handleSignOut = async () => {
        try {
            const auth = getAuth(); const user = auth.currentUser;
            clearRegistrationPending();
            router.replace('/auth/signIn');
            if (user) await user.delete();
        } catch (e) { console.error(e); }
    };

    const fetchRegions = async () => {
        if (regions.length > 0) return;
        setRegLoading(true);
        try {
            const snap = await getDocs(collection(db, 'province'));
            setRegions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setRegLoading(false); }
    };
    const handleSelectRegion = (r) => {
        setSelectedRegion(r); setSelectedProvince(''); setShowRegionDrop(false);
        setProvinces((r.cities || []).map(c => c.ten));
    };
    const handleToggleArea = () => {
        const next = !showAreaPicker; setShowAreaPicker(next);
        if (next) fetchRegions(); else { setSelectedRegion(null); setSelectedProvince(''); }
    };
    const filteredProvinces = provinces.filter(p => p.toLowerCase().includes(provinceSearch.toLowerCase()));
    const filteredBanks = BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()) || b.shortName.toLowerCase().includes(bankSearch.toLowerCase()));

    const handleRevenueChange = (text) => { setCommittedRevenue(text.replace(/\D/g, '')); setRevenueError(''); };
    const handleRevenueBlur = () => {
        setRevenueTouched(true);
        if (rev > 0 && rev < COMMITTED_REVENUE_MIN) setRevenueError(`Tối thiểu ${fmt(COMMITTED_REVENUE_MIN)}`);
        else setRevenueError('');
    };
    const handleAccountNoChange = (text) => {
        const digits = text.replace(/\D/g, ''); setAccountNo(digits);
        if (selectedBank && digits.length > 0) {
            const { minLen, maxLen } = selectedBank;
            if (digits.length < minLen || digits.length > maxLen)
                setAccountNoErr(`Số TK ${selectedBank.name} phải có ${minLen === maxLen ? minLen : `${minLen}–${maxLen}`} chữ số`);
            else setAccountNoErr('');
        } else setAccountNoErr('');
    };

    const validateStep = () => {
        switch (step) {
            case 0: if (!role) { showAlert('Thông báo', 'Vui lòng chọn vai trò'); return false; } return true;
            case 1: if (!bizModel) { showAlert('Thông báo', 'Vui lòng chọn mô hình kinh doanh'); return false; } return true;
            case 2:
                if (!phone.trim()) { showAlert('Thông báo', 'Vui lòng nhập số điện thoại'); return false; }
                if (!address.trim()) { showAlert('Thông báo', 'Vui lòng nhập địa chỉ'); return false; }
                return true;
            case 3:
                if (bizModel === 'company') {
                    if (!companyName.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên công ty/hộ KD'); return false; }
                    if (!taxCode.trim()) { showAlert('Thông báo', 'Vui lòng nhập mã số thuế'); return false; }
                    if (!bizAddress.trim()) { showAlert('Thông báo', 'Vui lòng nhập địa chỉ đăng ký KD'); return false; }
                } else {
                    if (!fullName.trim()) { showAlert('Thông báo', 'Vui lòng nhập họ và tên'); return false; }
                    if (!cccd.trim()) { showAlert('Thông báo', 'Vui lòng nhập số CCCD/CMND'); return false; }
                    if (!validateCCCD(cccd)) { showAlert('Thông báo', 'Số CCCD phải có 12 chữ số (hoặc CMND 9 chữ số)'); return false; }
                }
                return true;
            case 4:
                if (isDaiLy) {
                    if (!rev) { showAlert('Thông báo', 'Vui lòng nhập doanh thu cam kết'); return false; }
                    if (rev < COMMITTED_REVENUE_MIN) { showAlert('Thông báo', `Doanh thu tối thiểu là ${fmt(COMMITTED_REVENUE_MIN)}`); return false; }
                    if (!distributionType) { showAlert('Thông báo', 'Vui lòng chọn hình thức phân phối'); return false; }
                    return true;
                } else if (needsBank) {
                    if (!selectedBank) { showAlert('Thông báo', 'Vui lòng chọn ngân hàng'); return false; }
                    if (accountNoErr) { showAlert('Thông báo', accountNoErr); return false; }
                    if (!accountNo.trim()) { showAlert('Thông báo', 'Vui lòng nhập số tài khoản'); return false; }
                    if (!accountName.trim()) { showAlert('Thông báo', 'Vui lòng nhập tên chủ tài khoản'); return false; }
                    return true;
                }
                return true;
            default: return true;
        }
    };

    const goNext = () => { if (!validateStep()) return; if (step < TOTAL_STEPS - 1) setStep(s => s + 1); else handleSubmit(); };
    const goBack = () => { if (step > 0) setStep(s => s - 1); };

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setSubmitting(true);
        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;
            const email = auth.currentUser?.email;
            if (!email) throw new Error('Không tìm thấy tài khoản.');
            const roleMap = { daily: 'đại lý', partner: 'Đối tác', ctv: 'cộng tác viên' };
            const payload = {
                uid, email,
                phone: phone.trim(), address: address.trim(),
                role: roleMap[role], member: roleMap[role],
                bizModel, verified: false,
                createdAt: new Date().toISOString(),
            };
            if (emailContact.trim()) payload.emailContact = emailContact.trim();
            if (bizModel === 'company') {
                payload.companyName = companyName.trim();
                payload.taxCode = taxCode.trim();
                payload.bizAddress = bizAddress.trim();
                payload.name = companyName.trim();
            } else {
                payload.name = fullName.trim();
                payload.cccd = cccd.trim();
                if (dob) payload.dob = dob;
            }
            if (isDaiLy) {
                payload.committedRevenue = rev;
                payload.distributionType = distributionType;
                if (showAreaPicker && selectedRegion) {
                    payload.region = selectedRegion.id;
                    payload.regionName = selectedRegion.name;
                    payload.province = selectedProvince || null;
                }
            }
            if (needsBank) {
                payload.bank = {
                    id: selectedBank.id, name: selectedBank.name,
                    accountNo: accountNo.trim(), accountName: accountName.trim(),
                };
            }
            await setDoc(doc(db, 'users', email), payload);
            clearRegistrationPending();
            router.replace('/auth/pendingVerification');
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSubmitting(false); }
    };

    // ── Step renderers ────────────────────────────────────────
    const renderStepRole = () => (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Bạn muốn tham gia với vai trò gì?</Text>
            <Text style={S.stepSub}>Chọn vai trò phù hợp với mô hình kinh doanh của bạn</Text>
            <View style={S.cardList}>
                {ROLES.map(r => {
                    const active = role === r.key;
                    return (
                        <TouchableOpacity key={r.key} style={[S.selCard, active && { borderColor: r.color, backgroundColor: r.bg }]} onPress={() => setRole(r.key)} activeOpacity={0.7}>
                            <View style={[S.selIcon, { backgroundColor: active ? r.color + '22' : '#F1F5F9' }]}>
                                <Ionicons name={r.icon} size={24} color={active ? r.color : '#94A3B8'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[S.selLabel, active && { color: r.color }]}>{r.label}</Text>
                                <Text style={S.selDesc}>{r.desc}</Text>
                            </View>
                            <View style={[S.selCheck, active && { backgroundColor: r.color, borderColor: r.color }]}>
                                {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderStepBizModel = () => (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Mô hình kinh doanh</Text>
            <Text style={S.stepSub}>Chọn loại hình phù hợp để điền thông tin tiếp theo</Text>
            <View style={S.cardList}>
                {BIZ_MODELS.map(m => {
                    const active = bizModel === m.key;
                    return (
                        <TouchableOpacity key={m.key} style={[S.selCard, active && { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]} onPress={() => setBizModel(m.key)} activeOpacity={0.7}>
                            <View style={[S.selIcon, { backgroundColor: active ? '#BFDBFE' : '#F1F5F9' }]}>
                                <Ionicons name={m.icon} size={24} color={active ? '#2563EB' : '#94A3B8'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[S.selLabel, active && { color: '#2563EB' }]}>{m.label}</Text>
                                <Text style={S.selDesc}>{m.desc}</Text>
                            </View>
                            <View style={[S.selCheck, active && { backgroundColor: '#2563EB', borderColor: '#2563EB' }]}>
                                {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderStepCommon = () => (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Thông tin liên hệ</Text>
            <Text style={S.stepSub}>Điền thông tin để chúng tôi liên hệ với bạn</Text>
            <View style={S.fg}><Text style={S.label}>Số điện thoại <Text style={S.req}>*</Text></Text>
                <View style={F.inputBox}><Ionicons name="call-outline" size={15} color="#94A3B8" /><TextInput style={F.input} placeholder="0901 234 567" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={phone} onChangeText={setPhone} /></View>
            </View>
            <View style={S.fg}><Text style={S.label}>Email liên hệ <Text style={S.optional}>(tuỳ chọn)</Text></Text>
                <View style={F.inputBox}><Ionicons name="mail-outline" size={15} color="#94A3B8" /><TextInput style={F.input} placeholder="email@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" value={emailContact} onChangeText={setEmailContact} /></View>
            </View>
            <View style={S.fg}><Text style={S.label}>Địa chỉ <Text style={S.req}>*</Text></Text>
                <View style={[F.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}><Ionicons name="location-outline" size={15} color="#94A3B8" style={{ marginTop: 2 }} /><TextInput style={[F.input, { textAlignVertical: 'top' }]} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..." placeholderTextColor="#94A3B8" multiline value={address} onChangeText={setAddress} /></View>
            </View>
        </View>
    );

    const renderStepBizInfo = () => bizModel === 'company' ? (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Thông tin doanh nghiệp</Text>
            <Text style={S.stepSub}>Theo giấy đăng ký kinh doanh</Text>
            <View style={S.fg}><Text style={S.label}>Tên công ty / Hộ kinh doanh <Text style={S.req}>*</Text></Text>
                <View style={F.inputBox}><Ionicons name="business-outline" size={15} color="#94A3B8" /><TextInput style={F.input} placeholder="Công ty TNHH ABC..." placeholderTextColor="#94A3B8" value={companyName} onChangeText={setCompanyName} /></View>
            </View>
            <View style={S.fg}><Text style={S.label}>Mã số thuế <Text style={S.req}>*</Text></Text>
                <View style={F.inputBox}><Ionicons name="document-text-outline" size={15} color="#94A3B8" /><TextInput style={F.input} placeholder="0123456789" placeholderTextColor="#94A3B8" keyboardType="numeric" value={taxCode} onChangeText={setTaxCode} /></View>
            </View>
            <View style={S.fg}><Text style={S.label}>Địa chỉ đăng ký kinh doanh <Text style={S.req}>*</Text></Text>
                <View style={[F.inputBox, { alignItems: 'flex-start', minHeight: 80 }]}><Ionicons name="location-outline" size={15} color="#94A3B8" style={{ marginTop: 2 }} /><TextInput style={[F.input, { textAlignVertical: 'top' }]} placeholder="Địa chỉ theo ĐKKD..." placeholderTextColor="#94A3B8" multiline value={bizAddress} onChangeText={setBizAddress} /></View>
            </View>
        </View>
    ) : (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Thông tin cá nhân</Text>
            <Text style={S.stepSub}>Theo giấy tờ tùy thân hợp lệ</Text>
            <View style={S.fg}><Text style={S.label}>Họ và tên <Text style={S.req}>*</Text></Text>
                <View style={F.inputBox}><Ionicons name="person-outline" size={15} color="#94A3B8" /><TextInput style={F.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94A3B8" value={fullName} onChangeText={setFullName} /></View>
            </View>
            <View style={S.fg}>
                <Text style={S.label}>Số CCCD / CMND <Text style={S.req}>*</Text></Text>
                <Text style={S.hint}>12 chữ số (CCCD mới) hoặc 9 chữ số (CMND cũ)</Text>
                <View style={[F.inputBox, cccdError && { borderColor: '#EF4444' }]}>
                    <Ionicons name="card-outline" size={15} color={cccdError ? '#EF4444' : '#94A3B8'} />
                    <TextInput style={F.input} placeholder="001234567890" placeholderTextColor="#94A3B8" keyboardType="numeric" maxLength={12} value={cccd}
                        onChangeText={v => { setCccd(v.replace(/\D/g, '')); setCccdError(''); }}
                        onBlur={() => { if (cccd && !validateCCCD(cccd)) setCccdError('Số CCCD không hợp lệ (12 hoặc 9 chữ số)'); }}
                    />
                </View>
                {cccdError ? <Text style={S.errText}>{cccdError}</Text> : null}
            </View>
            <View style={S.fg}><Text style={S.label}>Ngày sinh <Text style={S.optional}>(tuỳ chọn)</Text></Text>
                <DateField value={dob} onChange={setDob} />
            </View>
        </View>
    );

    const renderStepCommitment = () => (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Thông tin cam kết</Text>
            <Text style={S.stepSub}>Áp dụng với Đại lý / NPP</Text>
            <View style={S.fg}>
                <Text style={S.label}>Doanh thu cam kết (năm) <Text style={S.req}>*</Text></Text>
                <Text style={S.hint}>Tối thiểu {fmt(COMMITTED_REVENUE_MIN)}</Text>
                <View style={[F.inputBox, revenueError && { borderColor: '#EF4444' }]}>
                    <Ionicons name="cash-outline" size={15} color={revenueError ? '#EF4444' : '#94A3B8'} />
                    <TextInput style={F.input} placeholder="Nhập số tiền (VNĐ)..." placeholderTextColor="#94A3B8" keyboardType="numeric"
                        value={committedRevenue ? parseInt(committedRevenue).toLocaleString('vi-VN') : ''}
                        onChangeText={handleRevenueChange} onBlur={handleRevenueBlur}
                    />
                    {revenueTouched && rev > 0 && <Text style={{ fontSize: 11, color: rev >= COMMITTED_REVENUE_MIN ? '#059669' : '#EF4444', fontWeight: '600' }}>{fmt(rev)}</Text>}
                </View>
                {revenueError ? <Text style={S.errText}>{revenueError}</Text> : null}
            </View>
            <View style={S.fg}>
                <Text style={S.label}>Hình thức phân phối <Text style={S.req}>*</Text></Text>
                <View style={{ gap: 8 }}>
                    {DISTRIBUTION_TYPES.map(dt => {
                        const active = distributionType === dt.key;
                        return (
                            <TouchableOpacity key={dt.key} style={[F.inputBox, { borderWidth: 2, borderColor: active ? dt.color : '#E2E8F0' }, active && { backgroundColor: dt.bg }]} onPress={() => setDistributionType(dt.key)} activeOpacity={0.8}>
                                <Ionicons name={dt.icon} size={16} color={active ? dt.color : '#94A3B8'} />
                                <Text style={[{ flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' }, active && { color: dt.color }]}>{dt.label}</Text>
                                {active && <Ionicons name="checkmark-circle" size={18} color={dt.color} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
            <View style={S.fg}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View><Text style={S.label}>Khu vực phụ trách</Text><Text style={S.hint}>Tuỳ chọn</Text></View>
                    <TouchableOpacity style={[S.toggle, showAreaPicker && S.toggleOn]} onPress={handleToggleArea} activeOpacity={0.8}>
                        <View style={[S.toggleThumb, showAreaPicker && S.toggleThumbOn]} />
                    </TouchableOpacity>
                </View>
                {showAreaPicker && (
                    <View style={{ gap: 8 }}>
                        <TouchableOpacity style={[F.inputBox, showRegionDrop && { borderColor: '#2563EB' }]} onPress={() => setShowRegionDrop(p => !p)} activeOpacity={0.8}>
                            <Ionicons name="map-outline" size={15} color="#94A3B8" />
                            <Text style={selectedRegion ? F.input : F.placeholder}>{selectedRegion?.name || 'Chọn vùng / miền...'}</Text>
                            <Ionicons name={showRegionDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                        </TouchableOpacity>
                        {showRegionDrop && (
                            <View style={S.drop}>
                                {regLoading ? <Text style={S.dropEmpty}>Đang tải...</Text> : regions.length === 0 ? <Text style={S.dropEmpty}>Chưa có dữ liệu</Text>
                                    : regions.map(r => (<TouchableOpacity key={r.id} style={[S.dropItem, selectedRegion?.id === r.id && S.dropActive]} onPress={() => handleSelectRegion(r)} activeOpacity={0.7}>
                                        <Ionicons name="location-outline" size={13} color={selectedRegion?.id === r.id ? '#2563EB' : '#94A3B8'} />
                                        <Text style={[S.dropText, selectedRegion?.id === r.id && { color: '#2563EB', fontWeight: '700' }]}>{r.name}</Text>
                                        {selectedRegion?.id === r.id && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                    </TouchableOpacity>))
                                }
                            </View>
                        )}
                        {selectedRegion && (<>
                            <TouchableOpacity style={[F.inputBox, showProvinceDrop && { borderColor: '#2563EB' }]} onPress={() => setShowProvinceDrop(p => !p)} activeOpacity={0.8}>
                                <Ionicons name="business-outline" size={15} color="#94A3B8" />
                                <Text style={selectedProvince ? F.input : F.placeholder}>{selectedProvince || 'Chọn tỉnh / thành phố...'}</Text>
                                <Ionicons name={showProvinceDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                            </TouchableOpacity>
                            {showProvinceDrop && (
                                <View style={S.drop}>
                                    <View style={S.dropSearchRow}><Ionicons name="search-outline" size={13} color="#94A3B8" /><TextInput style={{ flex: 1, fontSize: 13, color: '#0F172A' }} placeholder="Tìm tỉnh thành..." placeholderTextColor="#94A3B8" value={provinceSearch} onChangeText={setProvinceSearch} /></View>
                                    <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                                        {filteredProvinces.length === 0 ? <Text style={S.dropEmpty}>{provinceSearch ? 'Không tìm thấy' : 'Chưa có dữ liệu'}</Text>
                                            : filteredProvinces.map(p => (<TouchableOpacity key={p} style={[S.dropItem, selectedProvince === p && S.dropActive]} onPress={() => { setSelectedProvince(p); setShowProvinceDrop(false); setProvinceSearch(''); }} activeOpacity={0.7}>
                                                <Ionicons name="location-outline" size={13} color={selectedProvince === p ? '#2563EB' : '#94A3B8'} />
                                                <Text style={[S.dropText, selectedProvince === p && { color: '#2563EB', fontWeight: '700' }]}>{p}</Text>
                                                {selectedProvince === p && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                            </TouchableOpacity>))
                                        }
                                    </ScrollView>
                                </View>
                            )}
                        </>)}
                    </View>
                )}
            </View>
        </View>
    );

    const renderStepBank = () => (
        <View style={S.stepContent}>
            <Text style={S.stepTitle}>Thông tin ngân hàng</Text>
            <Text style={S.stepSub}>Dùng để nhận hoa hồng và thanh toán</Text>
            <View style={S.fg}>
                <Text style={S.label}>Ngân hàng <Text style={S.req}>*</Text></Text>
                <TouchableOpacity style={[F.inputBox, showBankDrop && { borderColor: '#2563EB' }]} onPress={() => setShowBankDrop(p => !p)} activeOpacity={0.8}>
                    {selectedBank ? (
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>{selectedBank.shortName}</Text>
                            </View>
                            <Text style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' }}>{selectedBank.name}</Text>
                            <TouchableOpacity onPress={() => { setSelectedBank(null); setAccountNo(''); setAccountNoErr(''); }}>
                                <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <><Ionicons name="search-outline" size={15} color="#94A3B8" /><Text style={F.placeholder}>Tìm và chọn ngân hàng...</Text><Ionicons name={showBankDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" /></>
                    )}
                </TouchableOpacity>
                {showBankDrop && (
                    <View style={S.drop}>
                        <View style={S.dropSearchRow}><Ionicons name="search-outline" size={13} color="#94A3B8" /><TextInput style={{ flex: 1, fontSize: 13, color: '#0F172A' }} placeholder="Tên ngân hàng..." placeholderTextColor="#94A3B8" value={bankSearch} onChangeText={setBankSearch} autoFocus /></View>
                        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                            {filteredBanks.map(b => (
                                <TouchableOpacity key={b.id} style={[S.dropItem, selectedBank?.id === b.id && S.dropActive]} onPress={() => { setSelectedBank(b); setShowBankDrop(false); setBankSearch(''); setAccountNo(''); setAccountNoErr(''); }} activeOpacity={0.7}>
                                    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563EB' }}>{b.shortName}</Text>
                                    </View>
                                    <Text style={[S.dropText, selectedBank?.id === b.id && { color: '#2563EB', fontWeight: '700' }]}>{b.name}</Text>
                                    {selectedBank?.id === b.id && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>
            <View style={S.fg}>
                <Text style={S.label}>Số tài khoản <Text style={S.req}>*</Text></Text>
                {selectedBank && <Text style={S.hint}>{selectedBank.minLen === selectedBank.maxLen ? `${selectedBank.minLen} chữ số` : `${selectedBank.minLen}–${selectedBank.maxLen} chữ số`}</Text>}
                <View style={[F.inputBox, accountNoErr && { borderColor: '#EF4444' }]}>
                    <Ionicons name="card-outline" size={15} color={accountNoErr ? '#EF4444' : '#94A3B8'} />
                    <TextInput style={F.input} placeholder="Nhập số tài khoản..." placeholderTextColor="#94A3B8" keyboardType="numeric" value={accountNo} onChangeText={handleAccountNoChange} editable={!!selectedBank} />
                </View>
                {accountNoErr ? <Text style={S.errText}>{accountNoErr}</Text> : null}
            </View>
            <View style={S.fg}>
                <Text style={S.label}>Tên chủ tài khoản <Text style={S.req}>*</Text></Text>
                <Text style={S.hint}>Nhập chính xác như trên thẻ ngân hàng (IN HOA)</Text>
                <View style={F.inputBox}>
                    <Ionicons name="person-outline" size={15} color="#94A3B8" />
                    <TextInput style={F.input} placeholder="NGUYEN VAN A" placeholderTextColor="#94A3B8" autoCapitalize="characters" value={accountName} onChangeText={t => setAccountName(t.toUpperCase())} />
                </View>
            </View>
        </View>
    );

    const renderStep = () => {
        switch (step) {
            case 0: return renderStepRole();
            case 1: return renderStepBizModel();
            case 2: return renderStepCommon();
            case 3: return renderStepBizInfo();
            case 4: return isDaiLy ? renderStepCommitment() : renderStepBank();
            default: return null;
        }
    };

    const isLastStep = step === TOTAL_STEPS - 1;
    const roleCfg = ROLES.find(r => r.key === role);

    return (
        <View style={[S.root, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <View style={S.header}>
                {step > 0 ? (<TouchableOpacity onPress={goBack} style={S.headerBtn}><Ionicons name="arrow-back" size={20} color="#0F172A" /></TouchableOpacity>) : (<View style={S.headerBtn} />)}
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={S.headerTitle}>Đăng ký tài khoản</Text>
                    <Text style={S.headerSub}>Bước {step + 1} / {TOTAL_STEPS}</Text>
                </View>
                <TouchableOpacity onPress={handleSignOut} style={[S.headerBtn, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
            </View>
            {role && step > 0 && roleCfg && (
                <View style={[S.roleBadge, { backgroundColor: roleCfg.bg }]}>
                    <Ionicons name={roleCfg.icon} size={13} color={roleCfg.color} />
                    <Text style={[S.roleBadgeText, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                </View>
            )}
            <StepBar current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={S.scrollContent}>
                    {renderStep()}
                    <View style={{ height: insets.bottom + 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>
            <View style={[S.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={[S.nextBtn, submitting && { opacity: 0.7 }]} onPress={goNext} disabled={submitting} activeOpacity={0.85}>
                    <Ionicons name={isLastStep ? (submitting ? 'hourglass-outline' : 'send-outline') : 'arrow-forward'} size={20} color="#fff" />
                    <Text style={S.nextBtnText}>{isLastStep ? (submitting ? 'Đang gửi...' : 'Hoàn tất đăng ký') : 'Tiếp theo'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
    roleBadgeText: { fontSize: 12, fontWeight: '700' },
    stepBarWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    stepBar: { flexDirection: 'row', alignItems: 'center' },
    stepSegWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
    stepLabel: { fontSize: 12, fontWeight: '600', color: '#2563EB', marginTop: 6, textAlign: 'center' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
    stepContent: { paddingVertical: 8 },
    stepTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
    stepSub: { fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 },
    cardList: { gap: 10 },
    selCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
    selIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    selLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    selDesc: { fontSize: 12, color: '#94A3B8' },
    selCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    fg: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
    hint: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
    optional: { fontSize: 11, color: '#94A3B8', fontWeight: '400' },
    req: { color: '#EF4444' },
    errText: { fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: '500' },
    toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', padding: 3, justifyContent: 'center' },
    toggleOn: { backgroundColor: '#2563EB' },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
    toggleThumbOn: { alignSelf: 'flex-end' },
    drop: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    dropSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    dropActive: { backgroundColor: '#EFF6FF' },
    dropText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
    dropEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 4 },
    nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
const F = StyleSheet.create({
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
    placeholder: { flex: 1, fontSize: 14, color: '#94A3B8' },
});