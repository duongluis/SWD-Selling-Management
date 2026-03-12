import React, { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ordersData = [
  { id: '8492', customer: 'Johnathan Doe', amount: '$124.00', status: 'PENDING', date: 'Today, Oct 25' },
  { id: '8491', customer: 'Sarah Jenkins', amount: '$342.50', status: 'SHIPPED', date: 'Oct 24, 2023' },
  { id: '8488', customer: 'Michael Ross', amount: '$89.00', status: 'CONFIRMED', date: 'Oct 23, 09:15 PM' },
  { id: '8485', customer: 'Amanda Waller', amount: '$210.25', status: 'CONFIRMED', date: 'Oct 22, 06:30 PM' },
];

export default function orderView() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredOrders = ordersData.filter(order => {
    const matchFilter = filter === 'All' || order.status === filter;
    const matchSearch = order.customer.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const renderOrder = ({ item }) => (
    <View style={styles.orderCard}>
      <Text style={styles.orderText}>Order #{item.id} - {item.amount} - {item.status}</Text>
      <Text style={styles.dateText}>{item.date}</Text>
      <Text style={styles.customerText}>{item.customer}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Management Screen</Text>
      <TextInput
        style={styles.searchBar}
        placeholder="Search orders..."
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.tabs}>
        {['All', 'Pending', 'Shipped', 'Confirmed'].map(tab => (
          <TouchableOpacity key={tab} onPress={() => setFilter(tab)}>
            <Text style={[styles.tabText, filter === tab && styles.activeTab]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent',width:Dimensions.get('screen').width, marginTop:30, },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  searchBar: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 12 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  tabText: { fontSize: 16, color: '#555' },
  activeTab: { fontWeight: 'bold', color: '#000' },
  orderCard: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  orderText: { fontSize: 16, fontWeight: '600' },
  dateText: { fontSize: 14, color: '#888' },
  customerText: { fontSize: 14, color: '#333' },
});