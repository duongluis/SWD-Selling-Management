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

const recentActivity = [
  { id: '1', name: 'Alice Johnson', activity: 'Emailed 2 hours ago', icon: 'mail-outline', iconColor: '#2196F3', iconBg: '#E3F2FD' },
  { id: '2', name: 'Bob Smith', activity: 'Called yesterday', icon: 'call-outline', iconColor: '#4CAF50', iconBg: '#E8F5E9' },
];

const allCustomers = [
  { id: '3', name: 'Charlie Davis', activity: 'Meeting scheduled (Oct 24)', icon: 'calendar-outline', iconColor: '#FF9800', iconBg: '#FFF3E0' },
  { id: '4', name: 'Diana Prince', activity: 'New lead from web (Oct 22)', icon: 'globe-outline', iconColor: '#9C27B0', iconBg: '#F3E5F5' },
  { id: '5', name: 'Ethan Hunt', activity: 'Invoice sent (Oct 20)', icon: 'document-text-outline', iconColor: '#2196F3', iconBg: '#E3F2FD' },
  { id: '6', name: 'Fiona L.', activity: 'Pending follow-up (Oct 18)', icon: 'time-outline', iconColor: '#F44336', iconBg: '#FFEBEE' },
  { id: '7', name: 'George King', activity: 'Subscription active (Oct 15)', icon: 'checkmark-circle-outline', iconColor: '#4CAF50', iconBg: '#E8F5E9' },
];

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = ['#2196F3', '#9C27B0', '#FF9800', '#4CAF50', '#F44336', '#00BCD4', '#795548'];

export default function CustomerView() {
  const [search, setSearch] = useState('');

  const filteredRecent = recentActivity.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredAll = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderCustomer = ({ item, index }) => (
    <TouchableOpacity style={styles.customerCard} activeOpacity={0.7}>
      <View style={[styles.avatarCircle, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.activityRow}>
          <View style={[styles.activityIconWrap, { backgroundColor: item.iconBg }]}>
            <Ionicons name={item.icon} size={12} color={item.iconColor} />
          </View>
          <Text style={styles.activity}>{item.activity}</Text>
        </View>
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
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="filter-outline" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]}>
            <Ionicons name="settings-outline" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9E9E9E" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search customers..."
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
            <Text style={styles.statNumber}>{allCustomers.length + recentActivity.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={[styles.statBox, { marginHorizontal: 12 }]}>
            <Ionicons name="pulse-outline" size={18} color="#4CAF50" />
            <Text style={styles.statNumber}>{recentActivity.length}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={18} color="#FF9800" />
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>PENDING</Text>
          </View>
        </View>

        {/* Recent Activity */}
        {filteredRecent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredRecent}
              renderItem={({ item, index }) => renderCustomer({ item, index })}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* All Customers */}
        {filteredAll.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ALL CUSTOMERS</Text>
              <Text style={styles.countBadge}>{filteredAll.length}</Text>
            </View>
            <FlatList
              data={filteredAll}
              renderItem={({ item, index }) => renderCustomer({ item, index: index + 2 })}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Empty state */}
        {filteredRecent.length === 0 && filteredAll.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#C5C5C5" />
            <Text style={styles.emptyText}>No customers found</Text>
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
    paddingTop: 16,
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
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A2E',
  },

  // Stats
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

  // Section
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
  viewAll: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Customer Card
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

  // Empty state
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