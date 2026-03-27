import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
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

const ordersData = [
  { id: '8492', customer: 'Johnathan Doe', amount: '$124.00', status: 'PENDING', date: 'Today, Oct 25' },
  { id: '8491', customer: 'Sarah Jenkins', amount: '$342.50', status: 'SHIPPED', date: 'Oct 24, 2023' },
  { id: '8488', customer: 'Michael Ross', amount: '$89.00', status: 'CONFIRMED', date: 'Oct 23, 09:15 PM' },
  { id: '8485', customer: 'Amanda Waller', amount: '$210.25', status: 'CONFIRMED', date: 'Oct 22, 06:30 PM' },
];

const STATUS_CONFIG = {
  PENDING:   { color: '#FF9800', bg: '#FFF3E0', icon: 'time-outline' },
  SHIPPED:   { color: '#2196F3', bg: '#E3F2FD', icon: 'cube-outline' },
  CONFIRMED: { color: '#4CAF50', bg: '#E8F5E9', icon: 'checkmark-circle-outline' },
};

const TABS = ['All', 'PENDING', 'SHIPPED', 'CONFIRMED'];
const TAB_LABELS = { All: 'All', PENDING: 'Pending', SHIPPED: 'Shipped', CONFIRMED: 'Confirmed' };

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = ['#2196F3', '#9C27B0', '#FF9800', '#4CAF50', '#F44336', '#00BCD4'];

export default function OrderView() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredOrders = ordersData.filter(order => {
    const matchFilter = filter === 'All' || order.status === filter;
    const matchSearch = order.customer.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalRevenue = ordersData.reduce((sum, o) => sum + parseFloat(o.amount.replace('$', '')), 0);
  const pendingCount = ordersData.filter(o => o.status === 'PENDING').length;
  const shippedCount = ordersData.filter(o => o.status === 'SHIPPED').length;

  const renderOrder = ({ item, index }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
        {/* Left avatar */}
        <View style={[styles.avatarCircle, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
          <Text style={styles.avatarText}>{getInitials(item.customer)}</Text>
        </View>

        {/* Middle info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{item.id}</Text>
          <Text style={styles.customerName}>{item.customer}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={11} color="#9E9E9E" />
            <Text style={styles.dateText}> {item.date}</Text>
          </View>
        </View>

        {/* Right — amount + status */}
        <View style={styles.orderRight}>
          <Text style={styles.amountText}>{item.amount}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}> {item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dashboardLabel}>MANAGEMENT</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="options-outline" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9E9E9E" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search orders..."
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

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="receipt-outline" size={18} color="#2196F3" />
          <Text style={styles.statNumber}>{ordersData.length}</Text>
          <Text style={styles.statLabel}>TOTAL</Text>
        </View>
        <View style={[styles.statBox, { marginHorizontal: 12 }]}>
          <Ionicons name="time-outline" size={18} color="#FF9800" />
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>PENDING</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="cube-outline" size={18} color="#4CAF50" />
          <Text style={styles.statNumber}>{shippedCount}</Text>
          <Text style={styles.statLabel}>SHIPPED</Text>
        </View>
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <View>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <Text style={styles.revenueAmount}>${totalRevenue.toFixed(2)}</Text>
        </View>
        <Ionicons name="trending-up-outline" size={32} color="rgba(255,255,255,0.7)" />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, filter === tab && styles.activeTabItem]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.activeTabText]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#C5C5C5" />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
      />
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

  // Header
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

  // Search
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
  searchBar: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
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

  // Revenue Card
  revenueCard: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2196F3',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  revenueLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  revenueAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Tabs
  tabsScroll: {
    marginBottom: 14,
    flexGrow: 0,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activeTabItem: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  activeTabText: {
    color: '#fff',
  },

  // Order Card
  orderCard: {
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
    fontSize: 14,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 12,
    fontWeight: '500',
  },
});