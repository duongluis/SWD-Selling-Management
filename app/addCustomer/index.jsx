import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useContext, useState } from 'react';
import {
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
import { db } from '../../config/firebaseConfig';


export default function addCustomer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { userDetail, setUserDetail } = useContext(UserDetailContext)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
    agency: userDetail.gmail
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };


  const newCustomer = {
    ...form,
    id: Date.now().toString(), // id unique cho mỗi khách hàng
    createdAt: new Date().toISOString(),
  };

  const handleSave = async () => {
    console.log('Lưu khách hàng:', form);
    await updateDoc(doc(db, 'customers', form.agency), form)
    await updateDoc(doc(db, 'users', userDetail.gmail), {
      customer: arrayUnion(newCustomer)
    });
    await setUserDetail(prev => ({
      ...prev,
      customer: [...(prev.customer || []), form.name]
    }));
    router.back()
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo khách hàng mới</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={20} color="#2196F3" />
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                style={styles.input}
                placeholder="Nguyễn Văn A"
                placeholderTextColor="#C0C0C0"
                value={form.name}
                onChangeText={v => handleChange('name', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="0901 234 567"
                placeholderTextColor="#C0C0C0"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={v => handleChange('phone', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="example@company.com"
                placeholderTextColor="#C0C0C0"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={v => handleChange('email', v)}
              />
            </View>
          </View>

          {/* Address & Note Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color="#2196F3" />
              <Text style={styles.sectionTitle}>Địa chỉ & Ghi chú</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Địa chỉ thường trú</Text>
              <TextInput
                style={styles.input}
                placeholder="Số nhà, tên đường, phường/xã..."
                placeholderTextColor="#C0C0C0"
                value={form.address}
                onChangeText={v => handleChange('address', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Thông tin bổ sung về sở thích hoặc lịch sử giao dịch..."
                placeholderTextColor="#C0C0C0"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={form.note}
                focusable="true"
                onChangeText={v => handleChange('note', v)}
              />
            </View>
          </View>

          {/* Buttons */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Ionicons name="save-outline" size={18} color="#fff" />
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
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F7FA',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Section Card
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginLeft: 6,
  },

  // Input
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  textArea: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    minHeight: 100,
  },

  // Buttons
  saveBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#2196F3',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#9E9E9E',
    fontSize: 14,
    fontWeight: '600',
  },
});