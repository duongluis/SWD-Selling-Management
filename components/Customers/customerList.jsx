import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CustomerList() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);

  // Lấy danh sách khách hàng từ user hiện tại
  const customerList = userDetail?.customer || [];

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarColors = ['#2196F3', '#9C27B0', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#795548'];

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push({
        pathname: '/customerDetail/' + (item.id ?? index),
        params: { customerParam: JSON.stringify(item) }
      })}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="call-outline" size={12} color="#9E9E9E" />
          <Text style={styles.meta}>{item.phone || 'Chưa có SĐT'}</Text>
        </View>
        {item.email ? (
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={12} color="#9E9E9E" />
            <Text style={styles.meta} numberOfLines={1}>{item.email}</Text>
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color="#C5C5C5" />
    </TouchableOpacity>
  );

  if (customerList.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color="#C5C5C5" />
        <Text style={styles.emptyTitle}>Chưa có khách hàng</Text>
        <Text style={styles.emptySubtitle}>Bấm "Add Customer" để thêm khách hàng mới</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>DANH SÁCH KHÁCH HÀNG</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{customerList.length}</Text>
        </View>
      </View>

      <FlatList
        data={customerList}
        keyExtractor={(item, index) => item.id ?? index.toString()}
        renderItem={renderItem}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    color: '#9E9E9E',
    flex: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B0B0B0',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#C5C5C5',
    textAlign: 'center',
  },
});