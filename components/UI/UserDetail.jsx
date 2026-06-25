// components/UI/UserDetail.jsx — updated with collaboration feature

import { showAlert } from '@/components/Main/showAlert';
import { createSupportRoom } from '@/components/Utils/chatService';
import { fmtCurrency, fmtDate, fmtPhone } from '@/components/Utils/formatters';
import { db } from '@/config/firebaseConfig';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    Dimensions,
    Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { getRole } from '../Utils/roleHelper';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
const hashColor = s => AVATAR_COLORS[(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const ROLE_LABEL = {
    'đại lý': 'Đại lý', 'cộng tác viên': 'CTV', 'Đối tác': 'Đối tác', 'admin': 'Admin',
};

function InfoRow({ icon, label, value }) {
    if (!value) return null;
    return (
        <View style={S.infoRow}>
            <View style={S.infoIconWrap}><Ionicons name={icon} size={13} color="#94A3B8" /></View>
            <Text style={S.infoLabel}>{label}</Text>
            <Text style={S.infoValue} numberOfLines={2}>{value}</Text>
        </View>
    );
}

function Section({ title, children }) {
    return (
        <View style={S.section}>
            <Text style={S.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function NicknameTab({ user, onSaved }) {
    const [nickname, setNickname] = useState(user.nickname || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!nickname.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.email), { nickname: nickname.trim() });
            onSaved?.({ ...user, nickname: nickname.trim() });
        } catch (e) { showAlert('Lỗi', e.message); }
        finally { setSaving(false); }
    };

    return (
        <View style={{ padding: 16 }}>
            <Text style={NT.label}>Biệt danh</Text>
            <Text style={NT.hint}>Tên hiển thị nội bộ, chỉ admin thấy</Text>
            <View style={NT.inputBox}>
                <TextInput
                    style={NT.input}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Nhập biệt danh..."
                    placeholderTextColor="#94A3B8"
                />
            </View>
            <TouchableOpacity
                style={[NT.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
            >
                <Ionicons name="save-outline" size={14} color="#fff" />
                <Text style={NT.saveBtnText}>{saving ? 'Đang lưu...' : 'Lưu biệt danh'}</Text>
            </TouchableOpacity>
            {user.nickname && (
                <View style={NT.currentWrap}>
                    <Text style={NT.currentLabel}>Biệt danh hiện tại:</Text>
                    <Text style={NT.currentValue}>{user.nickname}</Text>
                </View>
            )}
        </View>
    );
}

// ── CollaborationTab ──────────────────────────────────────────
function CollaborationTab({ user, onSaved }) {
    const [collabEmail, setCollabEmail] = useState(user.collaboration || '');
    const [saving, setSaving] = useState(false);
    const [checking, setChecking] = useState(false);

    const handleSave = async () => {
        const email = collabEmail.trim().toLowerCase();
        if (!email) {
            showAlert('Thông báo', 'Vui lòng nhập email cộng tác');
            return;
        }

        // Không cho tự gán cho chính mình
        if (email === user.email?.toLowerCase()) {
            showAlert('Không hợp lệ', 'Không thể gán cộng tác cho chính người dùng này');
            return;
        }

        setChecking(true);
        try {
            // Kiểm tra email có tồn tại trong hệ thống không
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email));
            const snap = await getDocs(q);

            if (snap.empty) {
                showAlert('Không tìm thấy', `Email "${email}" chưa tồn tại trong hệ thống. Vui lòng kiểm tra lại.`);
                setChecking(false);
                return;
            }

            setSaving(true);
            await updateDoc(doc(db, 'users', user.email), { collaboration: email });
            onSaved?.({ ...user, collaboration: email });
            showAlert('Thành công', `Đã gán cộng tác với ${email}`);
        } catch (e) {
            showAlert('Lỗi', e.message);
        } finally {
            setChecking(false);
            setSaving(false);
        }
    };

    const handleRemove = () => {
        showAlert('Xác nhận', 'Bỏ liên kết cộng tác này?', async () => {
            try {
                await updateDoc(doc(db, 'users', user.email), { collaboration: null });
                setCollabEmail('');
                onSaved?.({ ...user, collaboration: null });
            } catch (e) {
                showAlert('Lỗi', e.message);
            }
        });
    };

    const isBusy = saving || checking;

    return (
        <View style={{ padding: 16 }}>
            <Text style={NT.label}>Cộng tác viên nhận thưởng</Text>
            <Text style={NT.hint}>
                Nhập email để gán thưởng khi người dùng này có đơn hàng.{'\n'}
                Người được gán sẽ nhận 1% giá sản phẩm tương ứng vai trò của họ.
            </Text>

            <View style={NT.inputBox}>
                <TextInput
                    style={NT.input}
                    value={collabEmail}
                    onChangeText={setCollabEmail}
                    placeholder="Nhập email cộng tác..."
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>

            <TouchableOpacity
                style={[NT.saveBtn, { backgroundColor: '#7C3AED' }, isBusy && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={isBusy}
            >
                <Ionicons name={checking ? 'sync-outline' : 'link-outline'} size={14} color="#fff" />
                <Text style={NT.saveBtnText}>
                    {checking ? 'Đang kiểm tra...' : saving ? 'Đang lưu...' : 'Lưu cộng tác'}
                </Text>
            </TouchableOpacity>

            {user.collaboration && (
                <View style={CL.currentWrap}>
                    <View style={{ flex: 1 }}>
                        <Text style={CL.currentLabel}>Đang cộng tác với:</Text>
                        <Text style={CL.currentValue}>{user.collaboration}</Text>
                    </View>
                    <TouchableOpacity style={CL.removeBtn} onPress={handleRemove}>
                        <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={CL.infoBox}>
                <Ionicons name="information-circle-outline" size={14} color="#7C3AED" />
                <Text style={CL.infoText}>
                    Thưởng = 1% × giá sản phẩm theo vai trò của người được gán, tính trên mỗi đơn hàng của người dùng này.
                </Text>
            </View>
        </View>
    );
}

const CL = StyleSheet.create({
    currentWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, backgroundColor: '#F5F3FF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE' },
    currentLabel: { fontSize: 11, color: '#64748B', marginBottom: 2 },
    currentValue: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
    removeBtn: { padding: 4 },
    infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 12, backgroundColor: '#FAF5FF', borderRadius: 10, borderWidth: 1, borderColor: '#EDE9FE' },
    infoText: { flex: 1, fontSize: 11, color: '#6D28D9', lineHeight: 16 },
});

export default function UserDetail({ user, onClose, onUpdated }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const isAdminUser = getRole(userDetail) === 'admin';
    const [local, setLocal] = useState(null);
    const [approving, setApproving] = useState(false);
    const [tab, setTab] = useState('info');

    useEffect(() => { if (user) setLocal(user); }, [user]);
    if (!user || !local) return null;

    const color = hashColor(local.email);
    const isCompany = local.bizModel === 'company';
    const verified = !!local.verified;
    const locked = !!local.locked;
    const roleLabel = ROLE_LABEL[local.role || local.member] || local.role || '—';

    const handleLock = () => {
        const action = locked ? 'Mở khóa' : 'Khóa';
        showAlert(action, `${action} tài khoản "${local.name}"?`, async () => {
            try {
                await updateDoc(doc(db, 'users', local.email), { locked: !locked });
                const next = { ...local, locked: !locked };
                setLocal(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
        });
    };

    const handleApprove = () => {
        showAlert('Phê duyệt', `Phê duyệt tài khoản "${local.name}"?`, async () => {
            setApproving(true);
            try {
                await updateDoc(doc(db, 'users', local.email), { verified: true });
                const next = { ...local, verified: true };
                createSupportRoom({
                    userEmail: local.email,
                    userName: local.name || local.email,
                }).catch(err => console.warn('Lỗi tạo phòng support:', err));
                setLocal(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setApproving(false); }
        });
    };

    const TABS = isAdminUser
        ? [
            { key: 'info', label: 'Thông tin', icon: 'person-outline' },
            { key: 'nickname', label: 'Biệt danh', icon: 'pricetag-outline' },
            { key: 'collaboration', label: 'Cộng tác', icon: 'link-outline' },
        ]
        : [];

    return (
        <View style={S.panel}>
            {/* Header */}
            <View style={S.header}>
                <View style={S.headerTop}>
                    <TouchableOpacity style={S.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={S.title} numberOfLines={1}>{local.name || local.companyName || '—'}</Text>
                        <Text style={S.subtitle} numberOfLines={1}>{local.email}</Text>
                    </View>
                    {locked ? (
                        <View style={[S.verBadge, { backgroundColor: '#FEF2F2' }]}>
                            <Ionicons name="lock-closed" size={13} color="#DC2626" />
                            <Text style={[S.verText, { color: '#DC2626' }]}>Bị khóa</Text>
                        </View>
                    ) : (
                        <View style={[S.verBadge, verified ? S.verBadgeOk : S.verBadgePending]}>
                            <Ionicons name={verified ? 'checkmark-circle' : 'time'} size={13} color={verified ? '#16A34A' : '#D97706'} />
                            <Text style={[S.verText, { color: verified ? '#16A34A' : '#D97706' }]}>{verified ? 'Đã xác minh' : 'Chờ duyệt'}</Text>
                        </View>
                    )}
                </View>
                {/* Actions */}
                <View style={S.actions}>
                    {!verified && (
                        <TouchableOpacity style={[S.aBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                            onPress={handleApprove} disabled={approving}>
                            <Ionicons name="checkmark-circle-outline" size={13} color="#059669" />
                            <Text style={[S.aBtnText, { color: '#059669' }]}>{approving ? 'Đang xử lý...' : 'Phê duyệt'}</Text>
                        </TouchableOpacity>
                    )}
                    {isAdminUser && (
                        <>
                            <TouchableOpacity
                                style={[S.aBtn, locked ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                                onPress={handleLock}>
                                <Ionicons name={locked ? 'lock-open-outline' : 'lock-closed-outline'} size={13} color={locked ? '#059669' : '#DC2626'} />
                                <Text style={[S.aBtnText, { color: locked ? '#059669' : '#DC2626' }]}>{locked ? 'Mở khóa' : 'Khóa TK'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={S.aBtn}
                                onPress={() => router.push({ pathname: '/editUser/[userEmail]', params: { userEmail: local.email, userParam: JSON.stringify(local) } })}>
                                <Ionicons name="create-outline" size={13} color="#2563EB" />
                                <Text style={S.aBtnText}>Chỉnh sửa</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* Tabs — chỉ admin */}
            {isAdminUser && (
                <View style={S.tabs}>
                    {TABS.map(t => (
                        <TouchableOpacity
                            key={t.key}
                            style={[S.tab, tab === t.key && S.tabActive]}
                            onPress={() => setTab(t.key)}
                        >
                            <Ionicons name={t.icon} size={13} color={tab === t.key ? '#2563EB' : '#94A3B8'} />
                            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Content theo tab */}
            {tab === 'nickname' ? (
                <NicknameTab
                    user={local}
                    onSaved={next => { setLocal(next); onUpdated?.(next); }}
                />
            ) : tab === 'collaboration' ? (
                <CollaborationTab
                    user={local}
                    onSaved={next => { setLocal(next); onUpdated?.(next); }}
                />
            ) : (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true} >
                    <Section title="Thông tin tài khoản">
                        <InfoRow icon="mail-outline" label="Email" value={local.email} />
                        <InfoRow icon="call-outline" label="Điện thoại" value={fmtPhone(local.phone)} />
                        <InfoRow icon="location-outline" label="Địa chỉ" value={local.address} />
                        <InfoRow icon="briefcase-outline" label="Vai trò" value={roleLabel} />
                        {local.referralCode && (
                            <InfoRow icon="pricetag-outline" label="Mã giới thiệu" value={local.referralCode} />
                        )}
                        {local.advisor && (
                            <InfoRow icon="person-add-outline" label="Người giới thiệu" value={local.advisor} />
                        )}
                        {local.collaboration && (
                            <InfoRow icon="link-outline" label="Cộng tác" value={local.collaboration} />
                        )}
                        <InfoRow icon="calendar-outline" label="Ngày tạo" value={fmtDate(local.createdAt)} />
                    </Section>

                    {isCompany && (
                        <Section title="Thông tin doanh nghiệp">
                            <InfoRow icon="business-outline" label="Công ty" value={local.companyName} />
                            <InfoRow icon="document-text-outline" label="MST" value={local.taxCode} />
                            <InfoRow icon="location-outline" label="Địa chỉ KD" value={local.bizAddress} />
                            {local.contactName && (
                                <InfoRow icon="person-outline" label="Người LH"
                                    value={`${local.contactName} · ${fmtPhone(local.contactPhone)}`} />
                            )}
                        </Section>
                    )}

                    {local.committedRevenue > 0 && (
                        <Section title="Cam kết kinh doanh">
                            <InfoRow icon="trending-up-outline" label="Cam kết/năm" value={fmtCurrency(local.committedRevenue)} />
                            <InfoRow icon="git-branch-outline" label="Phân phối"
                                value={local.distributionType === 'exclusive' ? 'Độc quyền' : 'Không độc quyền'} />
                            <InfoRow icon="map-outline" label="Khu vực" value={local.regionName || local.region} />
                        </Section>
                    )}

                    {local.bank && (
                        <Section title="Ngân hàng">
                            <InfoRow icon="card-outline" label="Ngân hàng" value={local.bank.name} />
                            <InfoRow icon="keypad-outline" label="Số TK" value={local.bank.accountNo} />
                            <InfoRow icon="person-outline" label="Chủ TK" value={local.bank.accountName} />
                        </Section>
                    )}

                    {local.revenueTotal > 0 && (
                        <View style={S.totalBar}>
                            <Text style={S.totalLabel}>Tổng doanh số</Text>
                            <Text style={S.totalValue}>{fmtCurrency(local.revenueTotal)}</Text>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )
            }
        </View >
    );
}

const NT = StyleSheet.create({
    label: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    hint: { fontSize: 11, color: '#94A3B8', marginBottom: 12, lineHeight: 16 },
    inputBox: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 12 },
    input: { fontSize: 14, color: '#0F172A' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 11 },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    currentWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 10 },
    currentLabel: { fontSize: 12, color: '#64748B' },
    currentValue: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
});

const S = StyleSheet.create({
    panel: { width: 360, backgroundColor: '#fff', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', flexDirection: 'column', borderRadius: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
    header: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    closeBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
    verBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
    verBadgeOk: { backgroundColor: '#ECFDF5' },
    verBadgePending: { backgroundColor: '#FFFBEB' },
    verText: { fontSize: 11, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.07, marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC', gap: 8 },
    infoIconWrap: { width: 20, alignItems: 'center', marginTop: 1 },
    infoLabel: { width: 88, fontSize: 12, color: '#94A3B8', flexShrink: 0 },
    infoValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '500' },
    totalBar: { margin: 16, borderRadius: 12, backgroundColor: '#1E3A5F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    totalLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    totalValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563EB' },
    tabText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    tabTextActive: { color: '#2563EB' },
});