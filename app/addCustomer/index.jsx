// app/addCustomer/index.jsx

import BgWatermark from '@/components/Main/BgWatermark';
import { useLayout } from '@/components/Main/TabScreenLayout';
import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../components/Main/showAlert';
import { showSuccess } from '../../components/Main/showSuccess';
import { db } from '../../config/firebaseConfig';


export default function AddCustomer() {
  const router = useRouter();
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();
  const { userDetail, setUserDetail } = useContext(UserDetailContext);
  const params = useLocalSearchParams();

  const consultCreatedBy = params.consultCreatedBy || '';

  const consultDocId = params.consultDocId || '';
  const fromConsult = params.fromConsult === 'true';

  const [form, setForm] = useState({
    name: params.name || '',
    phone: params.phone || '',
    email: params.email || '',
    address: params.address || '',
    note: params.note || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCancel = async () => {
    if (consultDocId && fromConsult) {
      try {
        await updateDoc(doc(db, 'consult', consultDocId), {
          status: 'pending'
        });
        router.replace('(tabs)/customerCTV');
      } catch (e) {
        console.error('Rollback lỗi:', e);
      }
    }
    router.replace('(tabs)/customer');
  }


  const checkingDuplicate = async () => {
    const normalizePhone = (phone) => phone.replace(/\s+/g, '').trim();
    const userQuery = await getDocs(
      query(collection(db, 'customers'), where('phone', '==', normalizePhone(form.phone)))
    );

    if (userQuery.empty) {
      return false;
    } else {
      showAlert("Đã tồn tại khách hàng trên hệ thống, vui lòng liên hệ quản trị viên để biết thêm thông tin ")
      handleCancel()
      return true;
    }
  };

  // Thêm hàm calculateHierarchy ngay sau các state, trước handleSave
  const calculateHierarchy = async (userEmail, userDetail) => {
    let rootAdvisor = userEmail;
    let level = 1;
    let currentEmail = userEmail;
    let currentUser = userDetail;

    while (currentUser?.advisor) {
      level++;
      rootAdvisor = currentUser.advisor;
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.advisor));
        if (userSnap.exists()) {
          currentUser = userSnap.data();
        } else {
          break;
        }
      } catch (err) {
        break;
      }
    }
    return { rootAdvisor, level };
  };

  // Sửa handleSave:
  const handleSave = async () => {
    if (!form.name || !form.phone) {
      showAlert('THÔNG BÁO', 'VUI LÒNG NHẬP HỌ TÊN VÀ ĐIỆN THOẠI');
      return;
    }
    setSubmitting(true);
    if (await checkingDuplicate()) return;

    try {
      // Tính rootAdvisor và level trước khi tạo object
      const { rootAdvisor, level } = await calculateHierarchy(userDetail.email, userDetail);

      const newCustomer = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || '',
        address: form.address?.trim() || '',
        note: form.note?.trim() || '',
        rootAdvisor: rootAdvisor,
        level: level,
        createdBy: consultCreatedBy || userDetail?.email,
      };

      await setDoc(doc(db, 'customers', newCustomer.phone), newCustomer, { merge: true });

      setUserDetail(prev => ({ ...prev, customer: [...(prev.customer || []), newCustomer] }));
      showSuccess('Thành công', 'Đã lưu khách hàng!', async () => {
        router.back();
      });
    } catch (e) {
      console.error('Lỗi:', e.code, e.message);
      Alert.alert('Lỗi', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // WEB LAYOUT
  // ─────────────────────────────────────────────────────────
  return isDesktop ? (
    <View style={W.root}>
      <BgWatermark />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={W.scroll}>

        {/* Page header */}
        <View style={W.pageHeader}>
          <View>
            <Text style={W.pageTitle}>Thêm khách hàng mới</Text>
            <Text style={W.pageSub}>Điền thông tin để thêm khách hàng vào danh sách của bạn</Text>
          </View>
          <TouchableOpacity style={W.cancelBtn} onPress={() => handleCancel()}>
            <Ionicons name="close" size={16} color="#64748B" />
            <Text style={W.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
        </View>

        <View style={W.grid}>
          {/* LEFT */}
          <View style={W.col}>

            {/* Thông tin cá nhân */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="person-circle-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Thông tin cá nhân</Text>
                <Text style={W.cardRequired}>* Bắt buộc</Text>
              </View>

              {/* Tên + SĐT — 2 cột */}
              <View style={W.row2}>
                <View style={[W.inputGroup, { flex: 1 }]}>
                  <Text style={W.label}>Họ và tên <Text style={W.required}>*</Text></Text>
                  <View style={W.inputBox}>
                    <TextInput
                      style={W.input}
                      placeholder="Nguyễn Văn A"
                      placeholderTextColor="#94A3B8"
                      value={form.name}
                      onChangeText={v => handleChange('name', v)}
                    />
                  </View>
                </View>
                <View style={[W.inputGroup, { flex: 1 }]}>
                  <Text style={W.label}>Số điện thoại <Text style={W.required}>*</Text></Text>
                  <View style={W.inputBox}>
                    <TextInput
                      style={W.input}
                      placeholder="0901 234 567"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={form.phone}
                      onChangeText={v => handleChange('phone', v)}
                    />
                  </View>
                </View>
              </View>

              {/* Email */}
              <View style={W.inputGroup}>
                <Text style={W.label}>Email</Text>
                <View style={W.inputBox}>
                  <Ionicons name="mail-outline" size={16} color="#94A3B8" />
                  <TextInput
                    style={W.input}
                    placeholder="example@company.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={form.email}
                    onChangeText={v => handleChange('email', v)}
                  />
                </View>
              </View>
            </View>

            {/* Địa chỉ */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="location-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Địa chỉ & Ghi chú</Text>
              </View>

              <View style={W.inputGroup}>
                <Text style={W.label}>Địa chỉ thường trú</Text>
                <View style={W.inputBox}>
                  <Ionicons name="home-outline" size={16} color="#94A3B8" />
                  <TextInput
                    style={W.input}
                    placeholder="Số nhà, tên đường, phường/xã..."
                    placeholderTextColor="#94A3B8"
                    value={form.address}
                    onChangeText={v => handleChange('address', v)}
                  />
                </View>
              </View>

              <View style={W.inputGroup}>
                <Text style={W.label}>Ghi chú</Text>
                <View style={[W.inputBox, { alignItems: 'flex-start', minHeight: 90 }]}>
                  <TextInput
                    style={[W.input, { textAlignVertical: 'top' }]}
                    placeholder="Thông tin bổ sung về sở thích hoặc lịch sử giao dịch..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={form.note}
                    onChangeText={v => handleChange('note', v)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* RIGHT — Preview + Save */}
          <View style={W.colRight}>

            {/* Preview card */}
            <View style={W.card}>
              <View style={W.cardHeader}>
                <Ionicons name="eye-outline" size={16} color="#2563EB" />
                <Text style={W.cardTitle}>Xem trước</Text>
              </View>

              <View style={W.previewAvatar}>
                <Text style={W.previewAvatarText}>
                  {form.name
                    ? form.name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : '?'}
                </Text>
              </View>
              <Text style={W.previewName}>{form.name || 'Họ và tên'}</Text>
              <Text style={W.previewSub}>{form.phone || 'Số điện thoại'}</Text>

              <View style={W.previewDivider} />

              {[
                { icon: 'mail-outline', label: 'Email', value: form.email },
                { icon: 'location-outline', label: 'Địa chỉ', value: form.address },
              ].map(item => (
                <View key={item.label} style={W.previewRow}>
                  <Ionicons name={item.icon} size={14} color="#94A3B8" />
                  <View style={{ flex: 1 }}>
                    <Text style={W.previewRowLabel}>{item.label}</Text>
                    <Text style={W.previewRowValue} numberOfLines={1}>
                      {item.value || '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[W.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Ionicons name={submitting ? 'hourglass-outline' : 'save-outline'} size={16} color="#fff" />
              <Text style={W.submitBtnText}>{submitting ? 'Đang lưu...' : 'Lưu khách hàng'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={W.cancelBtnFull} onPress={() => handleCancel()}>
              <Text style={W.cancelBtnFullText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  ) :

    // ─────────────────────────────────────────────────────────
    // MOBILE LAYOUT
    // ─────────────────────────────────────────────────────────
    (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BgWatermark />
        <StatusBar barStyle="dark-content" backgroundColor={Colors.Background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => handleCancel()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo khách hàng mới</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.Primary} />
                <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
              </View>
              {[
                { label: 'Họ và tên', field: 'name', placeholder: 'Nguyễn Văn A', required: true },
                { label: 'Số điện thoại', field: 'phone', placeholder: '0901 234 567', required: true, keyboard: 'phone-pad' },
                { label: 'Email', field: 'email', placeholder: 'example@company.com', keyboard: 'email-address' },
              ].map(f => (
                <View style={styles.inputGroup} key={f.field}>
                  <Text style={styles.label}>
                    {f.label}{f.required && <Text style={styles.required}> *</Text>}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.TextPlaceholder}
                    keyboardType={f.keyboard || 'default'}
                    autoCapitalize="none"
                    value={form[f.field]}
                    onChangeText={v => handleChange(f.field, v)}
                  />
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={20} color={Colors.Primary} />
                <Text style={styles.sectionTitle}>Địa chỉ & Ghi chú</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Địa chỉ thường trú</Text>
                <TextInput style={styles.input} placeholder="Số nhà, tên đường, phường/xã..." placeholderTextColor={Colors.TextPlaceholder} value={form.address} onChangeText={v => handleChange('address', v)} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ghi chú</Text>
                <TextInput style={styles.textArea} placeholder="Thông tin bổ sung..." placeholderTextColor={Colors.TextPlaceholder} multiline numberOfLines={4} textAlignVertical="top" value={form.note} onChangeText={v => handleChange('note', v)} />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Ionicons name="save-outline" size={18} color={Colors.White} />
              <Text style={styles.saveBtnText}>Lưu khách hàng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel()} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>
            <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
}

// ── Web Styles ───────────────────────────────────────────────
const W = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 14,
    color: '#64748B',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  grid: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  col: {
    flex: 3,
  },
  colRight: {
    flex: 2,
    gap: 16,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  cardRequired: {
    fontSize: 11,
    color: '#94A3B8',
  },

  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  required: {
    color: '#EF4444',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },

  // Preview
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  previewAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  previewSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  previewRowLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  previewRowValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    marginTop: 1,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtnFull: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnFullText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});

// ── Mobile Styles — giữ nguyên ───────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.Background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.Background },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.TextPrimary },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  section: { backgroundColor: Colors.White, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.TextPrimary, marginLeft: 6 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.Gray, marginBottom: 6, letterSpacing: 0.3 },
  required: { color: Colors.Danger },
  input: { backgroundColor: Colors.Background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.TextPrimary, borderWidth: 1, borderColor: Colors.Border },
  textArea: { backgroundColor: Colors.Background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.TextPrimary, borderWidth: 1, borderColor: Colors.Border, minHeight: 100 },
  saveBtn: { backgroundColor: Colors.Primary, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, shadowColor: Colors.Primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  saveBtnText: { color: Colors.White, fontSize: 15, fontWeight: '700', marginLeft: 6 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: Colors.Gray, fontSize: 14, fontWeight: '600' },
});