// app/editProfile/index.jsx — Thông tin cá nhân (hồ sơ cá nhân)

import BgWatermark from '@/components/Main/BgWatermark';
import { showInfo } from '@/components/Main/showInfo';
import { getRole, getRoleLabel } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Switch, Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HelpButton from '../../components/Help/HelpButton';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';

import BANKS from '../../config/banks.json';
import { normalizePhone } from '@/components/Utils/formatters';

function getInitials(name) {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Info field row ────────────────────────────────────────────
function InfoField({ label, value }) {
    return (
        <View style={F.wrap}>
            <Text style={F.label}>{label}</Text>
            <Text style={F.value}>{value || '—'}</Text>
            <View style={F.divider} />
        </View>
    );
}
const F = StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 6 },
    value: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
    divider: { height: 0.5, backgroundColor: '#F1F5F9', marginTop: 14 },
});

// ── Edit input ────────────────────────────────────────────────
function EditInput({ label, value, onChange, keyboardType = 'default', multiline = false }) {
    return (
        <View style={EI.wrap}>
            <Text style={EI.label}>{label}</Text>
            <TextInput
                style={[EI.input, multiline && { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={value || ''} onChangeText={onChange}
                keyboardType={keyboardType} multiline={multiline}
                placeholderTextColor="#CBD5E1"
            />
        </View>
    );
}
const EI = StyleSheet.create({
    wrap: { marginBottom: 14 },
    label: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
});

// ── Toggle row ────────────────────────────────────────────────
function ToggleRow({ icon, label, sub, value, onChange }) {
    return (
        <View style={TR.wrap}>
            <View style={TR.iconWrap}><Ionicons name={icon} size={18} color="#2563EB" /></View>
            <View style={{ flex: 1 }}>
                <Text style={TR.label}>{label}</Text>
                {sub && <Text style={TR.sub}>{sub}</Text>}
            </View>
            <Switch value={value} onValueChange={onChange}
                trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                thumbColor="#fff" ios_backgroundColor="#E2E8F0" />
        </View>
    );
}
const TR = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    sub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});

// ── Main ──────────────────────────────────────────────────────
export default function EditProfileScreen() {
    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const role = getRole(userDetail);
    const roleLabel = getRoleLabel(role);
    const { isDesktop } = useLayout();

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notifyPush, setNotifyPush] = useState(userDetail?.notifyPush ?? true);
    const [notifyEmail, setNotifyEmail] = useState(userDetail?.notifyEmail ?? false);

    const [form, setForm] = useState({
        name: userDetail?.name || '',
        phone: userDetail?.phone || '',
        address: userDetail?.address || '',
        title: userDetail?.title || '',
        contactName: userDetail?.contactName || '',
        contactPhone: userDetail?.contactPhone || '',
    });
    const set = f => v => setForm(p => ({ ...p, [f]: v }));

    const isCompany = userDetail?.bizModel === 'company';
    const [selectedBank, setSelectedBank] = useState(
        userDetail?.bank ? BANKS.find(b => b.id === userDetail.bank.id) || null : null
    );
    const [showBankDrop, setShowBankDrop] = useState(false);
    const [bankSearch, setBankSearch] = useState('');
    const [accountNo, setAccountNo] = useState(userDetail?.bank?.accountNo || '');
    const [accountNoErr, setAccountNoErr] = useState('');
    const [accountName, setAccountName] = useState(userDetail?.bank?.accountName || '');

    const filteredBanks = BANKS.filter(b =>
        b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
        b.shortName.toLowerCase().includes(bankSearch.toLowerCase())
    );

    useEffect(() => {
        if (userDetail) {
            setForm({
                name: userDetail.name || '',
                phone: userDetail.phone || '',
                address: userDetail.address || '',
                title: userDetail.title || '',
                contactName: userDetail.contactName || '',
                contactPhone: userDetail.contactPhone || '',
            });
            setSelectedBank(userDetail.bank ? BANKS.find(b => b.id === userDetail.bank.id) || null : null);
            setAccountNo(userDetail.bank?.accountNo || '');
            setAccountName(userDetail.bank?.accountName || '');
        }
    }, [userDetail]);

    const handleAccountNoChange = (text) => {
        const digits = text.replace(/\D/g, '');
        setAccountNo(digits);
        if (selectedBank && digits.length > 0) {
            const { minLen, maxLen } = selectedBank;
            if (digits.length < minLen || digits.length > maxLen) {
                setAccountNoErr(`Số TK ${selectedBank.name} phải có ${minLen === maxLen ? minLen : `${minLen}–${maxLen}`} chữ số`);
            } else setAccountNoErr('');
        } else setAccountNoErr('');
    };


    const handleSave = async () => {
        if (!form.name?.trim()) { showInfo('Thiếu thông tin', 'Vui lòng nhập họ tên'); return; }

        // Validate ngân hàng (không bắt buộc, nhưng nếu đã nhập 1 phần thì phải đủ)
        const bankTouched = selectedBank || accountNo.trim() || accountName.trim();
        if (bankTouched) {
            if (!selectedBank) { showInfo('Thiếu thông tin', 'Vui lòng chọn ngân hàng'); return; }
            if (!accountNo.trim()) { showInfo('Thiếu thông tin', 'Vui lòng nhập số tài khoản'); return; }
            if (accountNoErr) { showInfo('Lỗi', accountNoErr); return; }
            if (!accountName.trim()) { showInfo('Thiếu thông tin', 'Vui lòng nhập tên chủ tài khoản'); return; }
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                phone: normalizePhone(form.phone),
                address: form.address.trim(),
                notifyPush,
                notifyEmail,
                updatedAt: new Date().toISOString(),
            };
            if (isCompany) {
                payload.contactName = form.contactName.trim();
                payload.contactPhone = form.contactPhone.trim();
            }
            if (bankTouched) {
                payload.bank = {
                    id: selectedBank.id,
                    name: selectedBank.name,
                    accountNo: accountNo.trim(),
                    accountName: accountName.trim(),
                };
            }
            await updateDoc(doc(db, 'users', userDetail.email), payload);
            setUserDetail?.(prev => ({ ...prev, ...payload }));
            showInfo('✅ Đã lưu', 'Thông tin cá nhân đã được cập nhật');
            setEditing(false);
        } catch (e) { showInfo('Lỗi', e.message); }
        finally { setSaving(false); }
    };

    const handleToggleNotify = async (field, val) => {
        if (field === 'push') setNotifyPush(val); else setNotifyEmail(val);
        try { await updateDoc(doc(db, 'users', userDetail.email), { [field === 'push' ? 'notifyPush' : 'notifyEmail']: val }); }
        catch (e) { console.error(e); }
    };

    const AVATAR_COLOR = '#2C5282';

    return (
        <View style={[S.root, { paddingTop: isDesktop ? 0 : insets.top }]}>
            <BgWatermark />
            {/* Header */}
            <View style={S.header}>
                {/* <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity> */}
                <Text style={S.headerTitle}>Thông tin cá nhân</Text>
                <HelpButton screenKey="editProfile" />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={S.scroll}>

                    {/* Layout 2 cột trên web */}
                    <View style={S.body}>

                        {/* ── Cột trái: Avatar card ── */}
                        <View style={S.leftCol}>
                            <View style={S.avatarCard}>
                                <View style={[S.avatar, { backgroundColor: AVATAR_COLOR }]}>
                                    <Text style={S.avatarText}>{getInitials(userDetail?.name)}</Text>
                                </View>
                                <Text style={S.avatarName}>{userDetail?.name || '—'}</Text>
                                <Text style={S.avatarTitle}>{form.title || roleLabel}</Text>
                                <View style={S.badges}>
                                    <View style={S.badge}><Text style={S.badgeText}>{roleLabel.toUpperCase()}</Text></View>
                                    {userDetail?.verified && (
                                        <View style={[S.badge, { backgroundColor: '#ECFDF5' }]}>
                                            <Ionicons name="checkmark-circle" size={11} color="#16A34A" />
                                            <Text style={[S.badgeText, { color: '#16A34A' }]}>XÁC MINH</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={S.miniContacts}>
                                    {userDetail?.email && (
                                        <View style={S.miniContact}>
                                            <Ionicons name="mail-outline" size={14} color="#94A3B8" />
                                            <Text style={S.miniContactText} numberOfLines={1}>{userDetail.email}</Text>
                                        </View>
                                    )}
                                    {userDetail?.phone && (
                                        <View style={S.miniContact}>
                                            <Ionicons name="call-outline" size={14} color="#94A3B8" />
                                            <Text style={S.miniContactText}>{userDetail.phone}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* ── Cột phải: Cards ── */}
                        <View style={S.rightCol}>

                            {/* Thông tin chung */}
                            <View style={S.card}>
                                <View style={S.cardHeader}>
                                    <Text style={S.cardTitle}>Thông tin chung</Text>
                                    {!editing && (
                                        <TouchableOpacity style={S.inlineEditBtn} onPress={() => setEditing(true)}>
                                            <Ionicons name="create-outline" size={14} color="#2563EB" />
                                            <Text style={S.inlineEditText}>Chỉnh sửa</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {editing ? (<>
                                    <EditInput label="Họ và tên" value={form.name} onChange={set('name')} />
                                    {/* Chức danh (title) - khóa không cho sửa */}
                                    <View style={EI.wrap}>
                                        <Text style={EI.label}>Chức danh</Text>
                                        <View style={[EI.input, { backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' }]}>
                                            <Text style={{ flex: 1, fontSize: 14, color: '#64748B' }}>{form.title || roleLabel}</Text>
                                            <Ionicons name="lock-closed-outline" size={14} color="#94A3B8" />
                                        </View>
                                    </View>
                                    <EditInput label="Số điện thoại" value={form.phone} onChange={v => set('phone')(normalizePhone(v))} keyboardType="phone-pad" />
                                    <EditInput label="Địa chỉ" value={form.address} onChange={set('address')} multiline />
                                    {isCompany && (
                                        <>
                                            <View style={{ height: 8 }} />
                                            <Text style={[EI.label, { color: '#2563EB', marginTop: 4 }]}>Người liên hệ</Text>
                                            <EditInput label="Họ và tên người liên hệ" value={form.contactName} onChange={set('contactName')} />
                                            <EditInput label="Số điện thoại người liên hệ" value={form.contactPhone} onChange={set('contactPhone')} keyboardType="phone-pad" />
                                        </>
                                    )}
                                    <View style={{ height: 8 }} />
                                    <Text style={[EI.label, { color: '#2563EB', marginTop: 4 }]}>Thông tin ngân hàng (nhận hoa hồng/thanh toán)</Text>

                                    <View style={EI.wrap}>
                                        <Text style={EI.label}>Ngân hàng</Text>
                                        <TouchableOpacity
                                            style={[BK.inputBox, showBankDrop && { borderColor: '#2563EB' }]}
                                            onPress={() => setShowBankDrop(p => !p)}
                                            activeOpacity={0.8}
                                        >
                                            {selectedBank ? (
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={BK.bankTag}><Text style={BK.bankTagText}>{selectedBank.shortName}</Text></View>
                                                    <Text style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' }}>{selectedBank.name}</Text>
                                                    <TouchableOpacity onPress={() => { setSelectedBank(null); setAccountNo(''); setAccountNoErr(''); }}>
                                                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <>
                                                    <Ionicons name="search-outline" size={15} color="#94A3B8" />
                                                    <Text style={{ flex: 1, fontSize: 14, color: '#94A3B8' }}>Tìm và chọn ngân hàng...</Text>
                                                    <Ionicons name={showBankDrop ? 'chevron-up' : 'chevron-down'} size={15} color="#94A3B8" />
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        {showBankDrop && (
                                            <View style={BK.drop}>
                                                <View style={BK.dropSearchRow}>
                                                    <Ionicons name="search-outline" size={13} color="#94A3B8" />
                                                    <TextInput
                                                        style={{ flex: 1, fontSize: 13, color: '#0F172A' }}
                                                        placeholder="Tên ngân hàng..."
                                                        placeholderTextColor="#94A3B8"
                                                        value={bankSearch}
                                                        onChangeText={setBankSearch}
                                                        autoFocus
                                                    />
                                                </View>
                                                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
                                                    {filteredBanks.map(b => (
                                                        <TouchableOpacity
                                                            key={b.id}
                                                            style={[BK.dropItem, selectedBank?.id === b.id && BK.dropActive]}
                                                            onPress={() => { setSelectedBank(b); setShowBankDrop(false); setBankSearch(''); setAccountNo(''); setAccountNoErr(''); }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <View style={BK.bankTagSm}><Text style={BK.bankTagSmText}>{b.shortName}</Text></View>
                                                            <Text style={[BK.dropText, selectedBank?.id === b.id && { color: '#2563EB', fontWeight: '700' }]}>{b.name}</Text>
                                                            {selectedBank?.id === b.id && <Ionicons name="checkmark-circle" size={14} color="#2563EB" />}
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>

                                    <View style={EI.wrap}>
                                        <Text style={EI.label}>Số tài khoản</Text>
                                        {selectedBank && (
                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                                                {selectedBank.minLen === selectedBank.maxLen ? `${selectedBank.minLen} chữ số` : `${selectedBank.minLen}–${selectedBank.maxLen} chữ số`}
                                            </Text>
                                        )}
                                        <TextInput
                                            style={[EI.input, accountNoErr && { borderColor: '#EF4444' }]}
                                            placeholder="Nhập số tài khoản..."
                                            placeholderTextColor="#CBD5E1"
                                            keyboardType="numeric"
                                            value={accountNo}
                                            onChangeText={handleAccountNoChange}
                                            editable={!!selectedBank}
                                        />
                                        {accountNoErr ? <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{accountNoErr}</Text> : null}
                                    </View>

                                    <EditInput
                                        label="Tên chủ tài khoản"
                                        value={accountName}
                                        onChange={t => setAccountName(t.toUpperCase())}
                                    />

                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                                        <TouchableOpacity style={S.cancelBtn} onPress={() => {
                                            setEditing(false);
                                            setSelectedBank(userDetail?.bank ? BANKS.find(b => b.id === userDetail.bank.id) || null : null);
                                            setAccountNo(userDetail?.bank?.accountNo || '');
                                            setAccountName(userDetail?.bank?.accountName || '');
                                            setAccountNoErr('');
                                            setShowBankDrop(false);
                                        }}>
                                            <Text style={S.cancelBtnText}>Huỷ</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={saving}>
                                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={S.saveBtnText}>Lưu thay đổi</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </>) : (
                                    <View style={S.infoGrid}>
                                        <View style={S.infoCol}>
                                            <InfoField label="Họ và tên" value={userDetail?.name} />
                                            <InfoField label="Email" value={userDetail?.email} />
                                        </View>
                                        <View style={S.infoCol}>
                                            <InfoField label="Chức danh" value={userDetail?.title || roleLabel} />
                                            <InfoField label="Số điện thoại" value={userDetail?.phone} />
                                        </View>
                                        {userDetail?.address && (
                                            <View style={{ width: '100%' }}>
                                                <InfoField label="Địa chỉ" value={userDetail.address} />
                                            </View>
                                        )}
                                        {isCompany && (userDetail?.contactName || userDetail?.contactPhone) && (
                                            <View style={{ width: '100%', marginTop: 8 }}>
                                                <InfoField label="Người liên hệ" value={`${userDetail.contactName || ''} ${userDetail.contactPhone ? `· ${userDetail.contactPhone}` : ''}`.trim()} />
                                            </View>
                                        )}
                                        {userDetail?.bank && (
                                            <View style={{ width: '100%', marginTop: 8 }}>
                                                <InfoField
                                                    label="Ngân hàng"
                                                    value={`${userDetail.bank.name} · ${userDetail.bank.accountNo} · ${userDetail.bank.accountName}`}
                                                />
                                            </View>
                                        )}

                                    </View>
                                )}
                            </View>

                            {/* 🆕 Mã giới thiệu - chỉ hiển thị nếu có referralCode hoặc advisor */}
                            {(userDetail?.referralCode || userDetail?.advisor) && (
                                <View style={S.card}>
                                    <View style={S.cardHeader}>
                                        <Text style={S.cardTitle}>Mã giới thiệu</Text>
                                    </View>
                                    <View style={S.infoGrid}>
                                        {userDetail?.referralCode && (
                                            <View style={S.infoCol}>
                                                <InfoField label="Mã giới thiệu của bạn" value={userDetail.referralCode} />
                                            </View>
                                        )}
                                        {userDetail?.advisor && (
                                            <View style={S.infoCol}>
                                                <InfoField label="Người giới thiệu" value={userDetail.advisor} />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Bảo mật + Thông báo — 2 cột */}
                            <View style={S.twoCol}>
                                <View style={[S.card, { flex: 1 }]}>
                                    <View style={S.sectionIconHeader}>
                                        <View style={S.sectionIcon}><Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" /></View>
                                        <Text style={S.cardTitle}>Bảo mật</Text>
                                    </View>
                                    <TouchableOpacity style={S.secRow} onPress={() => { router.replace("auth/changePassword") }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={S.secRowTitle}>Mật khẩu</Text>
                                            <Text style={S.secRowSub}>Cập nhật định kỳ</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                    </TouchableOpacity>
                                </View>

                                <View style={[S.card, { flex: 1 }]}>
                                    <View style={S.sectionIconHeader}>
                                        <View style={S.sectionIcon}><Ionicons name="notifications-outline" size={18} color="#2563EB" /></View>
                                        <Text style={S.cardTitle}>Thông báo</Text>
                                    </View>
                                    <ToggleRow icon="phone-portrait-outline" label="Thông báo đẩy" value={notifyPush} onChange={v => handleToggleNotify('push', v)} />
                                    <View style={{ height: 0.5, backgroundColor: '#F1F5F9' }} />
                                    <ToggleRow icon="mail-outline" label="Báo cáo qua Email" value={notifyEmail} onChange={v => handleToggleNotify('email', v)} />
                                </View>
                            </View>

                        </View>
                    </View>
                    <View style={{ height: 60 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View >
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    editBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
    scroll: { padding: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 32 : 16 },
    body: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', gap: 20, alignItems: 'flex-start' },
    leftCol: { width: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 260 : '100%', flexShrink: 0 },
    rightCol: { flex: 1, minWidth: 0, gap: 14 },
    avatarCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarText: { fontSize: 34, fontWeight: '900', color: '#fff' },
    avatarName: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
    avatarTitle: { fontSize: 13, color: '#64748B', marginBottom: 12, textAlign: 'center' },
    badges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#EFF6FF' },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
    miniContacts: { width: '100%', gap: 8, borderTopWidth: 0.5, borderTopColor: '#F1F5F9', paddingTop: 14, marginTop: 4 },
    miniContact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    miniContactText: { fontSize: 12, color: '#64748B', flex: 1 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    inlineEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EFF6FF' },
    inlineEditText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    infoGrid: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', flexWrap: 'wrap', gap: 0 },
    infoCol: { flex: 1, minWidth: 180 },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: '#F1F5F9' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: '#2563EB' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    sectionIconHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    sectionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    secRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    secRowTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    secRowSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    secDivider: { height: 0.5, backgroundColor: '#F1F5F9' },
    twoCol: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', gap: 14 },
    sysGrid: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', gap: 16 },
    sysItem: { flex: 1 },
    sysLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 10 },
    sysSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10 },
    sysSelectText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
    sysTz: { fontSize: 14, color: '#0F172A', fontWeight: '500', paddingVertical: 11 },
    dangerCard: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', alignItems: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'center' : 'flex-start', gap: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: '#FCA5A5' },
    dangerTitle: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
    dangerSub: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },
    dangerBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#EF4444', borderRadius: 10, flexShrink: 0 },
    dangerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

const BK = StyleSheet.create({
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    bankTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    bankTagText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
    bankTagSm: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    bankTagSmText: { fontSize: 10, fontWeight: '800', color: '#2563EB' },
    drop: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 6 },
    dropSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    dropActive: { backgroundColor: '#EFF6FF' },
    dropText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
});