import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CustomerView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [search, setSearch] = useState('');

  const customerList = userDetail?.customer || [];
  const filteredList = search.trim() === ''
    ? customerList
    : customerList.filter(c =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    );

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push({
        pathname: '/CustomerView/[customerID]',
        params: { customerid: item?.id, customerParam: JSON.stringify(item) }
      })}
    >
      <View style={[styles.avatar, { backgroundColor: Colors.Avatar[index % Colors.Avatar.length] }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="call-outline" size={12} color={Colors.Gray} />
          <Text style={styles.cardMetaText}>{item.phone || 'Chưa có SĐT'}</Text>
          {item.address ? (
            <>
              <Text style={styles.dot}>•</Text>
              <Ionicons name="location-outline" size={12} color={Colors.Gray} />
              <Text style={styles.cardMetaText} numberOfLines={1}>{item.address}</Text>
            </>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.LightGray} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>MANAGEMENT</Text>
          <Text style={styles.title}>Khách hàng</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/addCustomer')} activeOpacity={0.8}>
          <Ionicons name="person-add-outline" size={18} color={Colors.White} />
          <Text style={styles.addBtnText}>Thêm mới</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        {[
          { number: customerList.length, label: 'Tổng KH' },
          { number: customerList.filter(c => c.createdAt && new Date(c.createdAt) > new Date(Date.now() - 7 * 86400000)).length, label: 'Tuần này' },
          { number: customerList.filter(c => c.createdAt && new Date(c.createdAt) > new Date(Date.now() - 30 * 86400000)).length, label: 'Tháng này' },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={styles.statDivider} />}
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{s.number}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={Colors.Gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên hoặc SĐT..."
          placeholderTextColor={Colors.LightGray}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.Gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Section label */}
      {filteredList.length > 0 && (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{search ? `Kết quả (${filteredList.length})` : 'TẤT CẢ KHÁCH HÀNG'}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredList.length}</Text>
          </View>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filteredList}
        renderItem={renderItem}
        keyExtractor={(item, index) => item?.id?.toString() || index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredList.length === 0 ? styles.emptyContainer : { gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={40} color={Colors.Primary} />
            </View>
            <Text style={styles.emptyTitle}>{search ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng nào'}</Text>
            <Text style={styles.emptySubtitle}>{search ? 'Thử tìm với từ khóa khác' : 'Bấm "Thêm mới" để tạo khách hàng đầu tiên'}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/addCustomer')}>
                <Ionicons name="person-add-outline" size={16} color={Colors.White} />
                <Text style={styles.emptyBtnText}>Thêm khách hàng</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.Background, paddingHorizontal: 16, paddingTop: 30, width: Dimensions.get('screen').width },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '600', color: Colors.Gray, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.TextPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.Primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6, shadowColor: Colors.Primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  addBtnText: { color: Colors.White, fontWeight: '700', fontSize: 13 },
  statsCard: { backgroundColor: Colors.White, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16, shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', color: Colors.TextPrimary },
  statLabel: { fontSize: 11, color: Colors.Gray, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.DividerLight },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.White, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 8, shadowColor: Colors.Black, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.TextPrimary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.Gray, letterSpacing: 1 },
  countBadge: { backgroundColor: Colors.PrimaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontWeight: '700', color: Colors.Primary },
  card: { backgroundColor: Colors.White, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: Colors.Black, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: Colors.White, fontWeight: '800', fontSize: 16 },
  cardInfo: { flex: 1, gap: 5 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.TextPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardMetaText: { fontSize: 12, color: Colors.Gray },
  dot: { fontSize: 10, color: Colors.LightGray },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.PrimaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.TextSecondary },
  emptySubtitle: { fontSize: 13, color: Colors.LightGray, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.Primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 6, marginTop: 8 },
  emptyBtnText: { color: Colors.White, fontWeight: '700', fontSize: 13 },
});