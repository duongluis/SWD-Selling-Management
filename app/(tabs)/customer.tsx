import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

const recentActivity = [
  { id: '1', name: 'Alice Johnson', activity: 'Emailed 2 hours ago' },
  { id: '2', name: 'Bob Smith', activity: 'Called yesterday' },
];

const allCustomers = [
  { id: '3', name: 'Charlie Davis', activity: 'Meeting scheduled (Oct 24)' },
  { id: '4', name: 'Diana Prince', activity: 'New lead from web (Oct 22)' },
  { id: '5', name: 'Ethan Hunt', activity: 'Invoice sent (Oct 20)' },
  { id: '6', name: 'Fiona L.', activity: 'Pending follow-up (Oct 18)' },
  { id: '7', name: 'George King', activity: 'Subscription active (Oct 15)' },
];

export default function customerView() {
  const [search, setSearch] = useState('');

  const filteredRecent = recentActivity.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredAll = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderCustomer = ({ item }) => (
    <View style={styles.customerCard}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.activity}>{item.activity}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <View style={styles.icons}>
          <Ionicons name="filter-outline" size={24} color="#333" style={styles.icon} />
          <Ionicons name="settings-outline" size={24} color="#333" style={styles.icon} />
        </View>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search customers..."
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <FlatList
        data={filteredRecent}
        renderItem={renderCustomer}
        keyExtractor={item => item.id}
      />

      <Text style={styles.sectionTitle}>All Customers</Text>
      <FlatList
        data={filteredAll}
        renderItem={renderCustomer}
        keyExtractor={item => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent',width:Dimensions.get('screen').width, marginTop:30, },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  icons: { flexDirection: 'row' },
  icon: { marginLeft: 12 },
  searchBar: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginVertical: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  customerCard: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '500' },
  activity: { fontSize: 14, color: '#666' },
});