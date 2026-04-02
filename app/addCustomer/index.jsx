import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayUnion, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebaseConfig';

export default function addCustomer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userDetail, setUserDetail } = useContext(UserDetailContext);

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', note: '' });
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      Alert.alert('Thông báo', 'Vui lòng nhập họ tên và số điện thoại');
      return;
    }
    try {
      const newCustomer = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || '',
        address: form.address?.trim() || '',
        note: form.note?.trim() || '',
      };
      await updateDoc(doc(db, 'users', userDetail.email), {
        customer: arrayUnion(newCustomer),
      });
      await setDoc(doc(db,'orders',newCustomer.name),{})
      setUserDetail(prev => ({ ...prev, customer: [...(prev.customer || []), newCustomer] }));
      Alert.alert('Thành công', 'Đã lưu khách hàng!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error(' Lỗi:', e.code, e.message);
      Alert.alert('Lỗi', e.message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.Background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.TextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo khách hàng mới</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Thông tin cá nhân */}
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
                  {f.label} {f.required && <Text style={styles.required}>*</Text>}
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

          {/* Địa chỉ & Ghi chú */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color={Colors.Primary} />
              <Text style={styles.sectionTitle}>Địa chỉ & Ghi chú</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Địa chỉ thường trú</Text>
              <TextInput
                style={styles.input}
                placeholder="Số nhà, tên đường, phường/xã..."
                placeholderTextColor={Colors.TextPlaceholder}
                value={form.address}
                onChangeText={v => handleChange('address', v)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Thông tin bổ sung về sở thích hoặc lịch sử giao dịch..."
                placeholderTextColor={Colors.TextPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={form.note}
                onChangeText={v => handleChange('note', v)}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Ionicons name="save-outline" size={18} color={Colors.White} />
            <Text style={styles.saveBtnText}>Lưu khách hàng</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.Background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.Background },
  backBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: Colors.TextPrimary },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 8 },
  section:      { backgroundColor: Colors.White, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.TextPrimary, marginLeft: 6 },
  inputGroup:   { marginBottom: 14 },
  label:        { fontSize: 12, fontWeight: '600', color: Colors.Gray, marginBottom: 6, letterSpacing: 0.3 },
  required:     { color: Colors.Danger },
  input:        { backgroundColor: Colors.Background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.TextPrimary, borderWidth: 1, borderColor: Colors.Border },
  textArea:     { backgroundColor: Colors.Background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.TextPrimary, borderWidth: 1, borderColor: Colors.Border, minHeight: 100 },
  saveBtn:      { backgroundColor: Colors.Primary, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, shadowColor: Colors.Primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  saveBtnText:  { color: Colors.White, fontSize: 15, fontWeight: '700', marginLeft: 6 },
  cancelBtn:    { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:{ color: Colors.Gray, fontSize: 14, fontWeight: '600' },
});