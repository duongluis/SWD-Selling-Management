import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = ['#2196F3', '#9C27B0', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#795548'];

export default function CustomerView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);
  const [search, setSearch] = useState('');

  useEffect(() =>{
    console.log("userDetail o phan customer: ",userDetail)
  },[])
  
  // Lấy danh sách khách hàng từ context
  const customerList = userDetail?.customer || [];

  // 2 khách hàng mới nhất (sort theo createdAt)
const recentCustomers = [...customerList]
  .filter(c => c && c.name)                        
  .sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  })
  .slice(0, 2);

  // Tất cả trừ 2 recent
  const recentIds = new Set(recentCustomers.map(c => c.id));
  const otherCustomers = customerList.filter(c => !recentIds.has(c.id));

  // Filter theo search
  const filteredRecent = recentCustomers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredAll = otherCustomers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderCustomer = ({ item, index }) => (
    <TouchableOpacity
      style={styles.customerCard}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: '/customerDetail/' + (item.id ?? index),
        params: { customerParam: JSON.stringify(item) }
      })}
    >
      <View style={[styles.avatarCircle, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.activityRow}>
          <View style={[styles.activityIconWrap, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="call-outline" size={12} color="#2196F3" />
          </View>
          <Text style={styles.activity}>{item.phone || 'Chưa có SĐT'}</Text>
        </View>
        {item.email ? (
          <View style={[styles.activityRow, { marginTop: 3 }]}>
            <View style={[styles.activityIconWrap, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="mail-outline" size={12} color="#9C27B0" />
            </View>
            <Text style={styles.activity} numberOfLines={1}>{item.email}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#C5C5C5" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dashboardLabel}>MANAGEMENT</Text>
          <Text style={styles.title}>Customers</Text>
        </View>
        <View style={styles.icons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/addCustomer')}
          >
            <Ionicons name="person-add-outline" size={20} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]}>
            <Ionicons name="filter-outline" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9E9E9E" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Tìm khách hàng..."
          placeholderTextColor="#B0B0B0"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9E9E9E" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="people-outline" size={18} color="#2196F3" />
            <Text style={styles.statNumber}>{customerList.length}</Text>
            <Text style={styles.statLabel}>TỔNG</Text>
          </View>
          <View style={[styles.statBox, { marginHorizontal: 12 }]}>
            <Ionicons name="pulse-outline" size={18} color="#4CAF50" />
            <Text style={styles.statNumber}>{recentCustomers.length}</Text>
            <Text style={styles.statLabel}>MỚI NHẤT</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={18} color="#FF9800" />
            <Text style={styles.statNumber}>{otherCustomers.length}</Text>
            <Text style={styles.statLabel}>CÒN LẠI</Text>
          </View>
        </View>

        {/* Recent — 2 khách hàng mới nhất */}
        {filteredRecent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>MỚI THÊM GẦN ĐÂY</Text>
            </View>
            <FlatList
              data={filteredRecent}
              renderItem={({ item, index }) => renderCustomer({ item, index })}
              keyExtractor={(item, index) => item.id ?? index.toString()}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* All Customers */}
        {filteredAll.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>TẤT CẢ KHÁCH HÀNG</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredAll.length}</Text>
              </View>
            </View>
            <FlatList
              data={filteredAll}
              renderItem={({ item, index }) => renderCustomer({ item, index: index + 2 })}
              keyExtractor={(item, index) => item.id ?? index.toString()}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Empty state — chưa có khách hàng nào */}
        {customerList.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#C5C5C5" />
            <Text style={styles.emptyText}>Chưa có khách hàng nào</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/addCustomer')}
            >
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Thêm khách hàng</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state — tìm không thấy */}
        {customerList.length > 0 && filteredRecent.length === 0 && filteredAll.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#C5C5C5" />
            <Text style={styles.emptyText}>Không tìm thấy khách hàng</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingTop: 30,
    width: Dimensions.get('screen').width,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dashboardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9E9E9E',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  icons: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
  },
  countBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  customerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  activity: {
    fontSize: 12,
    color: '#9E9E9E',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    marginTop: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});